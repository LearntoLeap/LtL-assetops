import { useEffect, useState } from 'react';
import { Loader2, PackagePlus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ChupAnh } from '@/components/ChupAnh';
import { goiApi, LoiApi } from '@/lib/api';
import type { AnhDaTai } from '@/lib/anh';
import type { DanhMuc, NoiDen, ThietBi, TrangDuLieu } from '@/lib/kieu';

/**
 * TẠO NHANH THIẾT BỊ ngay trong form yêu cầu, khi mã chưa có trong kho.
 *
 * Bắt người ở kho rời form, sang trang Thiết bị điền mười mấy ô rồi quay lại
 * là mất mạch giữa lúc gấp. Ở đây chỉ hỏi những gì KHÔNG suy ra được: tên,
 * loại tài sản, nơi nhập về, và ẢNH.
 *
 * ẢNH BẮT BUỘC — cùng lý do như linh kiện không mã: thiết bị vào sổ mà không
 * ai thấy mặt nó thì sau này không đối chiếu được. Máy chủ cũng chặn lại, ẩn
 * hiện ở đây chỉ để đỡ nhầm.
 *
 * Mã do MÁY CHỦ sinh theo quy ước chung (vd KHAC-AP-0001), không cho tự đặt:
 * tạo nhanh giữa lúc gấp là lúc dễ đặt mã trùng hoặc sai quy ước nhất.
 *
 * Hai chế độ cho HÀNG LẺ (`hangLe`):
 *   - 'co-ton'    : phiếu lấy hàng ra — hàng mới được cộng ngay vào kho chọn
 *                   với số lượng nhập, rồi phiếu lấy từ đó;
 *   - 'danh-muc'  : phiếu NHẬP KHO — chỉ thêm tên vào danh mục, số lượng vào
 *                   kho do chính phiếu nhập ghi (cộng ở đây nữa là tính hai lần).
 */
interface ThamSo {
  /** Tên gợi ý sẵn — thường là thứ người dùng vừa gõ vào ô mã. */
  goiYTen?: string;
  /** Thêm hàng lẻ (quản theo số lượng) thay vì thiết bị từng bộ. */
  hangLe?: 'co-ton' | 'danh-muc';
  /** Kho chọn sẵn ở ô "Nhập về". */
  khoMacDinh?: string | undefined;
  /** Gọi khi tạo xong, trả về mã và tên để form điền vào dòng thiết bị. */
  onTaoXong: (thietBi: Pick<ThietBi, 'code' | 'name'>, soLuongNhap: number) => void;
  /** Hàng lẻ cùng tên đã có — form dùng luôn mã có sẵn thay vì tạo trùng. */
  onDaCo?: (thietBi: { code: string; name: string }) => void;
  onHuy: () => void;
}

const LOAI_KHO = new Set(['KHO_VAN_PHONG', 'KHO_SU_KIEN']);

