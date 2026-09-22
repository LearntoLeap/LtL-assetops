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

interface KetQuaLo {
  ok: true;
  soThanhCong: number;
  boQua: Array<{ ma: string | null; lyDo: string }>;
  thongDiep: string;
}

/** Câu người dùng phải gõ lại để xoá vĩnh viễn cả lô. */
const CAU_XAC_NHAN = 'XOÁ VĨNH VIỄN';

/**
 * So câu xác nhận mà bỏ qua dấu và hoa/thường.
 *
 * Hiện ra thì phải có dấu, nhưng bắt gõ đúng cả dấu trong hộp thoại của trình
 * duyệt là làm khó vô ích — nhiều người gõ không dấu theo phản xạ. Việc cần là
 * buộc họ ĐỌC, chứ không phải thi chính tả.
 */
function khopCauXacNhan(nhapVao: string): boolean {
  const gon = (v: string): string =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  return gon(nhapVao) === gon(CAU_XAC_NHAN);
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
 *   - Xoá vĩnh viễn: phải GÕ LẠI (đúng mã thiết bị khi xoá một cái, hoặc câu
 *     "XOÁ VĨNH VIỄN" khi xoá cả lô). Bấm "OK" cho một hộp thoại là phản xạ, gõ
 *     lại thì phải đọc xem mình đang xoá cái gì. Đây là đường duy nhất trong hệ
 *     thống làm mất hẳn dữ liệu.
 *
 * Cả hai đều làm được hàng loạt. Dọn thùng rác 40 thiết bị mà phải bấm 40 lần
 * thì người ta sẽ bỏ, rồi thùng rác phình ra và mã cũ bị giữ mãi.
 */
export function ThungRacThietBi() {
  const [muc, datMuc] = useState<DongRac[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  /** Thiết bị đang tick — chỉ cần ID, trang này không in nhãn. */
  const [daChon, datDaChon] = useState<Set<string>>(new Set());
  const [dangChay, datDangChay] = useState(false);

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

  // Dòng đã khôi phục / xoá hẳn thì không còn trong bảng — giữ tick của nó lại
  // sẽ làm con số "Đã chọn N" nói sai, và lần bấm sau gửi ID đã chết lên API.
  useEffect(() => {
    datDaChon((cu) => {
      const con = new Set([...cu].filter((id) => muc.some((t) => t.id === id)));
      return con.size === cu.size ? cu : con;
    });
  }, [muc]);

  const doiChon = (id: string): void =>
    datDaChon((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });

  const daChonHet = muc.length > 0 && muc.every((t) => daChon.has(t.id));
  const doiChonHet = (): void =>
    datDaChon(daChonHet ? new Set() : new Set(muc.map((t) => t.id)));

  /** Chạy một tuyến hàng loạt rồi báo lại cả phần bỏ sót. */
  async function chayLo(duong: string, ids: string[]): Promise<void> {
    datLoi(null);
    datThongBao(null);
    datDangChay(true);
    try {
      const kq = await goiApi<KetQuaLo>(`/api/thiet-bi/${duong}`, {
        method: 'POST',
        than: { ids },
      });
      datDaChon(new Set());
      await tai();
      datThongBao(kq.thongDiep);
      // Lô 30 cái mà 2 cái vướng thì phải biết đúng 2 cái nào, không thể chỉ nói "xong".
      if (kq.boQua.length > 0) {
        datLoi(
          `Bỏ qua ${kq.boQua.length}: ` +
            kq.boQua.map((b) => `${b.ma ?? '?'} (${b.lyDo})`).join('; '),
        );
      }
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Thao tác hàng loạt thất bại.');
    } finally {
      datDangChay(false);
    }
  }

  async function khoiPhucLo(): Promise<void> {
    const ids = [...daChon];
    if (ids.length === 0) return;
    if (!window.confirm(`Khôi phục ${ids.length} thiết bị đã chọn về danh sách thiết bị?`)) return;
    await chayLo('khoi-phuc-nhieu', ids);
  }

  async function xoaVinhVienLo(): Promise<void> {
    const ids = [...daChon];
    if (ids.length === 0) return;
    const goi = window.prompt(
      `XOÁ VĨNH VIỄN ${ids.length} thiết bị đã chọn?\n\n` +
        'Sẽ mất hẳn: bản ghi thiết bị, toàn bộ nhật ký di chuyển, ảnh, dòng trong ' +
        'yêu cầu / biên bản / kiểm kê. KHÔNG khôi phục lại được.\n\n' +
        `Gõ "${CAU_XAC_NHAN}" để xác nhận:`,
    );
    if (goi === null) return;
    if (!khopCauXacNhan(goi)) {
      datLoi(`Câu gõ vào không khớp "${CAU_XAC_NHAN}" — không xoá gì cả.`);
      return;
    }
    await chayLo('xoa-vinh-vien-nhieu', ids);
  }

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
            <>
              {/* Thanh này chỉ hiện khi đã tick — không chiếm chỗ lúc chưa dùng. */}
              {daChon.size > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2.5 sm:gap-3">
                  <span className="text-sm font-medium">Đã chọn {daChon.size} thiết bị</span>
                  <Button size="sm" onClick={() => void khoiPhucLo()} disabled={dangChay}>
                    <Undo2 aria-hidden />
                    {dangChay ? 'Đang chạy…' : `Khôi phục ${daChon.size}`}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void xoaVinhVienLo()}
                    disabled={dangChay}
                  >
                    <Trash2 aria-hidden />
                    Xoá vĩnh viễn {daChon.size}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => datDaChon(new Set())}>
                    Bỏ chọn
                  </Button>
                </div>
              ) : null}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={daChonHet}
                        onChange={doiChonHet}
                        aria-label="Chọn mọi thiết bị trong thùng rác"
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </TableHead>
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
                        <input
                          type="checkbox"
                          checked={daChon.has(t.id)}
                          onChange={() => doiChon(t.id)}
                          aria-label={`Chọn ${t.code}`}
                          className="size-4 cursor-pointer accent-primary"
                        />
                      </TableCell>
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
            </>
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
