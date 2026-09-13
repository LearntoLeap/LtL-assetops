import { useCallback, useEffect, useState } from 'react';
import { BellRing, MapPin, RefreshCw, ScrollText, ShieldCheck } from 'lucide-react';
import {
  DS_LOAI_CANH_BAO,
  NHAN_LOAI_CANH_BAO,
  NHAN_MUC_DO_CANH_BAO,
  NHAN_VAI_TRO,
  type MucDoCanhBao,
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
import { goiApi, LoiApi } from '@/lib/api';
import { ngayGio } from '@/lib/dinh-dang';
import type { CanhBao, DongNhatKy, TrangDuLieu } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';

const MAU_MUC_DO: Record<MucDoCanhBao, NonNullable<BadgeProps['variant']>> = {
  THAP: 'muted',
  TRUNG_BINH: 'warning',
  CAO: 'destructive',
};

function KhoiCanhBao() {
  const [muc, datMuc] = useState<CanhBao[]>([]);
  const [daXuLy, datDaXuLy] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const [locLoai, datLocLoai] = useState('');

  const tai = useCallback(async () => {
    datLoi(null);
    try {
      const q = new URLSearchParams({ daXuLy: String(daXuLy) });
      if (locLoai) q.set('type', locLoai);
      const kq = await goiApi<TrangDuLieu<CanhBao>>(`/api/nhat-ky/canh-bao?${q.toString()}`);
      datMuc(kq.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được cảnh báo.');
    }
  }, [daXuLy, locLoai]);

  useEffect(() => {
    void tai();
  }, [tai]);
  useRealtime([SU_KIEN.CANH_BAO_MOI], () => void tai());

  async function xuLy(c: CanhBao): Promise<void> {
    const ghiChu = window.prompt(`Đã xử lý thế nào? (cảnh báo: ${c.title})`);
    if (!ghiChu || ghiChu.trim().length < 3) return;
    try {
      await goiApi(`/api/nhat-ky/canh-bao/${c.id}/xu-ly`, {
        method: 'POST',
        than: { resolutionNote: ghiChu.trim() },
      });
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xử lý cảnh báo thất bại.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="text-primary-dam" aria-hidden />
          Cảnh báo ({muc.length})
        </CardTitle>
        <CardDescription>
          Hệ thống tự sinh khi tình trạng thiết bị đổi lúc trả, quá hạn trả, chênh lệch kiểm kê,
          hoặc tài khoản kho đăng nhập ngoài vùng.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Select
            className="w-auto min-w-48"
            value={locLoai}
            onChange={(su) => datLocLoai(su.target.value)}
            aria-label="Lọc theo loại cảnh báo"
          >
            <option value="">Mọi loại cảnh báo</option>
            {DS_LOAI_CANH_BAO.map((l) => (
              <option key={l.ma} value={l.ma}>
                {l.nhan}
              </option>
            ))}
          </Select>
          <label className="flex min-h-cham cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[hsl(var(--chinh))]"
              checked={daXuLy}
              onChange={(su) => datDaXuLy(su.target.checked)}
            />
            Hiện cảnh báo đã xử lý
          </label>
          <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
            <RefreshCw aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loi ? <Alert variant="destructive">{loi}</Alert> : null}
        {muc.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {daXuLy ? 'Chưa có cảnh báo nào được xử lý.' : 'Không có cảnh báo nào đang mở. Tốt.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {muc.map((c) => (
              <li key={c.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <Badge variant={MAU_MUC_DO[c.severity]}>
                        {NHAN_MUC_DO_CANH_BAO[c.severity]}
                      </Badge>
                      <Badge variant="muted">{NHAN_LOAI_CANH_BAO[c.type]}</Badge>
                      {c.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{c.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{ngayGio(c.createdAt)}</p>
                    {c.resolvedAt ? (
                      <p className="mt-1 text-xs text-success-dam">
                        Đã xử lý bởi {c.resolvedBy?.fullName ?? '—'} · {c.resolutionNote}
                      </p>
                    ) : null}
                  </div>
                  {c.resolvedAt ? null : (
                    <Button variant="outline" size="sm" onClick={() => void xuLy(c)}>
                      Đánh dấu đã xử lý
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function KhoiNhatKy() {
  const [muc, datMuc] = useState<DongNhatKy[]>([]);
  const [tong, datTong] = useState(0);
  const [trang, datTrang] = useState(1);
  const [locAction, datLocAction] = useState('');
  const [loi, datLoi] = useState<string | null>(null);
  const MOI_TRANG = 50;

  const tai = useCallback(async () => {
    datLoi(null);
    try {
      const q = new URLSearchParams({ trang: String(trang), moiTrang: String(MOI_TRANG) });
      if (locAction.trim()) q.set('action', locAction.trim());
      const kq = await goiApi<TrangDuLieu<DongNhatKy>>(`/api/nhat-ky?${q.toString()}`);
      datMuc(kq.muc);
      datTong(kq.tong);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được nhật ký.');
    }
  }, [trang, locAction]);

  useEffect(() => {
    void tai();
  }, [tai]);

  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="text-primary-dam" aria-hidden />
          Nhật ký thao tác ({tong})
        </CardTitle>
        <CardDescription>
          Bảng chỉ ghi thêm — hệ thống không có chức năng sửa hay xoá nhật ký.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Input
            className="max-w-xs"
            placeholder="Lọc theo thao tác, VD asset.xuat_kho"
            value={locAction}
            onChange={(su) => {
              datLocAction(su.target.value);
              datTrang(1);
            }}
            aria-label="Lọc theo thao tác"
          />
          <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
            <RefreshCw aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-5">
        {loi ? (
          <div className="px-5 sm:px-0">
            <Alert variant="destructive">{loi}</Alert>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thời điểm</TableHead>
              <TableHead>Ai</TableHead>
              <TableHead>Thao tác</TableHead>
              <TableHead>Đối tượng</TableHead>
              <TableHead>Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {muc.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {ngayGio(d.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {d.actorEmail ?? 'hệ thống'}
                  {d.actorRole ? (
                    <span className="block text-xs">{NHAN_VAI_TRO[d.actorRole]}</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="muted" className="font-mono">
                    {d.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.entityType}
                  {d.entityId ? <span className="block font-mono">{d.entityId}</span> : null}
                </TableCell>
                <TableCell className="max-w-md text-xs text-muted-foreground">
                  {d.note ? <p>{d.note}</p> : null}
                  {d.latitude !== null ? (
                    <p className="flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden />
                      {d.latitude}, {d.longitude}
                      {d.distanceM !== null ? ` · cách ${d.distanceM}m` : ''}
                    </p>
                  ) : null}
                  {Array.isArray(d.photoIds) && d.photoIds.length > 0 ? (
                    <p>{d.photoIds.length} ảnh kèm theo</p>
                  ) : null}
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
      </CardContent>
    </Card>
  );
}

export function NhatKyHome() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Nhật ký &amp; cảnh báo</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          Mọi thay đổi dữ liệu đều để lại dấu vết: ai, khi nào, từ đâu, đến đâu, ảnh nào.
        </p>
      </div>
      <KhoiCanhBao />
      <KhoiNhatKy />
    </div>
  );
}
