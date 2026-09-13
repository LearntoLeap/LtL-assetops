import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Plus, QrCode, RefreshCw, Search, Upload } from 'lucide-react';
import {
  DS_MUC_DICH_SU_DUNG,
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

export function ThietBiList() {
  const { nguoiDung } = useAuth();
  const dieuHuong = useNavigate();
  const duocSua =
    nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH' || nguoiDung?.role === 'KHO';

  const [muc, datMuc] = useState<ThietBi[]>([]);
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

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const q = new URLSearchParams({ trang: String(trang), moiTrang: String(MOI_TRANG) });
      if (tuKhoa.trim()) q.set('tuKhoa', tuKhoa.trim());
      if (locLoai) q.set('categoryId', locLoai);
      if (locDiem) q.set('locationId', locDiem);
      if (locTinhTrang) q.set('condition', locTinhTrang);
      if (locPhanBo) q.set('allocationStatus', locPhanBo);
      if (locMucDich) q.set('purpose', locMucDich);
      const kq = await goiApi<TrangDuLieu<ThietBi>>(`/api/thiet-bi?${q.toString()}`);
      datMuc(kq.muc);
      datTong(kq.tong);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách thiết bị.');
    } finally {
      datDangTai(false);
    }
  }, [trang, tuKhoa, locLoai, locDiem, locTinhTrang, locPhanBo, locMucDich]);

  useEffect(() => {
    void tai();
  }, [tai]);

  useEffect(() => {
    async function taiDanhMuc(): Promise<void> {
      try {
        const [loai, diem] = await Promise.all([
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/loai-tai-san'),
          goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true'),
        ]);
        datLoaiTaiSan(loai.muc);
        datDiaDiem(diem.muc);
      } catch {
        // Thiếu danh mục thì chỉ mất bộ lọc, bảng vẫn xem được.
      }
    }
    void taiDanhMuc();
  }, []);

  // Đổi bộ lọc thì quay về trang 1, tránh rơi vào trang trống.
  const doiLoc = (dat: (v: string) => void) => (v: string) => {
    dat(v);
    datTrang(1);
  };

  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));

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
                {DS_MUC_DICH_SU_DUNG.map((t) => (
                  <option key={t.ma} value={t.ma}>
                    {t.nhan}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã / Tên</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Vị trí hiện tại</TableHead>
                    <TableHead>Tình trạng</TableHead>
                    <TableHead>Phân bổ</TableHead>
                    <TableHead>Quản lý</TableHead>
                    <TableHead className="text-right">Giá trị (VND)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muc.map((t) => (
                    <TableRow key={t.id}>
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
                        {t.currentLocation?.name ?? '—'}
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
