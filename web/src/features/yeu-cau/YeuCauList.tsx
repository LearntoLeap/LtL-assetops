import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import {
  DS_LOAI_YEU_CAU,
  DS_TRANG_THAI_YEU_CAU,
  NHAN_LOAI_YEU_CAU,
  NHAN_TRANG_THAI_YEU_CAU,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { goiApi, LoiApi } from '@/lib/api';
import { ngayGio } from '@/lib/dinh-dang';
import type { TrangDuLieu, YeuCau } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';
import { MAU_TRANG_THAI } from './tien-ich';

const MOI_TRANG = 25;

export function YeuCauList() {
  // Mở từ dashboard hoặc màn hình kho thì lọc sẵn theo ?status= và ?type=.
  const [thamSo] = useSearchParams();
  const [muc, datMuc] = useState<YeuCau[]>([]);
  const [tong, datTong] = useState(0);
  const [trang, datTrang] = useState(1);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [tuKhoa, datTuKhoa] = useState('');
  const [locLoai, datLocLoai] = useState(thamSo.get('type') ?? '');
  const [locTrangThai, datLocTrangThai] = useState(thamSo.get('status') ?? '');
  const [cuaToi, datCuaToi] = useState(false);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const q = new URLSearchParams({ trang: String(trang), moiTrang: String(MOI_TRANG) });
      if (tuKhoa.trim()) q.set('tuKhoa', tuKhoa.trim());
      if (locLoai) q.set('type', locLoai);
      if (locTrangThai) q.set('status', locTrangThai);
      if (cuaToi) q.set('cuaToi', 'true');
      const kq = await goiApi<TrangDuLieu<YeuCau>>(`/api/yeu-cau?${q.toString()}`);
      datMuc(kq.muc);
      datTong(kq.tong);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách yêu cầu.');
    } finally {
      datDangTai(false);
    }
  }, [trang, tuKhoa, locLoai, locTrangThai, cuaToi]);

  useEffect(() => {
    void tai();
  }, [tai]);

  // Có yêu cầu mới hoặc đổi trạng thái thì tải lại — dữ liệu vẫn do server lọc.
  const { dangNoi } = useRealtime([SU_KIEN.YEU_CAU_MOI, SU_KIEN.YEU_CAU_DOI], () => {
    void tai();
  });

  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));
  const doiLoc = (dat: (v: string) => void) => (v: string) => {
    dat(v);
    datTrang(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Yêu cầu</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Mọi thiết bị rời kho đều phải qua một yêu cầu đã duyệt.
            <span
              className={dangNoi ? 'text-success-dam' : 'text-muted-foreground'}
              title={dangNoi ? 'Đang đồng bộ realtime' : 'Mất kết nối realtime'}
            >
              {dangNoi ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
            </span>
          </p>
        </div>
        <Button asChild>
          <Link to="/yeu-cau/moi">
            <Plus aria-hidden />
            Tạo yêu cầu
          </Link>
        </Button>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({tong})</CardTitle>
          <CardDescription>
            Trang {trang}/{soTrang}
          </CardDescription>
          <div className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="pl-9"
                placeholder="Tìm theo số yêu cầu, lý do hoặc mã thiết bị…"
                value={tuKhoa}
                onChange={(su) => doiLoc(datTuKhoa)(su.target.value)}
                aria-label="Tìm yêu cầu"
              />
            </div>
            <Select
              value={locLoai}
              onChange={(su) => doiLoc(datLocLoai)(su.target.value)}
              aria-label="Lọc theo loại yêu cầu"
            >
              <option value="">Mọi loại</option>
              {DS_LOAI_YEU_CAU.map((l) => (
                <option key={l.ma} value={l.ma}>
                  {l.nhan}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Select
                value={locTrangThai}
                onChange={(su) => doiLoc(datLocTrangThai)(su.target.value)}
                aria-label="Lọc theo trạng thái"
              >
                <option value="">Mọi trạng thái</option>
                {DS_TRANG_THAI_YEU_CAU.map((t) => (
                  <option key={t.ma} value={t.ma}>
                    {t.nhan}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
                <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
              </Button>
            </div>
            <label className="flex min-h-cham cursor-pointer items-center gap-2 text-sm lg:col-span-4">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--chinh))]"
                checked={cuaToi}
                onChange={(su) => {
                  datCuaToi(su.target.checked);
                  datTrang(1);
                }}
              />
              Chỉ hiện yêu cầu do tôi tạo
            </label>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {dangTai && muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
          ) : muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Chưa có yêu cầu nào.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số yêu cầu</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Người tạo</TableHead>
                    <TableHead>Nơi đến</TableHead>
                    <TableHead className="text-right">Số dòng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Tạo lúc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muc.map((y) => (
                    <TableRow key={y.id}>
                      <TableCell>
                        <Link
                          to={`/yeu-cau/${y.id}`}
                          className="font-mono text-sm font-medium text-primary-dam hover:underline"
                        >
                          {y.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {NHAN_LOAI_YEU_CAU[y.type]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {y.createdBy.fullName}
                        {y.createdBy.department ? (
                          <span className="block text-xs">{y.createdBy.department}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {y.toLocation?.name ?? y.destinationNote ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{y.items.length}</TableCell>
                      <TableCell>
                        <Badge variant={MAU_TRANG_THAI[y.status]}>
                          {NHAN_TRANG_THAI_YEU_CAU[y.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ngayGio(y.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {soTrang > 1 ? (
                <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-0">
                  <Button variant="outline" disabled={trang <= 1} onClick={() => datTrang((t) => t - 1)}>
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
