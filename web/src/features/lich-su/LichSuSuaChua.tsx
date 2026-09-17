import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, History, MapPin, RefreshCw, Wrench } from 'lucide-react';
import { NHAN_LOAI_DIEM_LUU_TRU, NHAN_TRANG_THAI_YEU_CAU } from '@ltl/taisan-shared';
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
import type { DongLichSuDiem, MocLichSu } from '@/lib/kieu';

/**
 * LỊCH SỬ SỬA CHỮA THEO ĐIỂM.
 *
 * Trả lời đúng một câu hỏi vận hành: "trường nào hay hỏng cái gì, và đã thay
 * những linh kiện nào". Gom theo VỊ TRÍ HIỆN TẠI của thiết bị, không theo nơi
 * lập phiếu — thiết bị đang ở đâu thì tính cho đó.
 *
 * Bảng tổng ở trên, bấm một dòng thì mở dòng thời gian của điểm đó bên dưới:
 * phiếu báo hỏng và phiếu lấy linh kiện trộn lẫn, mới nhất trước, để đọc được
 * cả câu chuyện "hỏng gì → thay gì" thay vì hai danh sách rời nhau.
 */
export function LichSuSuaChua() {
  const [bang, datBang] = useState<DongLichSuDiem[]>([]);
  const [chonDiem, datChonDiem] = useState<DongLichSuDiem | null>(null);
  const [moc, datMoc] = useState<MocLichSu[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [dangTaiMoc, datDangTaiMoc] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<{ ok: true; muc: DongLichSuDiem[] }>(
        '/api/bao-cao/lich-su-sua-chua',
      );
      datBang(kq.muc);
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được lịch sử.');
    } finally {
      datDangTai(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  async function moDiem(d: DongLichSuDiem): Promise<void> {
    datChonDiem(d);
    datMoc([]);
    datDangTaiMoc(true);
    try {
      const kq = await goiApi<{ ok: true; muc: MocLichSu[] }>(
        `/api/bao-cao/lich-su-sua-chua/chi-tiet?diaDiemId=${encodeURIComponent(d.diaDiemId)}`,
      );
      datMoc(kq.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được dòng thời gian.');
    } finally {
      datDangTaiMoc(false);
    }
  }

  const coSoLieu = bang.some((d) => d.soBaoHong > 0 || d.soPhieuLinhKien > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Lịch sử sửa chữa theo điểm</h1>
          <p className="text-sm text-muted-foreground">
            Trường nào hay hỏng cái gì, và đã thay những linh kiện nào.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
          <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
        </Button>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="text-primary" aria-hidden />
            Tổng hợp theo điểm
          </CardTitle>
          <CardDescription>
            Tính theo <strong>vị trí hiện tại</strong> của thiết bị, không theo nơi lập phiếu —
            thiết bị đang ở đâu thì tính cho đó. Bấm một dòng để xem chi tiết.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Điểm</TableHead>
                <TableHead className="text-right">Báo hỏng</TableHead>
                <TableHead className="text-right">Đang mở</TableHead>
                <TableHead className="text-right">Phiếu linh kiện</TableHead>
                <TableHead className="text-right">Linh kiện đã thay</TableHead>
                <TableHead>Lần gần nhất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bang.map((d) => (
                <TableRow
                  key={d.diaDiemId}
                  className={`cursor-pointer ${
                    chonDiem?.diaDiemId === d.diaDiemId ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => void moDiem(d)}
                >
                  <TableCell>
                    <p className="font-medium">{d.ten}</p>
                    <p className="text-xs text-muted-foreground">
                      {NHAN_LOAI_DIEM_LUU_TRU[d.loai as keyof typeof NHAN_LOAI_DIEM_LUU_TRU] ??
                        d.loai}
                    </p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.soBaoHong}</TableCell>
                  <TableCell className="text-right">
                    {d.soBaoHongDangMo > 0 ? (
                      <Badge variant="warning">{d.soBaoHongDangMo}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.soPhieuLinhKien}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {d.tongLinhKien}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.lanCuoi ? ngayGio(d.lanCuoi) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!dangTai && bang.length === 0 ? (
            <p className="px-5 py-3 text-sm text-muted-foreground sm:px-0">
              Không có điểm nào trong phạm vi của bạn.
            </p>
          ) : null}
          {!dangTai && bang.length > 0 && !coSoLieu ? (
            <p className="px-5 py-3 text-sm text-muted-foreground sm:px-0">
              Chưa có phiếu báo hỏng hay phiếu linh kiện nào — bảng sẽ tự có số khi phát sinh.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {chonDiem ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="text-primary" aria-hidden />
              {chonDiem.ten}
            </CardTitle>
            <CardDescription>
              Báo hỏng và lấy linh kiện trộn lẫn theo thời gian, mới nhất trước — đọc được cả
              câu chuyện &quot;hỏng gì → thay gì&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {dangTaiMoc ? (
              <p className="text-sm text-muted-foreground">Đang tải…</p>
            ) : moc.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Điểm này chưa có lần sửa chữa nào được ghi.
              </p>
            ) : (
              moc.map((m) => (
                <div
                  key={`${m.loai}-${m.id}`}
                  className={`rounded-lg border-l-4 border bg-card p-3 ${
                    m.loai === 'BAO_HONG' ? 'border-l-warning' : 'border-l-primary'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {m.loai === 'BAO_HONG' ? (
                      <AlertTriangle className="size-4 text-warning" aria-hidden />
                    ) : (
                      <Wrench className="size-4 text-primary" aria-hidden />
                    )}
                    <Link
                      to={m.loai === 'BAO_HONG' ? `/bao-hong/${m.id}` : '/linh-kien'}
                      className="font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {m.code}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">{m.maThietBi}</span>
                    {m.soLuong !== null ? <Badge variant="muted">{m.soLuong} cái</Badge> : null}
                    {m.lyDo ? <Badge variant="warning">{m.lyDo}</Badge> : null}
                    {m.trangThai ? (
                      <Badge
                        variant={m.trangThai === 'DA_HOAN_TAT' ? 'success' : 'warning'}
                      >
                        {NHAN_TRANG_THAI_YEU_CAU[
                          m.trangThai as keyof typeof NHAN_TRANG_THAI_YEU_CAU
                        ] ?? m.trangThai}
                      </Badge>
                    ) : null}
                    {m.soAnh > 0 ? <Badge variant="muted">{m.soAnh} ảnh</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm">{m.noiDung}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.tenThietBi} · {m.nguoi} · {ngayGio(m.luc)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
