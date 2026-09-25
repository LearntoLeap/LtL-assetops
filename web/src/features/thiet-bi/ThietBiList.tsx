import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Plus, QrCode, RefreshCw, Search, Trash2, Undo2, Upload } from 'lucide-react';
import {
  DS_TINH_TRANG,
  DS_TRANG_THAI_PHAN_BO,
  NHAN_KIEU_QUAN_LY,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_PHAN_BO,
  type TinhTrang,
  type TrangThaiPhanBo,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NutQuetQR } from '@/components/QuetQR';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { taiTep } from '@/lib/tep';
import type { DanhMuc, DiaDiem, ThietBi, TrangDuLieu } from '@/lib/kieu';

type MauBadge = NonNullable<BadgeProps['variant']>;

export const MAU_TINH_TRANG: Record<TinhTrang, MauBadge> = {
  TOT: 'success',
  DANG_SU_DUNG: 'default',
  CAN_BAO_TRI: 'warning',
  HONG: 'destructive',
  DANG_BAO_HANH: 'warning',
  MAT: 'destructive',
};

export const MAU_PHAN_BO: Record<TrangThaiPhanBo, MauBadge> = {
  TAI_KHO: 'muted',
  DA_PHAN_BO: 'default',
  DANG_VAN_CHUYEN: 'warning',
  CHO_MUON: 'accent',
  DANG_PHUC_VU_SU_KIEN: 'accent',
};

/** Định dạng tiền Việt, bỏ phần thập phân cho gọn bảng. */
export function tienVN(so: number | null): string {
  if (so === null) return '—';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(so);
}

const MOI_TRANG = 25;
/**
 * Số dòng mỗi lượt khi "chọn tất cả" — bằng đúng trần `moiTrang` của API
 * (`luocDoLocThietBi`: `.max(200)`). Gửi lớn hơn thì server trả 400 và nút "chọn
 * tất cả" không chọn được gì.
 */
const MOI_LUOT_CHON = 200;
/**
 * Trần một lượt xoá/khôi phục hàng loạt — bằng đúng `luocDoNhieuId`
 * (`.max(500)`). Chọn quá số này rồi bấm xoá thì API từ chối cả lô, nên thà chỉ
 * chọn tới đây và nói thẳng là còn dư.
 */
const TOI_DA_MOT_LUOT = 500;

