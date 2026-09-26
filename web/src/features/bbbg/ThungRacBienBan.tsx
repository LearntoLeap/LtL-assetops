import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSignature, RefreshCw, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import { NHAN_MAU_BBBG, NHAN_TRANG_THAI_BBBG } from '@ltl/taisan-shared';
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
import type { BienBan, TrangDuLieu } from '@/lib/kieu';
import { MAU_TRANG_THAI_BBBG } from './tien-ich';

/**
 * THÙNG RÁC BIÊN BẢN BÀN GIAO — chỉ ADMIN.
 *
 * XOÁ BIÊN BẢN KHÔNG HOÀN TÁC VIỆC BÀN GIAO. Với biên bản đã được bên nhận xác
 * nhận, chính cú bấm xác nhận đó đã ghi bút toán di chuyển và đổi vị trí thiết
 * bị — bỏ tờ giấy đi thì thiết bị vẫn nằm ở nơi đã nhận.
 *
 * "Xoá hẳn" xoá luôn cả FILE MỀM .docx trên ổ đĩa, nên bản Word đã tải về máy
 * trước đó là bản duy nhất còn lại.
 */
export function ThungRacBienBan() {
  const [muc, datMuc] = useState<BienBan[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [dangChay, datDangChay] = useState(false);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<TrangDuLieu<BienBan>>('/api/bbbg/thung-rac?moiTrang=100');
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
          <Link to="/bbbg">
            <ArrowLeft aria-hidden />
            Về danh sách biên bản
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">Thùng rác — Biên bản bàn giao</h1>
        <p className="text-sm text-muted-foreground">
          Biên bản đã xoá. Khôi phục lại được, hoặc xoá hẳn khỏi cơ sở dữ liệu.
        </p>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}

      <Alert variant="info" tieuDe="Xoá biên bản không hoàn tác việc bàn giao">
        Biên bản đã được bên nhận xác nhận thì việc bàn giao đã xảy ra thật: thiết bị vẫn ở nơi đã
        nhận, tồn kho giữ nguyên. Muốn đưa thiết bị về thì lập yêu cầu trả về kho.
        <span className="mt-1 block">
          &quot;Xoá hẳn&quot; xoá luôn file Word trên máy chủ — bản đã tải về máy là bản duy nhất
          còn lại.
        </span>
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
                    <TableHead>Số biên bản</TableHead>
                    <TableHead>Mẫu</TableHead>
                    <TableHead>Đơn vị nhận</TableHead>
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
                          <FileSignature className="size-3.5 shrink-0" aria-hidden />
                          {y.code}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {NHAN_MAU_BBBG[y.templateType]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {y.receiverLocation?.name ?? y.receiverOrg}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{y.items.length}</TableCell>
                      <TableCell>
                        <Badge variant={MAU_TRANG_THAI_BBBG[y.status]}>
                          {NHAN_TRANG_THAI_BBBG[y.status]}
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
                                `/api/bbbg/${y.id}/khoi-phuc`,
                                `Khôi phục biên bản ${y.code} về danh sách?`,
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
                                `/api/bbbg/${y.id}/vinh-vien`,
                                `XOÁ HẲN biên bản ${y.code} và file Word của nó?\n\n` +
                                  'Không khôi phục lại được. Vị trí thiết bị và tồn kho vẫn giữ ' +
                                  'nguyên — chỉ mất chứng từ.',
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
