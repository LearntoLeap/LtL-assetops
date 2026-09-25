import { useEffect, useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { goiApi } from '@/lib/api';
import type { ThietBi, TrangDuLieu } from '@/lib/kieu';

/** Chờ người dùng ngừng gõ bao lâu rồi mới hỏi máy chủ. */
const CHO_MS = 200;
/** Gõ ít hơn chừng này ký tự thì mọi thứ đều khớp, gợi ý vô nghĩa. */
const TOI_THIEU = 2;
const TOI_DA_GOI_Y = 8;

interface Props {
  giaTri: string;
  onDoi: (v: string) => void;
  /** Gọi khi người dùng CHỌN một gợi ý hoặc rời ô — để form đi tra mã. */
  onChot: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Chỉ gợi ý thiết bị đang ở điểm này (nếu có). */
  locationId?: string | undefined;
}

/**
 * Ô nhập mã thiết bị CÓ GỢI Ý theo ký tự đang gõ.
 *
 * Người ở kho gõ mã hàng chục lần mỗi ngày và mã thì dài (MUA-RB-UKIT-0001).
 * Gõ vài ký tự rồi chọn nhanh hơn hẳn, và quan trọng hơn là KHÔNG GÕ SAI —
 * sai một ký tự thì mã không tra ra, người dùng phải dò lại từ đầu.
 *
 * Gợi ý hiện kèm TÊN và VỊ TRÍ: hai thiết bị cùng dòng chỉ khác số thứ tự thì
 * nhìn mã không phân biệt nổi, phải có tên mới chọn đúng.
 *
 * KHÔNG hiện tồn kho: tuyến danh sách không trả tồn (tồn suy ra từ movements,
 * chỉ tính ở trang chi tiết), thêm vào đây là bắt mỗi lần gõ phải chạy thêm một
 * lượt tính tồn cho cả trang — đắt hơn nhiều so với cái nó giúp.
 */
export function OGoiYMaThietBi({
  giaTri,
  onDoi,
  onChot,
  placeholder,
  ariaLabel,
  className,
  locationId,
}: Props) {
  const [goiY, datGoiY] = useState<ThietBi[]>([]);
  const [moRong, datMoRong] = useState(false);
  const [dangTim, datDangTim] = useState(false);
  const [dangChon, datDangChon] = useState(-1);
  const idDs = useId();
  /**
   * Số thứ tự của lượt gọi mới nhất.
   *
   * Gõ "LTL-R" rồi "LTL-RB" thì hai lượt gọi chạy song song và lượt ĐẦU có thể
   * về SAU — không có bộ đếm này thì kết quả cũ đè lên kết quả mới, danh sách
   * gợi ý hiện ra không khớp với cái đang gõ.
   */
  const luot = useRef(0);
  const dsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const tuKhoa = giaTri.trim();
    if (tuKhoa.length < TOI_THIEU) {
      datGoiY([]);
      datDangTim(false);
      return;
    }
    const cuaToi = ++luot.current;
    datDangTim(true);
    const hen = setTimeout(async () => {
      try {
        const q = new URLSearchParams({
          tuKhoa,
          moiTrang: String(TOI_DA_GOI_Y),
          ...(locationId ? { locationId } : {}),
        });
        const kq = await goiApi<TrangDuLieu<ThietBi>>(`/api/thiet-bi?${q.toString()}`);
        if (luot.current !== cuaToi) return;
        datGoiY(kq.muc);
        datDangChon(-1);
      } catch {
        if (luot.current === cuaToi) datGoiY([]);
      } finally {
        if (luot.current === cuaToi) datDangTim(false);
      }
    }, CHO_MS);
    return () => clearTimeout(hen);
  }, [giaTri, locationId]);

  const hien = moRong && goiY.length > 0;

  /**
   * Cuộn danh sách gợi ý vào tầm nhìn khi nó mở ra.
   *
   * Ô nhập nằm cuối form thì danh sách bung xuống DƯỚI mép màn — đo thật trên
   * màn 390×844: đỉnh danh sách ở 861px, tức là người dùng gõ xong không thấy
   * gợi ý nào, tưởng tính năng không chạy. `block: 'nearest'` để chỉ cuộn vừa
   * đủ, không giật cả trang khi danh sách vốn đã nằm trong tầm nhìn.
   */
  useEffect(() => {
    if (hien) dsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [hien, goiY.length]);

  function chon(t: ThietBi): void {
    onDoi(t.code);
    onChot(t.code);
    datMoRong(false);
    datGoiY([]);
  }

  return (
    <div className="relative">
      <Input
        className={className}
        placeholder={placeholder}
        value={giaTri}
        spellCheck={false}
        autoComplete="off"
        role="combobox"
        aria-expanded={hien}
        aria-controls={idDs}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        onChange={(su) => {
          onDoi(su.target.value);
          datMoRong(true);
        }}
        onFocus={() => datMoRong(true)}
        // Rời ô thì vẫn chốt như cũ. Hoãn đóng một nhịp để cú bấm chuột vào gợi
        // ý kịp chạy — đóng ngay thì danh sách biến mất trước khi nhận được click.
        onBlur={(su) => {
          const v = su.target.value;
          setTimeout(() => {
            datMoRong(false);
            onChot(v);
          }, 120);
        }}
        onKeyDown={(su) => {
          if (!hien) return;
          if (su.key === 'ArrowDown') {
            su.preventDefault();
            datDangChon((i) => (i + 1) % goiY.length);
          } else if (su.key === 'ArrowUp') {
            su.preventDefault();
            datDangChon((i) => (i <= 0 ? goiY.length - 1 : i - 1));
          } else if (su.key === 'Enter' && dangChon >= 0) {
            // Chỉ nuốt phím Enter khi ĐANG chọn một gợi ý. Không thì để Enter
            // gửi form như bình thường.
            su.preventDefault();
            const t = goiY[dangChon];
            if (t) chon(t);
          } else if (su.key === 'Escape') {
            datMoRong(false);
          }
        }}
      />
      {dangTim ? (
        <Loader2
          className="absolute right-2 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : null}

      {hien ? (
        <ul
          ref={dsRef}
          id={idDs}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-card shadow-lg"
        >
          {goiY.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === dangChon}
                className={`flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-secondary ${
                  i === dangChon ? 'bg-secondary' : ''
                }`}
                // onMouseDown chứ không onClick: blur của ô nhập chạy TRƯỚC
                // click, mà blur đóng danh sách nên click không bao giờ tới nơi.
                onMouseDown={(su) => {
                  su.preventDefault();
                  chon(t);
                }}
              >
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-medium">{t.code}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.name}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {t.currentLocation?.name ?? '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