export function ThietBiList() {
  const { nguoiDung } = useAuth();
  const dieuHuong = useNavigate();
  const duocSua =
    nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH' || nguoiDung?.role === 'KHO';
  // Xoá hẳn chỉ ADMIN — trùng với `yeuCauAdmin` ở API. Ẩn nút chỉ là cho gọn mắt,
  // chặn thật vẫn nằm ở middleware phía server.
  const laAdmin = nguoiDung?.role === 'ADMIN';

  const [muc, datMuc] = useState<ThietBi[]>([]);
  /**
   * Thiết bị đang tick, giữ dạng MÃ → ID.
   *
   * Cần cả hai: in nhãn truyền MÃ sang trang in, xoá hàng loạt gửi ID cho API.
   * Và phải giữ sẵn trong này chứ không tra ngược từ `muc`, vì `muc` chỉ là
   * trang đang xem — chọn xuyên nhiều trang thì tra không ra.
   */
  const [daChon, datDaChon] = useState<Map<string, string>>(new Map());
  const [dangXoaLo, datDangXoaLo] = useState(false);
  /** Lời nhắc không phải lỗi — ví dụ "chọn tất cả" bị chặn ở trần một lượt. */
  const [ghiChu, datGhiChu] = useState<string | null>(null);
  const [tong, datTong] = useState(0);
  const [trang, datTrang] = useState(1);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);

  const [tuKhoa, datTuKhoa] = useState('');
  const [locLoai, datLocLoai] = useState('');
  const [locDiem, datLocDiem] = useState('');
  const [locTinhTrang, datLocTinhTrang] = useState('');
  const [locPhanBo, datLocPhanBo] = useState('');
  const [locMucDich, datLocMucDich] = useState('');

  const [loaiTaiSan, datLoaiTaiSan] = useState<DanhMuc[]>([]);
  const [diaDiem, datDiaDiem] = useState<DiaDiem[]>([]);
  const [mucDich, datMucDich] = useState<DanhMuc[]>([]);

  /**
   * Dựng tham số truy vấn từ bộ lọc đang chọn.
   *
   * Tách ra vì có HAI nơi cần đúng bộ lọc này: nạp trang đang xem, và "chọn tất
   * cả" (gọi lại API với moiTrang lớn). Viết hai lần thì sớm muộn lệch nhau, và
   * lúc đó "chọn tất cả" sẽ chọn cả những thứ không khớp bộ lọc đang hiện.
   */
  const layThamSo = useCallback((): URLSearchParams => {
    const q = new URLSearchParams();
    if (tuKhoa.trim()) q.set('tuKhoa', tuKhoa.trim());
    if (locLoai) q.set('categoryId', locLoai);
    if (locDiem) q.set('locationId', locDiem);
    if (locTinhTrang) q.set('condition', locTinhTrang);
    if (locPhanBo) q.set('allocationStatus', locPhanBo);
    if (locMucDich) q.set('purposeId', locMucDich);
    return q;
  }, [tuKhoa, locLoai, locDiem, locTinhTrang, locPhanBo, locMucDich]);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const q = layThamSo();
      q.set('trang', String(trang));
      q.set('moiTrang', String(MOI_TRANG));
      const kq = await goiApi<TrangDuLieu<ThietBi>>(`/api/thiet-bi?${q.toString()}`);
      datMuc(kq.muc);
      datTong(kq.tong);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách thiết bị.');
    } finally {
      datDangTai(false);
    }
  }, [trang, layThamSo]);

  useEffect(() => {
    void tai();
  }, [tai]);

  useEffect(() => {
    async function taiDanhMuc(): Promise<void> {
      try {
        const [loai, diem, md] = await Promise.all([
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/loai-tai-san'),
          goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true'),
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/muc-dich'),
        ]);
        datLoaiTaiSan(loai.muc);
        datDiaDiem(diem.muc);
        // Kể cả mục đã Ngừng dùng: vẫn còn thiết bị cũ mang mục đó, phải lọc ra xem được.
        datMucDich(md.muc);
      } catch {
        // Thiếu danh mục thì chỉ mất bộ lọc, bảng vẫn xem được.
      }
    }
    void taiDanhMuc();
  }, []);

  /**
   * Đổi bộ lọc: quay về trang 1 và BỎ HẾT TICK.
   *
   * Giữ tick qua các trang là cố ý (chọn tất cả rồi xoá cả lô). Nhưng giữ tick
   * qua các BỘ LỌC KHÁC NHAU thì nguy: tick cả 300 thiết bị, lọc lại còn 3 dòng
   * trên màn, rồi bấm xoá — cái bị xoá là 300 chứ không phải 3. Đổi bộ lọc thì
   * coi như chọn lại từ đầu.
   */
  const doiLoc = (dat: (v: string) => void) => (v: string) => {
    dat(v);
    datTrang(1);
    datDaChon(new Map());
    datGhiChu(null);
  };

  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));

  const doiChon = (t: ThietBi): void =>
    datDaChon((cu) => {
      const moi = new Map(cu);
      if (moi.has(t.code)) moi.delete(t.code);
      else moi.set(t.code, t.id);
      return moi;
    });

  // Tick ở đầu bảng: chọn/bỏ chọn mọi dòng ĐANG HIỆN (không chạm các trang khác).
  const trangDaChonHet = muc.length > 0 && muc.every((t) => daChon.has(t.code));
  const doiChonCaTrang = (): void =>
    datDaChon((cu) => {
      const moi = new Map(cu);
      for (const t of muc) {
        if (trangDaChonHet) moi.delete(t.code);
        else moi.set(t.code, t.id);
      }
      return moi;
    });

  /**
   * Chọn HẾT thiết bị khớp bộ lọc hiện tại, không chỉ trang đang xem.
   *
   * Phải gọi lại API vì trang này chỉ nạp 25 dòng một lần. Cần cho đúng việc
   * "chọn tất cả rồi xoá" — bắt người dùng lật từng trang rồi tick lại thì
   * không khác gì bấm xoá từng cái.
   *
   * Lật NHIỀU LƯỢT chứ không xin một lần thật lớn: API chặn `moiTrang` ở 200, xin
   * 500 là bị trả 400 và nút này không chọn được gì (đã gặp đúng lỗi đó).
   */
  async function chonTatCa(): Promise<void> {
    datLoi(null);
    datGhiChu(null);
    try {
      const gop = new Map<string, string>();
      for (let t = 1; gop.size < TOI_DA_MOT_LUOT; t++) {
        const q = layThamSo();
        q.set('trang', String(t));
        q.set('moiTrang', String(MOI_LUOT_CHON));
        const kq = await goiApi<TrangDuLieu<ThietBi>>(`/api/thiet-bi?${q.toString()}`);
        for (const tb of kq.muc) {
          if (gop.size >= TOI_DA_MOT_LUOT) break;
          gop.set(tb.code, tb.id);
        }
        // Hết dòng, hoặc đã gom đủ tổng mà server báo — thì dừng, đừng gọi thêm.
        if (kq.muc.length < MOI_LUOT_CHON || gop.size >= kq.tong) {
          if (kq.tong > gop.size) {
            datGhiChu(
              `Chỉ chọn được ${gop.size} thiết bị một lượt (giới hạn của hệ thống), ` +
                `trong khi bộ lọc đang khớp ${kq.tong}. Xử lý xong ${gop.size} cái này ` +
                'rồi bấm "Chọn tất cả" lần nữa cho phần còn lại.',
            );
          }
          datDaChon(gop);
          return;
        }
      }
      datGhiChu(
        `Chỉ chọn được ${TOI_DA_MOT_LUOT} thiết bị một lượt (giới hạn của hệ thống). ` +
          `Xử lý xong rồi bấm "Chọn tất cả" lần nữa cho phần còn lại.`,
      );
      datDaChon(gop);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không chọn được tất cả.');
    }
  }

  /** Xoá hàng loạt các thiết bị đã tick — chuyển vào thùng rác, khôi phục được. */
  async function xoaLoDaChon(): Promise<void> {
    const ids = [...daChon.values()];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Chuyển ${ids.length} thiết bị đã chọn vào thùng rác?\n\n` +
          'Chúng sẽ biến khỏi mọi danh sách và không còn tính vào tồn kho, nhưng ' +
          'khôi phục lại được ở Thiết bị → Thùng rác.',
      )
    ) {
      return;
    }
    datLoi(null);
    datGhiChu(null);
    datDangXoaLo(true);
    try {
      const kq = await goiApi<{
        ok: true;
        soThanhCong: number;
        boQua: Array<{ ma: string | null; lyDo: string }>;
        thongDiep: string;
      }>('/api/thiet-bi/xoa-nhieu', { method: 'POST', than: { ids } });
      datDaChon(new Map());
      await tai();
      // Báo cả phần bỏ sót: lô 30 cái mà 2 cái vướng thì phải biết đúng 2 cái nào.
      if (kq.boQua.length > 0) {
        datLoi(
          `${kq.thongDiep} Bỏ qua ${kq.boQua.length}: ` +
            kq.boQua.map((b) => `${b.ma ?? '?'} (${b.lyDo})`).join('; '),
        );
      }
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá hàng loạt thất bại.');
    } finally {
      datDangXoaLo(false);
    }
  }

  /**
   * Xoá hẳn một thiết bị ngay tại danh sách.
   *
   * Có nút ở đây vì thiết bị vừa "thêm nhanh" lúc lập yêu cầu (mã LTL-TN-…) hay
   * vừa nhập sai mã thì người dùng đang ở danh sách, không có lý gì phải mở
   * trang chi tiết mới xoá được. API chỉ cho xoá khi thiết bị CHƯA phát sinh
   * nghiệp vụ; nếu đã phát sinh thì thông điệp 409 của server hiện nguyên văn
   * để người dùng biết nên chuyển sang "Ngừng theo dõi".
   */
  async function xoaThietBi(t: ThietBi): Promise<void> {
    // Lời xác nhận phải nói đúng việc sắp xảy ra: đây là chuyển vào thùng rác,
    // KHÔNG phải xoá hẳn. Ghi "không thể hoàn lại" như trước là nói sai.
    if (
      !window.confirm(
        `Chuyển thiết bị ${t.code} — ${t.name} vào thùng rác?\n\n` +
          'Thiết bị sẽ biến khỏi mọi danh sách và không còn tính vào tồn kho, ' +
          'nhưng khôi phục lại được ở Thiết bị → Thùng rác.',
      )
    ) {
      return;
    }
    datLoi(null);
    try {
      await goiApi(`/api/thiet-bi/${t.id}`, { method: 'DELETE' });
      await tai();
    } catch (e) {
      datLoi(
        e instanceof LoiApi
          ? `Không xoá được ${t.code}: ${e.message}`
          : `Không xoá được ${t.code}.`,
      );
    }
  }

  const quetXong = useCallback(
    async (ma: string) => {
      // Nhãn QR chứa đúng mã thiết bị — tra cứu rồi nhảy thẳng vào chi tiết.
      try {
        const kq = await goiApi<{ ok: true; thietBi: ThietBi }>(
          `/api/thiet-bi/ma/${encodeURIComponent(ma.trim())}`,
        );
        dieuHuong(`/thiet-bi/${kq.thietBi.id}`);
      } catch (e) {
        datLoi(
          e instanceof LoiApi
            ? `Quét được mã "${ma}" nhưng ${e.message.charAt(0).toLowerCase()}${e.message.slice(1)}`
            : `Không tra cứu được mã "${ma}".`,
        );
      }
    },
    [dieuHuong],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Thiết bị</h1>
          <p className="text-sm text-muted-foreground">
            Mỗi thiết bị có một mã duy nhất. Danh sách đã lọc theo phạm vi của bạn.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NutQuetQR onQuetDuoc={(ma) => void quetXong(ma)} nhan="Quét mã" />
          {duocSua ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/thiet-bi/in-nhan">
                  <QrCode aria-hidden />
                  In nhãn QR
                </Link>
              </Button>
              {laAdmin ? (
                <Button variant="outline" asChild>
                  <Link to="/thiet-bi/thung-rac">
                    <Undo2 aria-hidden />
                    Thùng rác
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link to="/nhap-lieu">
                  <Upload aria-hidden />
                  Nhập hàng loạt
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void taiTep('/api/nhap-xuat/xuat/thiet-bi', 'thiet-bi.xlsx').catch((e: unknown) =>
                    datLoi(e instanceof LoiApi ? e.message : 'Xuất Excel thất bại.'),
                  )
                }
              >
                <Download aria-hidden />
                Xuất Excel
              </Button>
              <Button asChild>
                <Link to="/thiet-bi/moi">
                  <Plus aria-hidden />
                  Thêm thiết bị
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {ghiChu ? <Alert variant="warning">{ghiChu}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({tong})</CardTitle>
          <CardDescription>
            Trang {trang}/{soTrang}
          </CardDescription>
          <div className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="pl-9"
                placeholder="Tìm theo mã, tên hoặc serial…"
                value={tuKhoa}
                onChange={(su) => doiLoc(datTuKhoa)(su.target.value)}
                aria-label="Tìm thiết bị"
              />
            </div>
            <Select
              value={locLoai}
              onChange={(su) => doiLoc(datLocLoai)(su.target.value)}
              aria-label="Lọc theo loại tài sản"
            >
              <option value="">Mọi loại</option>
              {loaiTaiSan.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select
              value={locDiem}
              onChange={(su) => doiLoc(datLocDiem)(su.target.value)}
              aria-label="Lọc theo điểm lưu trữ"
            >
              <option value="">Mọi điểm</option>
              {diaDiem.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select
              value={locTinhTrang}
              onChange={(su) => doiLoc(datLocTinhTrang)(su.target.value)}
              aria-label="Lọc theo tình trạng"
            >
              <option value="">Mọi tình trạng</option>
              {DS_TINH_TRANG.map((t) => (
                <option key={t.ma} value={t.ma}>
                  {t.nhan}
                </option>
              ))}
            </Select>
            <Select
              value={locPhanBo}
              onChange={(su) => doiLoc(datLocPhanBo)(su.target.value)}
              aria-label="Lọc theo trạng thái phân bổ"
            >
              <option value="">Mọi trạng thái</option>
              {DS_TRANG_THAI_PHAN_BO.map((t) => (
                <option key={t.ma} value={t.ma}>
                  {t.nhan}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Select
                value={locMucDich}
                onChange={(su) => doiLoc(datLocMucDich)(su.target.value)}
                aria-label="Lọc theo mục đích sử dụng"
              >
                <option value="">Mọi mục đích</option>
                {mucDich.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
                <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {dangTai && muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
          ) : muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">
              Không có thiết bị nào khớp điều kiện.
            </p>
          ) : (
            <>
              {/* Thanh này chỉ hiện khi đã tick — không chiếm chỗ lúc chưa dùng. */}
              {daChon.size > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5 sm:gap-3">
                  <span className="text-sm font-medium">Đã chọn {daChon.size} thiết bị</span>
                  <Button size="sm" asChild>
                    <Link
                      to={`/thiet-bi/in-nhan?ma=${[...daChon.keys()].map(encodeURIComponent).join(',')}`}
                    >
                      <QrCode aria-hidden />
                      In nhãn {daChon.size} mã
                    </Link>
                  </Button>
                  {/* Xoá hàng loạt: chỉ ADMIN, khớp `yeuCauAdmin` ở API. */}
                  {laAdmin ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void xoaLoDaChon()}
                      disabled={dangXoaLo}
                    >
                      <Trash2 aria-hidden />
                      {dangXoaLo ? 'Đang xoá…' : `Xoá ${daChon.size} thiết bị`}
                    </Button>
                  ) : null}
                  {/*
                   * "Chọn tất cả" chỉ có nghĩa khi còn thứ chưa được chọn ngoài
                   * trang đang xem. Nạp 25 dòng một trang, mà muốn xoá cả 300
                   * thiết bị thì không thể bắt lật 12 trang rồi tick tay.
                   */}
                  {tong > daChon.size ? (
                    <Button variant="outline" size="sm" onClick={() => void chonTatCa()}>
                      Chọn tất cả {tong} thiết bị
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => datDaChon(new Map())}>
                    Bỏ chọn
                  </Button>
                </div>
              ) : null}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={trangDaChonHet}
                        onChange={doiChonCaTrang}
                        aria-label="Chọn mọi thiết bị đang hiện"
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </TableHead>
                    <TableHead>Mã / Tên</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Vị trí hiện tại</TableHead>
                    <TableHead>Tình trạng</TableHead>
                    <TableHead>Phân bổ</TableHead>
                    <TableHead>Quản lý</TableHead>
                    <TableHead className="text-right">Giá trị (VND)</TableHead>
                    {laAdmin ? (
                      /*
                       * Hai điều phải đúng cùng lúc ở ô tiêu đề này, đã đo thật
                       * mới ra:
                       *
                       * 1. KHÔNG đặt `sr-only` lên chính thẻ <th> — lớp đó gán
                       *    `position: absolute`, ô tiêu đề bị bốc khỏi hàng của
                       *    bảng, thoát khỏi khung cuộn ngang và kéo cả trang rộng
                       *    909px trên màn 390px.
                       * 2. <th> phải có `relative`. Đưa `sr-only` vào <span> bên
                       *    trong vẫn chưa đủ: span vẫn `position: absolute`, mà
                       *    không có tổ tiên nào được định vị thì nó neo vào khung
                       *    chứa ban đầu — lại thoát ra ngoài, trang còn 882px.
                       *    Có `relative` thì span neo vào đúng ô và nằm im trong bảng.
                       */
                      <TableHead className="relative w-10">
                        <span className="sr-only">Xoá</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muc.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={daChon.has(t.code)}
                          onChange={() => doiChon(t)}
                          aria-label={`Chọn ${t.code}`}
                          className="size-4 cursor-pointer accent-primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/thiet-bi/${t.id}`}
                          className="font-mono text-sm font-medium text-primary-dam hover:underline"
                        >
                          {t.code}
                        </Link>
                        <p className="text-xs text-muted-foreground">{t.name}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.category.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.currentLocation?.name ?? (t.holder ? 'Ngoài điểm lưu trữ' : '—')}
                        {t.holder ? (
                          <span className="block text-xs">Giữ: {t.holder.fullName}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={MAU_TINH_TRANG[t.condition]}>
                          {NHAN_TINH_TRANG[t.condition]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={MAU_PHAN_BO[t.allocationStatus]}>
                          {NHAN_TRANG_THAI_PHAN_BO[t.allocationStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {NHAN_KIEU_QUAN_LY[t.trackingType]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{tienVN(t.value)}</TableCell>
                      {laAdmin ? (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive-dam hover:bg-destructive/10"
                            onClick={() => void xoaThietBi(t)}
                            aria-label={`Xoá thiết bị ${t.code}`}
                            title="Chuyển vào thùng rác"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {soTrang > 1 ? (
                <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-0">
                  <Button
                    variant="outline"
                    disabled={trang <= 1}
                    onClick={() => datTrang((t) => Math.max(1, t - 1))}
                  >
                    Trang trước
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Trang {trang} / {soTrang}
                  </span>
                  <Button
                    variant="outline"
                    disabled={trang >= soTrang}
                    onClick={() => datTrang((t) => Math.min(soTrang, t + 1))}
                  >
                    Trang sau
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
