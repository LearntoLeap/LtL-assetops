import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, RefreshCw, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import { NHAN_LOAI_YEU_CAU, NHAN_TRANG_THAI_YEU_CAU } from '@ltl/taisan-shared';
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
import type { TrangDuLieu, YeuCau } from '@/lib/kieu';
import { MAU_TRANG_THAI } from './tien-ich';

/**
 * THÙNG RÁC YÊU CẦU — chỉ ADMIN.
 *
 * Phiếu ở đây đã biến khỏi mọi danh sách và mọi con số, nhưng NHỮNG GÌ ĐÃ XẢY
 * RA THÌ VẪN NGUYÊN: bút toán di chuyển, ảnh chụp lúc xuất–nhập, biên bản đã
 * ký và tồn kho không đổi một đơn vị nào. Xoá phiếu là dọn giấy tờ, không phải
 * gọi hàng về kho.
 *
 * Đó cũng là lý do "xoá hẳn" ở đây an toàn hơn so với xoá hẳn một điểm lưu trữ:
 * phiếu không phải là nguồn của tồn kho, nên bỏ nó đi không làm số nào lệch.
 */
export function ThungRacYeuCau() {
  const [muc, datMuc] = useState<YeuCau[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [dangChay, datDangChay] = useState(false);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<TrangDuLieu<YeuCau>>('/api/yeu-cau/thung-rac?moiTrang=100');
      datMuc(kq.muc);
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được thùng rác.');
    } finally {
      datDangTai(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  async function chay(
    duongDan: string,
    xacNhan: string,
    // Khôi phục là POST, xoá hẳn là DELETE — gọi sai phương thức thì ra 404.
    phuongThuc: 'POST' | 'DELETE' = 'POST',
  ): Promise<void> {
    if (!window.confirm(xacNhan)) return;
    datLoi(null);
    datThongBao(null);
    datDangChay(true);
    try {
      const kq = await goiApi<{ ok: true; thongDiep: string }>(duongDan, {
        method: phuongThuc,
        ...(phuongThuc === 'POST' ? { than: {} } : {}),
      });
      datThongBao(kq.thongDiep);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Thao tác thất bại.');
    } finally {
      datDangChay(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to="/yeu-cau">
            <ArrowLeft aria-hidden />
            Về danh sách yêu cầu
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">Thùng rác — Yêu cầu</h1>
        <p className="text-sm text-muted-foreground">
          Phiếu đã xoá. Khôi phục lại được, hoặc xoá hẳn khỏi cơ sở dữ liệu.
        </p>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}

      <Alert variant="info" tieuDe="Xoá phiếu không làm hàng quay về kho">
        Bút toán di chuyển, ảnh chụp lúc xuất–nhập và tồn kho giữ nguyên — hàng đã ra khỏi kho thì
        vẫn ở ngoài kho. Muốn đưa hàng về thì lập yêu cầu nhập kho, không phải khôi phục phiếu này.
      </Alert>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Đang trong thùng rác ({muc.length})</CardTitle>
            <CardDescription>Mới xoá xếp lên đầu.</CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
            <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
          </Button>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {dangTai && muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
          ) : muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Thùng rác trống.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số yêu cầu</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Nơi đến</TableHead>
                    <TableHead className="text-right">Số dòng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Xoá lúc</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muc.map((y) => (
                    <TableRow key={y.id}>
                      <TableCell className="whitespace-nowrap font-mono text-sm font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <ClipboardList className="size-3.5 shrink-0" aria-hidden />
                          {y.code}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {NHAN_LOAI_YEU_CAU[y.type]}
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
                        {y.deletedAt ? ngayGio(y.deletedAt) : '—'}
                        {y.deletedBy ? (
                          <span className="block text-xs">bởi {y.deletedBy.fullName}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={dangChay}
                            onClick={() =>
                              void chay(
                                `/api/yeu-cau/${y.id}/khoi-phuc`,
                                `Khôi phục yêu cầu ${y.code} về danh sách?`,
                              )
                            }
                          >
                            <Undo2 aria-hidden />
                            Khôi phục
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive-dam"
                            disabled={dangChay}
                            onClick={() =>
                              void chay(
                                `/api/yeu-cau/${y.id}/vinh-vien`,
                                `XOÁ HẲN yêu cầu ${y.code} khỏi cơ sở dữ liệu?\n\n` +
                                  'Không khôi phục lại được. Bút toán di chuyển, ảnh và tồn kho ' +
                                  'vẫn giữ nguyên — chỉ mất tờ phiếu.',
                                'DELETE',
                              )
                            }
                          >
                            <Trash2 aria-hidden />
                            Xoá hẳn
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        Chỉ tài khoản quản trị vào được trang này. Máy chủ kiểm lại quyền ở mọi thao tác, không
        phải chỉ ẩn nút.
      </p>
    </div>
  );
}
