import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import { NHAN_TINH_TRANG, NHAN_TRANG_THAI_PHAN_BO } from '@ltl/taisan-shared';
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
import type { ThietBi } from '@/lib/kieu';

interface DongRac extends ThietBi {
  deletedAt: string;
  deletedBy: { id: string; fullName: string } | null;
}

/**
 * THÙNG RÁC THIẾT BỊ — chỉ ADMIN.
 *
 * Thiết bị xoá ở đây đã biến khỏi mọi danh sách, mọi báo cáo, và không còn tính
 * vào tồn kho, nhưng bản ghi cùng toàn bộ nhật ký di chuyển, ảnh và chứng từ vẫn
 * nguyên — nên khôi phục là về đúng nguyên trạng trước khi xoá.
 *
 * Hai thao tác, cố ý khác nhau về độ nặng:
 *   - Khôi phục: một lần xác nhận;
 *   - Xoá vĩnh viễn: phải GÕ ĐÚNG MÃ thiết bị. Bấm "OK" cho một hộp thoại là
 *     phản xạ, gõ lại mã thì phải đọc xem mình đang xoá cái gì. Đây là đường duy
 *     nhất trong hệ thống làm mất hẳn dữ liệu.
 */
export function ThungRacThietBi() {
  const [muc, datMuc] = useState<DongRac[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<{ ok: true; muc: DongRac[]; tong: number }>(
        '/api/thiet-bi/thung-rac',
      );
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

  async function khoiPhuc(t: DongRac): Promise<void> {
    if (!window.confirm(`Khôi phục ${t.code} — ${t.name} về danh sách thiết bị?`)) return;
    datLoi(null);
    try {
      await goiApi(`/api/thiet-bi/${t.id}/khoi-phuc`, { method: 'POST', than: {} });
      datThongBao(`Đã khôi phục ${t.code}.`);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Khôi phục thất bại.');
    }
  }

  async function xoaVinhVien(t: DongRac): Promise<void> {
    // Bắt gõ lại mã: đây là đường duy nhất làm mất hẳn dữ liệu, bấm OK theo phản
    // xạ thì không đọc, gõ lại mã thì buộc phải nhìn xem mình đang xoá cái gì.
    const goi = window.prompt(
      `XOÁ VĨNH VIỄN ${t.code} — ${t.name}?\n\n` +
        'Sẽ mất hẳn: bản ghi thiết bị, toàn bộ nhật ký di chuyển, ảnh, dòng trong ' +
        'yêu cầu / biên bản / kiểm kê. KHÔNG khôi phục lại được.\n\n' +
        `Gõ đúng mã "${t.code}" để xác nhận:`,
    );
    if (goi === null) return;
    if (goi.trim().toUpperCase() !== t.code.toUpperCase()) {
      datLoi(`Mã gõ vào không khớp "${t.code}" — không xoá gì cả.`);
      return;
    }
    datLoi(null);
    try {
      await goiApi(`/api/thiet-bi/${t.id}/vinh-vien`, { method: 'DELETE' });
      datThongBao(`Đã xoá vĩnh viễn ${t.code}.`);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá vĩnh viễn thất bại.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button variant="ghost" asChild className="mb-1 -ml-3">
            <Link to="/thiet-bi">
              <ArrowLeft aria-hidden />
              Về danh sách thiết bị
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            <Undo2 className="size-6 text-primary-dam" aria-hidden />
            Thùng rác thiết bị
          </h1>
          <p className="text-sm text-muted-foreground">
            Thiết bị đã xoá — không hiện ở danh sách nào và không tính vào tồn kho, nhưng khôi
            phục lại được nguyên trạng.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
          <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
        </Button>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Đang có {muc.length} thiết bị trong thùng rác</CardTitle>
          <CardDescription>
            Mã của thiết bị trong thùng rác VẪN bị giữ — muốn tạo lại đúng mã đó thì phải xoá
            vĩnh viễn trước.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dangTai && muc.length === 0 ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : muc.length === 0 ? (
            <div className="space-y-2 py-8 text-center">
              <Undo2 className="mx-auto size-10 text-muted-foreground/40" aria-hidden />
              <p className="font-medium">Thùng rác trống.</p>
              <p className="text-sm text-muted-foreground">
                Thiết bị xoá ở danh sách sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã / Tên</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Lúc xoá còn ở</TableHead>
                  <TableHead>Tình trạng</TableHead>
                  <TableHead>Ai xoá · lúc nào</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {muc.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="block font-mono text-sm font-medium">{t.code}</span>
                      <span className="text-xs text-muted-foreground">{t.name}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.category.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.currentLocation?.name ?? (t.holder ? `Giữ: ${t.holder.fullName}` : '—')}
                      <span className="block text-xs">
                        {NHAN_TRANG_THAI_PHAN_BO[t.allocationStatus]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{NHAN_TINH_TRANG[t.condition]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.deletedBy?.fullName ?? '—'}
                      <span className="block">{ngayGio(t.deletedAt)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => void khoiPhuc(t)}>
                          <Undo2 aria-hidden />
                          Khôi phục
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive-dam hover:bg-destructive/10"
                          onClick={() => void xoaVinhVien(t)}
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
          )}
        </CardContent>
      </Card>

      <Alert variant="warning" tieuDe="Xoá vĩnh viễn là mất hẳn">
        <span className="inline-flex items-center gap-1">
          <ShieldAlert className="size-4" aria-hidden />
        </span>{' '}
        Nút &ldquo;Xoá hẳn&rdquo; xoá luôn bản ghi thiết bị, toàn bộ nhật ký di chuyển, ảnh và
        các dòng trong yêu cầu / biên bản / kiểm kê. Không có đường lùi trong ứng dụng — chỉ còn
        cách phục hồi từ bản sao lưu của máy chủ.
      </Alert>
    </div>
  );
}
