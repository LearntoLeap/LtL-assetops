import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { DS_TINH_TRANG, type KieuQuanLy, type TinhTrang } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ChupAnh } from '@/components/ChupAnh';
import { OGoiYMaThietBi } from '@/components/OGoiYMaThietBi';
import { goiApi, LoiApi } from '@/lib/api';
import type { AnhDaTai } from '@/lib/anh';
import type { ThietBiTaiTruong } from '@/lib/kieu';

interface Dong {
  assetId: string;
  code: string;
  name: string;
  trackingType: KieuQuanLy;
  /** Số theo sổ tại trường — 0 với thiết bị thêm tay (thấy ở trường mà sổ không có). */
  tonTaiTruong: number;
  coGhi: boolean;
  condition: TinhTrang;
  seen: string;
  note: string;
}

function homNay(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * FORM CẬP NHẬT ONSITE: mỗi thiết bị đang ở trường một dòng, điền sẵn tình
 * trạng lần trước và số theo sổ để người ghi chỉ sửa chỗ khác. Thấy thiết bị
 * mà sổ không có thì thêm tay theo mã. Ảnh không bắt buộc nhưng nên có.
 */
export function FormOnsite() {
  const { locationId } = useParams<{ locationId: string }>();
  const dieuHuong = useNavigate();
  const [tenTruong, datTenTruong] = useState('');
  const [dong, datDong] = useState<Dong[]>([]);
  const [visitedAt, datVisitedAt] = useState(homNay());
  const [summary, datSummary] = useState('');
  const [anh, datAnh] = useState<AnhDaTai[]>([]);
  const [maThem, datMaThem] = useState('');
  const [loi, datLoi] = useState<string | null>(null);
  const [dangTai, datDangTai] = useState(true);
  const [dangGui, datDangGui] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    void (async () => {
      try {
        const kq = await goiApi<{
          ok: true;
          diem: { name: string };
          thietBi: ThietBiTaiTruong[];
        }>(`/api/onsite/diem/${locationId}`);
        datTenTruong(kq.diem.name);
        datDong(
          kq.thietBi.map((t) => ({
            assetId: t.id,
            code: t.code,
            name: t.name,
            trackingType: t.trackingType,
            tonTaiTruong: t.tonTaiTruong,
            coGhi: true,
            condition: t.ghiNhanGanNhat?.condition ?? t.condition,
            seen: String(t.tonTaiTruong),
            note: '',
          })),
        );
      } catch (e) {
        datLoi(e instanceof LoiApi ? e.message : 'Không tải được thiết bị của trường.');
      } finally {
        datDangTai(false);
      }
    })();
  }, [locationId]);

  function sua(i: number, thay: Partial<Dong>): void {
    datDong((cu) => cu.map((d, j) => (j === i ? { ...d, ...thay } : d)));
  }

  async function themTheoMa(ma: string): Promise<void> {
    const code = ma.trim().toUpperCase();
    if (!code) return;
    if (dong.some((d) => d.code === code)) {
      datLoi(`Mã ${code} đã có trong danh sách.`);
      return;
    }
    datLoi(null);
    try {
      const kq = await goiApi<{
        ok: true;
        thietBi: { id: string; code: string; name: string; trackingType: KieuQuanLy; condition: TinhTrang };
      }>(`/api/thiet-bi/tra-cuu/${encodeURIComponent(code)}`);
      const t = kq.thietBi;
      datDong((cu) => [
        ...cu,
        {
          assetId: t.id,
          code: t.code,
          name: t.name,
          trackingType: t.trackingType,
          tonTaiTruong: 0,
          coGhi: true,
          condition: t.condition,
          seen: '1',
          note: 'Thấy tại trường nhưng sổ không ghi ở đây',
        },
      ]);
      datMaThem('');
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tra được mã này.');
    }
  }

  async function gui(su: FormEvent): Promise<void> {
    su.preventDefault();
    if (!locationId) return;
    const chon = dong.filter((d) => d.coGhi);
    if (chon.length === 0) {
      datLoi('Chọn ít nhất một thiết bị để ghi nhận.');
      return;
    }
    datLoi(null);
    datDangGui(true);
    try {
      const kq = await goiApi<{ ok: true; lan: { id: string; code: string; soVanDe: number } }>(
        '/api/onsite',
        {
          method: 'POST',
          than: {
            locationId,
            visitedAt: new Date(visitedAt).toISOString(),
            ...(summary.trim() ? { summary: summary.trim() } : {}),
            muc: chon.map((d) => ({
              assetId: d.assetId,
              condition: d.condition,
              ...(d.seen.trim() !== '' ? { seenQuantity: Number(d.seen) } : {}),
              ...(d.note.trim() ? { note: d.note.trim() } : {}),
            })),
            anhIds: anh.map((a) => a.id),
          },
        },
      );
      dieuHuong(`/onsite/${locationId}`, {
        replace: true,
        state: {
          thongBao:
            `Đã lưu ${kq.lan.code}.` +
            (kq.lan.soVanDe > 0
              ? ` ${kq.lan.soVanDe} thiết bị cần để mắt — quản trị đã được báo.`
              : ' Không có thiết bị nào có vấn đề.'),
        },
      });
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Lưu cập nhật onsite thất bại.');
    } finally {
      datDangGui(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to={`/onsite/${locationId ?? ''}`}>
            <ArrowLeft aria-hidden />
            Về trang của trường
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">
          Cập nhật onsite{tenTruong ? ` · ${tenTruong}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ghi tình trạng và số lượng thấy tận mắt. Chỉ là ghi nhận — sổ kho không đổi; hỏng, mất
          hoặc số thấy khác số sổ thì quản trị được báo để xử lý.
        </p>
      </div>

      <form onSubmit={(su) => void gui(su)} className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="os-luc">Thời điểm xuống trường *</Label>
              <Input
                id="os-luc"
                type="datetime-local"
                required
                value={visitedAt}
                onChange={(su) => datVisitedAt(su.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="os-tom-tat">Ghi chú chung</Label>
              <textarea
                id="os-tom-tat"
                rows={2}
                maxLength={5000}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={summary}
                onChange={(su) => datSummary(su.target.value)}
                placeholder="VD: Phòng STEM gọn gàng, cô Hà phụ trách; 2 robot hết pin cần sạc."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thiết bị tại trường ({dong.filter((d) => d.coGhi).length} ghi nhận)</CardTitle>
            <CardDescription>
              Bỏ chọn thiết bị không kiểm lần này. Số &ldquo;thấy&rdquo; khác số sổ sẽ được đánh dấu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dangTai ? <p className="text-sm text-muted-foreground">Đang tải…</p> : null}
            {!dangTai && dong.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Theo sổ, trường chưa có thiết bị nào. Thấy thiết bị tại trường thì thêm theo mã bên
                dưới.
              </p>
            ) : null}
            <ul className="space-y-2">
              {dong.map((d, i) => {
                const lech = d.seen.trim() !== '' && Number(d.seen) !== d.tonTaiTruong;
                return (
                  <li
                    key={d.assetId}
                    className={`rounded-md border p-3 ${d.coGhi ? '' : 'opacity-60'}`}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <label className="flex min-w-48 flex-1 cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-[hsl(var(--chinh))]"
                          checked={d.coGhi}
                          onChange={(su) => sua(i, { coGhi: su.target.checked })}
                        />
                        <span className="min-w-0">
                          <span className="block font-mono text-sm">{d.code}</span>
                          <span className="block text-xs text-muted-foreground">
                            {d.name} · {d.trackingType === 'DON_VI' ? 'bộ' : 'hàng lẻ'} · sổ{' '}
                            {d.tonTaiTruong}
                          </span>
                        </span>
                      </label>
                      <Select
                        className="w-44"
                        value={d.condition}
                        onChange={(su) => sua(i, { condition: su.target.value as TinhTrang })}
                        disabled={!d.coGhi}
                        aria-label={`Tình trạng ${d.code}`}
                      >
                        {DS_TINH_TRANG.map((t) => (
                          <option key={t.ma} value={t.ma}>
                            {t.nhan}
                          </option>
                        ))}
                      </Select>
                      <div className="w-24">
                        <Input
                          inputMode="numeric"
                          value={d.seen}
                          onChange={(su) => sua(i, { seen: su.target.value.replace(/\D/g, '') })}
                          disabled={!d.coGhi}
                          aria-label={`Số thấy ${d.code}`}
                          className={lech ? 'border-warning tabular-nums' : 'tabular-nums'}
                        />
                        <span className="text-xs text-muted-foreground">số thấy</span>
                      </div>
                      <Input
                        className="min-w-48 flex-1"
                        value={d.note}
                        onChange={(su) => sua(i, { note: su.target.value })}
                        disabled={!d.coGhi}
                        maxLength={500}
                        placeholder="Ghi chú (vd thiếu 1 cảm biến)"
                        aria-label={`Ghi chú ${d.code}`}
                      />
                      {d.tonTaiTruong === 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive-dam"
                          onClick={() => datDong((cu) => cu.filter((_, j) => j !== i))}
                          aria-label={`Bỏ ${d.code}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-end gap-2 border-t pt-3">
              <div className="min-w-56 flex-1 space-y-1">
                <Label>Thấy thiết bị khác tại trường (sổ không ghi ở đây)</Label>
                <OGoiYMaThietBi
                  className="font-mono"
                  placeholder="Gõ mã thiết bị…"
                  giaTri={maThem}
                  onDoi={datMaThem}
                  onChot={(v) => void themTheoMa(v)}
                  ariaLabel="Mã thiết bị thêm"
                />
              </div>
              <Button type="button" variant="outline" onClick={() => void themTheoMa(maThem)}>
                <Plus aria-hidden />
                Thêm
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ảnh tại trường</CardTitle>
          </CardHeader>
          <CardContent>
            <ChupAnh
              kind="ONSITE"
              anh={anh}
              onDoiAnh={datAnh}
              toiDa={10}
              batBuoc={false}
              moTa="Không bắt buộc, nhưng nên chụp phòng thiết bị và chỗ hỏng (nếu có)."
            />
          </CardContent>
        </Card>

        {loi ? <Alert variant="destructive">{loi}</Alert> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={dangGui || dangTai}>
            {dangGui ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            Lưu cập nhật onsite
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to={`/onsite/${locationId ?? ''}`}>Huỷ</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
