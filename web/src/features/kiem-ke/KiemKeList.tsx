import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Loader2, Plus, RefreshCw } from 'lucide-react';
import { DS_TRANG_THAI_KIEM_KE, NHAN_TRANG_THAI_KIEM_KE } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth, VAI_TRO_QUAN_LY } from '@/lib/auth';
import { ngayGio } from '@/lib/dinh-dang';
import type { DiaDiem, PhieuKiemKe, TrangDuLieu } from '@/lib/kieu';
import { MAU_TRANG_THAI_KIEM_KE } from '@/features/bbbg/tien-ich';

const MOI_TRANG = 25;

export function KiemKeList() {
  const { nguoiDung } = useAuth();
  const [muc, datMuc] = useState<PhieuKiemKe[]>([]);
  const [tong, datTong] = useState(0);
  const [trang, datTrang] = useState(1);
  const [dsDiaDiem, datDsDiaDiem] = useState<DiaDiem[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [locTrangThai, datLocTrangThai] = useState('');

  const [moTao, datMoTao] = useState(false);
  const [ten, datTen] = useState('');
  const [locationId, datLocationId] = useState('');
  const [ghiChu, datGhiChu] = useState('');
  const [dangTao, datDangTao] = useState(false);
  const [loiTao, datLoiTao] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const q = new URLSearchParams({ trang: String(trang), moiTrang: String(MOI_TRANG) });
      if (locTrangThai) q.set('status', locTrangThai);
      const kq = await goiApi<TrangDuLieu<PhieuKiemKe>>(`/api/kiem-ke?${q.toString()}`);
      datMuc(kq.muc);
      datTong(kq.tong);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách phiếu kiểm kê.');
    } finally {
      datDangTai(false);
    }
  }, [trang, locTrangThai]);

  useEffect(() => {
    void tai();
  }, [tai]);

  useEffect(() => {
    goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true')
      .then((kq) => datDsDiaDiem(kq.muc))
      .catch(() => datDsDiaDiem([]));
  }, []);

  async function tao(su: React.FormEvent): Promise<void> {
    su.preventDefault();
    datLoiTao(null);
    datDangTao(true);
    try {
      await goiApi<{ ok: true; phieu: PhieuKiemKe }>('/api/kiem-ke', {
        method: 'POST',
        than: { name: ten.trim(), locationId, note: ghiChu.trim() },
      });
      datMoTao(false);
      datTen('');
      datLocationId('');
      datGhiChu('');
      await tai();
    } catch (e) {
      datLoiTao(e instanceof LoiApi ? e.message : 'Mở đợt kiểm kê thất bại.');
    } finally {
      datDangTao(false);
    }
  }

  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));
  const duocMoDot = nguoiDung ? VAI_TRO_QUAN_LY.includes(nguoiDung.role) : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Kiểm kê định kỳ</h1>
          <p className="text-sm text-muted-foreground">
            Chụp lại tồn kho theo hệ thống, đếm thực tế, rồi chốt để điều chỉnh chênh lệch.
          </p>
        </div>
        {duocMoDot ? (
          <Button onClick={() => datMoTao((m) => !m)}>
            <Plus aria-hidden />
            Mở đợt kiểm kê
          </Button>
        ) : null}
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {moTao ? (
        <Card>
          <CardHeader>
            <CardTitle>Mở đợt kiểm kê mới</CardTitle>
            <CardDescription>
              Hệ thống chụp lại tồn kho của địa điểm tại đúng thời điểm mở đợt. Mỗi địa điểm chỉ có
              một đợt chưa chốt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(su) => void tao(su)} className="space-y-3">
              {loiTao ? <Alert variant="destructive">{loiTao}</Alert> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="kk-ten">Tên đợt kiểm kê</Label>
                  <Input
                    id="kk-ten"
                    required
                    minLength={3}
                    value={ten}
                    placeholder="Kiểm kê kho tháng 3/2026"
                    onChange={(su) => datTen(su.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kk-dia-diem">Địa điểm kiểm kê</Label>
                  <Select
                    id="kk-dia-diem"
                    required
                    value={locationId}
                    onChange={(su) => datLocationId(su.target.value)}
                  >
                    <option value="">— Chọn địa điểm —</option>
                    {dsDiaDiem.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kk-ghi-chu">Ghi chú</Label>
                <Input
                  id="kk-ghi-chu"
                  value={ghiChu}
                  placeholder="Ví dụ: kiểm kê cuối quý theo kế hoạch."
                  onChange={(su) => datGhiChu(su.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={dangTao}>
                  {dangTao ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <ClipboardCheck aria-hidden />
                  )}
                  Mở đợt
                </Button>
                <Button type="button" variant="outline" onClick={() => datMoTao(false)}>
                  Thôi
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({tong})</CardTitle>
          <CardDescription>
            Trang {trang}/{soTrang}
          </CardDescription>
          <div className="flex gap-2 pt-2 sm:max-w-sm">
            <Select
              value={locTrangThai}
              onChange={(su) => {
                datLocTrangThai(su.target.value);
                datTrang(1);
              }}
              aria-label="Lọc theo trạng thái phiếu kiểm kê"
            >
              <option value="">Mọi trạng thái</option>
              {DS_TRANG_THAI_KIEM_KE.map((t) => (
                <option key={t.ma} value={t.ma}>
                  {t.nhan}
                </option>
              ))}
            </Select>
            <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
              <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {dangTai && muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
          ) : muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Chưa có đợt kiểm kê nào.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số phiếu</TableHead>
                    <TableHead>Tên đợt</TableHead>
                    <TableHead>Địa điểm</TableHead>
                    <TableHead className="text-right">Số dòng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Mở lúc</TableHead>
                    <TableHead>Chốt lúc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muc.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          to={`/kiem-ke/${p.id}`}
                          className="font-mono text-sm font-medium text-primary-dam hover:underline"
                        >
                          {p.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.location.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.items.length}</TableCell>
                      <TableCell>
                        <Badge variant={MAU_TRANG_THAI_KIEM_KE[p.status]}>
                          {NHAN_TRANG_THAI_KIEM_KE[p.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ngayGio(p.startedAt ?? p.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ngayGio(p.closedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {soTrang > 1 ? (
                <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-0">
                  <Button
                    variant="outline"
                    disabled={trang <= 1}
                    onClick={() => datTrang((t) => t - 1)}
                  >
                    Trang trước
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Trang {trang} / {soTrang}
                  </span>
                  <Button
                    variant="outline"
                    disabled={trang >= soTrang}
                    onClick={() => datTrang((t) => t + 1)}
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
