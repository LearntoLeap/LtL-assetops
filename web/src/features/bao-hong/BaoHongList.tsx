import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { NHAN_TINH_TRANG, NHAN_TRANG_THAI_YEU_CAU } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { PhieuBaoHong, TrangDuLieu } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';
import { MAU_TRANG_THAI } from '@/features/yeu-cau/tien-ich';

export function BaoHongList() {
  const [muc, datMuc] = useState<PhieuBaoHong[]>([]);
  const [dangMo, datDangMo] = useState(true);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const kq = await goiApi<TrangDuLieu<PhieuBaoHong>>(
        `/api/bao-hong?dangMo=${dangMo ? 'true' : 'false'}&moiTrang=50`,
      );
      datMuc(kq.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách phiếu báo hỏng.');
    } finally {
      datDangTai(false);
    }
  }, [dangMo]);

  useEffect(() => {
    void tai();
  }, [tai]);

  useRealtime([SU_KIEN.CANH_BAO_MOI, SU_KIEN.YEU_CAU_DOI], () => {
    void tai();
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Báo hỏng thiết bị</h1>
          <p className="text-sm text-muted-foreground">
            Mỗi phiếu gắn đúng một mã thiết bị và bắt buộc có ảnh chụp chỗ hỏng.
          </p>
        </div>
        <Button asChild>
          <Link to="/bao-hong/moi">
            <Plus aria-hidden />
            Báo hỏng
          </Link>
        </Button>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{dangMo ? 'Phiếu đang mở' : 'Phiếu đã đóng'} ({muc.length})</CardTitle>
          <CardDescription>
            {dangMo
              ? 'Phiếu chờ duyệt và đã duyệt nhưng chưa xử lý xong.'
              : 'Phiếu đã xử lý xong hoặc bị từ chối.'}
          </CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant={dangMo ? 'default' : 'outline'}
              size="sm"
              onClick={() => datDangMo(true)}
            >
              Đang mở
            </Button>
            <Button
              variant={dangMo ? 'outline' : 'default'}
              size="sm"
              onClick={() => datDangMo(false)}
            >
              Đã đóng
            </Button>
            <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
              <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {dangTai && muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
          ) : muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">
              {dangMo ? 'Không có phiếu báo hỏng nào đang mở.' : 'Chưa có phiếu nào đã đóng.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Số phiếu</TableHead>
                  <TableHead>Thiết bị</TableHead>
                  <TableHead>Nơi đặt</TableHead>
                  <TableHead>Người báo</TableHead>
                  <TableHead className="text-right">Ảnh</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Báo lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {muc.map((p) => {
                  const tb = p.items[0]?.asset;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          to={`/bao-hong/${p.id}`}
                          className="flex items-center gap-1.5 font-mono text-sm font-medium text-primary-dam hover:underline"
                        >
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          {p.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tb ? (
                          <>
                            <span className="font-mono text-sm text-foreground">{tb.code}</span>
                            <span className="block text-xs">
                              {tb.name} · {NHAN_TINH_TRANG[tb.condition]}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tb?.currentLocation?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.createdBy.fullName}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.photos.length}
                      </TableCell>
                      <TableCell>
                        <Badge variant={MAU_TRANG_THAI[p.status]}>
                          {NHAN_TRANG_THAI_YEU_CAU[p.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ngayGio(p.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