export function TaoNhanhThietBi({
  goiYTen,
  hangLe,
  khoMacDinh,
  onTaoXong,
  onDaCo,
  onHuy,
}: ThamSo) {
  const [ten, datTen] = useState(goiYTen ?? '');
  const [maHang, datMaHang] = useState('');
  const [soLuong, datSoLuong] = useState('1');
  const [loaiId, datLoaiId] = useState('');
  const [diemId, datDiemId] = useState('');
  const [anh, datAnh] = useState<AnhDaTai[]>([]);
  const [dsLoai, datDsLoai] = useState<DanhMuc[]>([]);
  const [dsDiem, datDsDiem] = useState<NoiDen[]>([]);
  const [loi, datLoi] = useState<string | null>(null);
  const [daCo, datDaCo] = useState<{ code: string; name: string } | null>(null);
  const [dangTao, datDangTao] = useState(false);
  const chiDanhMuc = hangLe === 'danh-muc';

  useEffect(() => {
    async function tai(): Promise<void> {
      try {
        const [loai, diem] = await Promise.all([
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/loai-tai-san'),
          goiApi<TrangDuLieu<NoiDen>>('/api/dia-diem/noi-den?chiHoatDong=true'),
        ]);
        datDsLoai(loai.muc);
        // Hàng lẻ mới chỉ nhập về KHO: thêm thẳng vào trường thì không ai ở
        // kho biết có hàng đó, và kho không bao giờ khớp sổ.
        const dsNoi = hangLe ? diem.muc.filter((d) => LOAI_KHO.has(d.type)) : diem.muc;
        datDsDiem(dsNoi);
        if (loai.muc[0]) datLoaiId(loai.muc[0].id);
        const kho =
          dsNoi.find((d) => d.id === khoMacDinh) ??
          dsNoi.find((d) => d.type === 'KHO_VAN_PHONG') ??
          dsNoi[0];
        if (kho) datDiemId(kho.id);
      } catch (e) {
        datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh mục.');
      }
    }
    void tai();
  }, [hangLe, khoMacDinh]);

  async function tao(): Promise<void> {
    datLoi(null);
    datDaCo(null);
    if (anh.length === 0) {
      datLoi('Bắt buộc chụp ít nhất một ảnh thiết bị.');
      return;
    }
    const soLuongNhap = chiDanhMuc ? 0 : Math.max(1, Number(soLuong || '1'));
    datDangTao(true);
    try {
      const kq = await goiApi<{ ok: true; thietBi: ThietBi }>('/api/thiet-bi/nhanh', {
        method: 'POST',
        than: {
          name: ten.trim(),
          categoryId: loaiId,
          nhapVeLocationId: diemId,
          ...(maHang.trim() ? { vendorCode: maHang.trim() } : {}),
          ...(hangLe ? { trackingType: 'SO_LUONG' } : {}),
          soLuongNhap,
          anhIds: anh.map((a) => a.id),
        },
      });
      onTaoXong({ code: kq.thietBi.code, name: kq.thietBi.name }, soLuongNhap);
    } catch (e) {
      if (
        e instanceof LoiApi &&
        e.chiTiet?.maLoi === 'HANG_LE_DA_CO' &&
        typeof e.chiTiet.code === 'string'
      ) {
        datDaCo({ code: e.chiTiet.code, name: ten.trim() });
      }
      datLoi(e instanceof LoiApi ? e.message : 'Không tạo được thiết bị.');
    } finally {
      datDangTao(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <PackagePlus className="size-4 text-primary" aria-hidden />
        {hangLe ? 'Thêm hàng lẻ mới vào danh mục thiết bị' : 'Thêm thiết bị chưa có mã'}
      </p>
      <p className="text-xs text-muted-foreground">
        Mã do hệ thống tự sinh theo loại, vd <span className="font-mono">KHAC-AP-0001</span>, không
        bao giờ trùng. Nguồn gốc và giá trị bổ sung sau ở trang Thiết bị.
        {chiDanhMuc ? ' Số lượng nhận về ghi ở dòng của phiếu nhập, không cộng ở đây.' : null}
      </p>

      {loi ? (
        <Alert variant="destructive">
          {loi}
          {daCo && onDaCo ? (
            <span className="mt-2 block">
              <Button type="button" size="sm" variant="outline" onClick={() => onDaCo(daCo)}>
                Dùng mã có sẵn {daCo.code}
              </Button>
            </span>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tn-ten">{hangLe ? 'Tên hàng lẻ *' : 'Tên thiết bị *'}</Label>
          <Input
            id="tn-ten"
            value={ten}
            onChange={(su) => datTen(su.target.value)}
            placeholder={hangLe ? 'VD: Sách Robotics lớp 3' : 'VD: Servo MG996R'}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tn-hang">Mã của hãng cung cấp</Label>
          <Input
            id="tn-hang"
            className="font-mono"
            value={maHang}
            onChange={(su) => datMaHang(su.target.value)}
            placeholder="MG996R"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tn-loai">Loại tài sản *</Label>
          <Select id="tn-loai" value={loaiId} onChange={(su) => datLoaiId(su.target.value)} required>
            {dsLoai.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tn-diem">{chiDanhMuc ? 'Kho quản lý *' : 'Nhập về *'}</Label>
          <Select id="tn-diem" value={diemId} onChange={(su) => datDiemId(su.target.value)} required>
            {dsDiem.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        {chiDanhMuc ? null : (
          <div className="space-y-1.5">
            <Label htmlFor="tn-sl">Số lượng nhập vào kho</Label>
            <Input
              id="tn-sl"
              type="number"
              min={1}
              value={soLuong}
              onChange={(su) => datSoLuong(su.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {hangLe
                ? 'Số đang có trong kho. Phiếu này lấy ra bao nhiêu thì ghi ở dòng của phiếu.'
                : 'Nhiều hơn 1 thì quản theo số lượng, không theo từng cái.'}
            </p>
          </div>
        )}
      </div>

      <ChupAnh
        kind="HIEN_TRANG"
        anh={anh}
        onDoiAnh={datAnh}
        toiDa={3}
        batBuoc
        moTa="BẮT BUỘC: chụp thiết bị để sau còn đối chiếu."
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void tao()}
          disabled={dangTao || ten.trim().length < 2 || !loaiId || !diemId}
        >
          {dangTao ? <Loader2 className="animate-spin" aria-hidden /> : <PackagePlus aria-hidden />}
          Tạo &amp; dùng mã này
        </Button>
        <Button type="button" variant="outline" onClick={onHuy}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}
