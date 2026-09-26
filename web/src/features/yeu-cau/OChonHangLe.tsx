import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { goiApi } from '@/lib/api';

interface DiemCoHang {
  locationId: string;
  ten: string;
  /** Tồn theo sổ (suy từ nhật ký di chuyển). */
  ton: number;
  /** Đã mang ra khỏi điểm này nhưng bên nhận chưa xác nhận. */
  dangDi: number;
  /** Thật sự còn lấy được = tồn − đang đi. */
  khaDung: number;
}

interface DongHangLe {
  id: string;
  code: string;
  name: string;
  category: { id: string; name: string };
  currentLocation: { id: string; name: string } | null;
  ton: number;
  dangDi: number;
  khaDung: number;
  tongTon: number;
  theoDiem: DiemCoHang[];
}

interface Props {
  /** Chỉ tìm hàng lẻ đang ở điểm này; bỏ trống thì tìm toàn hệ thống. */
  locationId?: string | undefined;
  /** Người dùng chọn một dòng — trả về MÃ để ghép vào danh sách chung của phiếu. */
  onChon: (t: { code: string; name: string; ton: number }) => void;
  /** Mã đã có trong phiếu, để đánh dấu "đã thêm". */
  daThem: ReadonlySet<string>;
}

/**
 * Ô chọn HÀNG LẺ — sách, cờ, standee, ấn phẩm in…
 *
 * Những thứ này không dán mã lên từng cái được, nên người dùng tìm theo TÊN.
 * Bên dưới chúng vẫn là thiết bị quản lý theo số lượng trong cùng một sổ tồn
 * kho, nên lấy ra bao nhiêu – trả về bao nhiêu vẫn đối chiếu được như thường.
 *
 * Hiện TỒN ngay cạnh tên: xin 50 quyển mà kho chỉ còn 12 thì phải biết trước
 * lúc lập phiếu, đừng để tới lúc ra kho mới phát hiện.
 *
 * Con số hiện ra là SỐ THẬT SỰ LẤY ĐƯỢC, không phải tổng toàn hệ thống. Một mã
 * hàng lẻ nằm rải nhiều nơi, mà chuyển 30 quyển từ kho về trường thì tổng toàn
 * hệ thống vẫn nguyên 100 — nhìn vào tưởng kho chưa bị trừ gì. Nên bên dưới
 * tách rõ từng điểm còn bao nhiêu, và trừ sẵn phần đã lên xe đi nhưng bên nhận
 * chưa xác nhận.
 */
export function OChonHangLe({ locationId, onChon, daThem }: Props) {
  const [tuKhoa, datTuKhoa] = useState('');
  const [muc, datMuc] = useState<DongHangLe[]>([]);
  const [dangTim, datDangTim] = useState(false);

  useEffect(() => {
    let conDung = true;
    const hen = setTimeout(async () => {
      datDangTim(true);
      try {
        const q = new URLSearchParams({
          ...(tuKhoa.trim() ? { tuKhoa: tuKhoa.trim() } : {}),
          ...(locationId ? { locationId } : {}),
          moiTrang: '20',
        });
        const kq = await goiApi<{ ok: true; muc: DongHangLe[] }>(
          `/api/thiet-bi/hang-le?${q.toString()}`,
        );
        if (conDung) datMuc(kq.muc);
      } catch {
        if (conDung) datMuc([]);
      } finally {
        if (conDung) datDangTim(false);
      }
    }, 200);
    return () => {
      conDung = false;
      clearTimeout(hen);
    };
  }, [tuKhoa, locationId]);

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="pl-8"
          placeholder="Tìm theo tên: sách, cờ, standee…"
          value={tuKhoa}
          onChange={(su) => datTuKhoa(su.target.value)}
          aria-label="Tìm hàng lẻ theo tên"
        />
      </div>

      {dangTim && muc.length === 0 ? (
        <p className="text-sm text-muted-foreground">Đang tìm…</p>
      ) : muc.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tuKhoa.trim()
            ? 'Không có hàng lẻ nào khớp. Hàng lẻ là thiết bị quản lý “Theo số lượng”.'
            : 'Chưa có hàng lẻ nào trong kho.'}
        </p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-auto">
          {muc.map((t) => {
            const roi = daThem.has(t.code);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={roi || t.khaDung <= 0}
                  onClick={() => onChon({ code: t.code, name: t.name, ton: t.khaDung })}
                  className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.category.name}
                    </span>
                    {/* Nằm rải mấy nơi thì phải nói rõ nơi nào còn bao nhiêu. */}
                    {t.theoDiem.length > 0 ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.theoDiem
                          .map(
                            (d) =>
                              `${d.ten}: ${d.khaDung}${d.dangDi > 0 ? ` (đang đi ${d.dangDi})` : ''}`,
                          )
                          .join(' · ')}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    {/* Hết hàng thì nói thẳng, đừng để bấm vào rồi mới báo. */}
                    <span
                      className={`block text-xs tabular-nums ${
                        t.khaDung <= 0 ? 'text-destructive-dam' : 'text-muted-foreground'
                      }`}
                    >
                      {t.khaDung <= 0 ? 'Hết hàng' : `Lấy được ${t.khaDung}`}
                    </span>
                    {t.dangDi > 0 ? (
                      <span className="block text-xs tabular-nums text-warning-dam">
                        đang đi {t.dangDi}
                      </span>
                    ) : null}
                    {roi ? (
                      <span className="block text-xs text-success-dam">Đã thêm</span>
                    ) : t.khaDung > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary-dam">
                        <Plus className="size-3" aria-hidden />
                        Thêm
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
