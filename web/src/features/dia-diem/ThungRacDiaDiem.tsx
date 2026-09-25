import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, RefreshCw, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import { NHAN_LOAI_DIEM_LUU_TRU } from '@ltl/taisan-shared';
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
import type { DiaDiem } from '@/lib/kieu';

interface DongRac extends DiaDiem {
  deletedAt: string;
  deletedBy: { id: string; fullName: string } | null;
  _count?: { assets: number };
}

/**
 * THÙNG RÁC ĐIỂM LƯU TRỮ — chỉ ADMIN.
 *
 * Điểm ở đây đã biến khỏi mọi danh sách và mọi ô chọn nơi đến, nhưng bản ghi
 * vẫn nguyên: thiết bị đang ở đó, nhật ký xuất–nhập kho, biên bản và kiểm kê cũ
 * vẫn đọc được TÊN của điểm. Khôi phục là về đúng nguyên trạng.
 *
 * "Xoá hẳn" thì xoá luôn, không điều kiện — và THIẾT BỊ KHÔNG MẤT: chúng chỉ
 * trống ô vị trí để điền lại. Cái mất theo là nhật ký xuất–nhập kho và đợt kiểm
 * kê TẠI ĐIỂM ĐÓ, nên tồn của thiết bị chỉ từng nằm ở đây sẽ về 0. Lời xác nhận
 * phải nói rõ cả hai vế đó, không được chỉ nói "không khôi phục được".
 */
export function ThungRacDiaDiem() {
  const [muc, datMuc] = useState<DongRac[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<{ ok: true; muc: DongRac[]; tong: number }>(
        '/api/dia-diem/thung-rac',
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

  async function khoiPhuc(d: DongRac): Promise<void> {
    if (!window.confirm(`Khôi phục điểm ${d.name} về danh sách?`)) return;
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true; thongDiep: string }>(`/api/dia-diem/${d.id}/khoi-phuc`, {
        method: 'POST',
        than: {},
      });
      datThongBao(kq.thongDiep);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Khôi phục thất bại.');
    }
  }

  async function xoaVinhVien(d: DongRac): Promise<void> {
    // Bắt gõ lại mã: đây là đường duy nhất làm mất hẳn một điểm lưu trữ.
    const soTb = d._count?.assets ?? 0;
    const goi = window.prompt(
      `XOÁ VĨNH VIỄN điểm ${d.code} — ${d.name}?\n\n` +
        (soTb > 0
          ? `${soTb} thiết bị đang ở đây VẪN CÒN NGUYÊN, chỉ trống ô vị trí để bạn nhập lại kho.\n\n`
          : '') +
        'Sẽ mất hẳn: bản ghi điểm, toàn bộ nhật ký xuất–nhập kho và các đợt kiểm ' +
        'kê TẠI ĐIỂM NÀY. Tồn kho của thiết bị chỉ từng nằm ở đây sẽ về 0 — nhập ' +
        'lại kho là có tồn trở lại. KHÔNG khôi phục lại được.\n\n' +
        `Gõ đúng mã "${d.code}" để xác nhận:`,
    );
    if (goi === null) return;
    if (goi.trim().toUpperCase() !== d.code.toUpperCase()) {
      datLoi(`Mã gõ vào không khớp "${d.code}" — không xoá gì cả.`);
      return;
    }
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true; thongDiep: string }>(`/api/dia-diem/${d.id}/vinh-vien`, {
        method: 'DELETE',
      });
      datThongBao(kq.thongDiep);
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
            <Link to="/dia-diem">
              <ArrowLeft aria-hidden />
              Về danh sách điểm lưu trữ
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            <Undo2 className="size-6 text-primary-dam" aria-hidden />
            Thùng rác điểm lưu trữ
          </h1>
          <p className="text-sm text-muted-foreground">
            Điểm đã xoá — không hiện ở danh sách nào và không chọn được làm nơi đến, nhưng khôi
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
          <CardTitle>Đang có {muc.length} điểm trong thùng rác</CardTitle>
          <CardDescription>
            Mã của điểm trong thùng rác VẪN bị giữ — muốn tạo lại đúng mã đó thì phải khôi phục
            hoặc xoá vĩnh viễn trước.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dangTai && muc.length === 0 ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : muc.length === 0 ? (
            <div className="space-y-2 py-8 text-center">
              <MapPin className="mx-auto size-10 text-muted-foreground/40" aria-hidden />
              <p className="font-medium">Thùng rác trống.</p>
              <p className="text-sm text-muted-foreground">
                Điểm xoá ở danh sách sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã / Tên</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Địa chỉ</TableHead>
                  <TableHead className="text-right">Thiết bị còn ở đây</TableHead>
                  <TableHead>Ai xoá · lúc nào</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {muc.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="block font-mono text-sm font-medium">{d.code}</span>
                      <span className="text-xs text-muted-foreground">{d.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{NHAN_LOAI_DIEM_LUU_TRU[d.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.address ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {d._count?.assets ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.deletedBy?.fullName ?? '—'}
                      <span className="block">{ngayGio(d.deletedAt)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => void khoiPhuc(d)}>
                          <Undo2 aria-hidden />
                          Khôi phục
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive-dam hover:bg-destructive/10"
                          onClick={() => void xoaVinhVien(d)}
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

      <Alert variant="warning" tieuDe="“Xoá hẳn” mất gì và giữ gì">
        <span className="inline-flex items-center gap-1">
          <ShieldAlert className="size-4" aria-hidden />
        </span>{' '}
        <strong>Thiết bị không mất</strong> — chúng chỉ trống ô vị trí, vào Thiết bị nhập lại kho
        là xong. <strong>Mất hẳn</strong> là bản ghi điểm, toàn bộ nhật ký xuất–nhập kho và các
        đợt kiểm kê tại điểm này, nên tồn kho của thiết bị chỉ từng nằm ở đây sẽ về 0. Tài khoản,
        yêu cầu và biên bản vẫn còn, chỉ trống ô địa điểm. Không có đường lùi trong ứng dụng —
        chỉ còn cách phục hồi từ bản sao lưu của máy chủ.
      </Alert>
    </div>
  );
}
