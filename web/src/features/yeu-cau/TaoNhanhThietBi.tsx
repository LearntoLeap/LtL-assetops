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
 * Mã do MÁY CHỦ sinh (LTL-TN-xxxx), không cho tự đặt: tạo nhanh giữa lúc gấp
 * là lúc dễ đặt mã trùng hoặc sai quy ước nhất.
 */
interface ThamSo {
  /** Tên gợi ý sẵn — thường là thứ người dùng vừa gõ vào ô mã. */
  goiYTen?: string;
  /** Gọi khi tạo xong, trả về mã và tên để form điền vào dòng thiết bị. */
  onTaoXong: (thietBi: Pick<ThietBi, 'code' | 'name'>) => void;
  onHuy: () => void;
}

export function TaoNhanhThietBi({ goiYTen, onTaoXong, onHuy }: ThamSo) {
  const [ten, datTen] = useState(goiYTen ?? '');
  const [maHang, datMaHang] = useState('');
  const [soLuong, datSoLuong] = useState('1');
  const [loaiId, datLoaiId] = useState('');
  const [diemId, datDiemId] = useState('');
  const [anh, datAnh] = useState<AnhDaTai[]>([]);
  const [dsLoai, datDsLoai] = useState<DanhMuc[]>([]);
  const [dsDiem, datDsDiem] = useState<NoiDen[]>([]);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangTao, datDangTao] = useState(false);

  useEffect(() => {
    async function tai(): Promise<void> {
      try {
        const [loai, diem] = await Promise.all([
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/loai-tai-san'),
          goiApi<TrangDuLieu<NoiDen>>('/api/dia-diem/noi-den?chiHoatDong=true'),
        ]);
        datDsLoai(loai.muc);
        datDsDiem(diem.muc);
        if (loai.muc[0]) datLoaiId(loai.muc[0].id);
        // Mặc định nhập về kho văn phòng — nơi nhận hàng thường lệ.
        const kho = diem.muc.find((d) => /kho v/i.test(d.name)) ?? diem.muc[0];
        if (kho) datDiemId(kho.id);
      } catch (e) {
        datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh mục.');
      }
    }
    void tai();
  }, []);

  async function tao(): Promise<void> {
    datLoi(null);
    if (anh.length === 0) {
      datLoi('Bắt buộc chụp ít nhất một ảnh thiết bị.');
      return;
    }
    datDangTao(true);
    try {
      const kq = await goiApi<{ ok: true; thietBi: ThietBi }>('/api/thiet-bi/nhanh', {
        method: 'POST',
        than: {
          name: ten.trim(),
          categoryId: loaiId,
          nhapVeLocationId: diemId,
          ...(maHang.trim() ? { vendorCode: maHang.trim() } : {}),
          soLuongNhap: Number(soLuong || '1'),
          anhIds: anh.map((a) => a.id),
        },
      });
      onTaoXong({ code: kq.thietBi.code, name: kq.thietBi.name });
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tạo được thiết bị.');
    } finally {
      datDangTao(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <PackagePlus className="size-4 text-primary" aria-hidden />
        Thêm thiết bị chưa có mã
      </p>
      <p className="text-xs text-muted-foreground">
        Mã do hệ thống tự sinh dạng <span className="font-mono">LTL-TN-0001</span>. Nguồn gốc và
        giá trị bổ sung sau ở trang Thiết bị.
      </p>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tn-ten">Tên thiết bị *</Label>
          <Input
            id="tn-ten"
            value={ten}
            onChange={(su) => datTen(su.target.value)}
            placeholder="VD: Servo MG996R"
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
          <Label htmlFor="tn-diem">Nhập về *</Label>
          <Select id="tn-diem" value={diemId} onChange={(su) => datDiemId(su.target.value)} required>
            {dsDiem.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tn-sl">Số lượng nhập</Label>
          <Input
            id="tn-sl"
            type="number"
            min={1}
            value={soLuong}
            onChange={(su) => datSoLuong(su.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Nhiều hơn 1 thì quản theo số lượng, không theo từng cái.
          </p>
        </div>
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
