import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * HỘP XÁC NHẬN CÓ / KHÔNG dùng chung cho mọi thao tác xoá.
 *
 * Trước đây xoá hẳn bắt người dùng GÕ LẠI mã hoặc một câu dài vào ô nhắc của
 * trình duyệt — chậm, gõ sai một dấu là phải làm lại. Chủ doanh nghiệp yêu cầu
 * chỉ cần bấm Có / Không.
 *
 * Tác dụng chống bấm nhầm của bước gõ được giữ bằng hai cách khác:
 *   - Nút "Không" nằm TRƯỚC trong thứ tự và được focus sẵn: nhấn Enter theo phản
 *     xạ là Không, không phải Có.
 *   - Nội dung hộp nói rõ hậu quả (mất gì, có khôi phục được không).
 *
 * Dùng `<dialog>` của trình duyệt (showModal) nên có sẵn khoá focus, nền mờ, Esc
 * để đóng — không thêm thư viện nào.
 */
export interface TuyChonXacNhan {
  tieuDe: string;
  noiDung?: ReactNode;
  /** Mặc định "Có, xoá hẳn". */
  nutCo?: string;
  /** Mặc định "Không". */
  nutKhong?: string;
  /** Mặc định true — nút Có màu đỏ. Đặt false cho khôi phục, xác nhận thường. */
  nguyHiem?: boolean;
}

type HamHoi = (tc: TuyChonXacNhan) => Promise<boolean>;

const NguCanh = createContext<HamHoi | null>(null);

interface DangHoi {
  tc: TuyChonXacNhan;
  tra: (dongY: boolean) => void;
}

export function CungCapXacNhan({ children }: { children: ReactNode }) {
  const [dangHoi, datDangHoi] = useState<DangHoi | null>(null);
  const hop = useRef<HTMLDialogElement>(null);
  const nutKhong = useRef<HTMLButtonElement>(null);
  /** Lời hỏi đang mở — để bấm đúp không trả lời hai lần. */
  const dangMo = useRef<DangHoi | null>(null);

  const hoi = useCallback<HamHoi>((tc) => {
    return new Promise<boolean>((xong) => {
      // Đang có một hộp mở mà lại hỏi tiếp: lời hỏi cũ coi như "Không".
      dangMo.current?.tra(false);
      const moi: DangHoi = {
        tc,
        tra: (dongY) => {
          if (dangMo.current !== moi) return;
          dangMo.current = null;
          hop.current?.close();
          datDangHoi(null);
          xong(dongY);
        },
      };
      dangMo.current = moi;
      datDangHoi(moi);
    });
  }, []);

  useEffect(() => {
    const d = hop.current;
    if (!dangHoi || !d) return;
    if (!d.open) d.showModal();
    nutKhong.current?.focus();
  }, [dangHoi]);

  const tc = dangHoi?.tc;
  const nguyHiem = tc?.nguyHiem ?? true;

  return (
    <NguCanh.Provider value={hoi}>
      {children}
      <dialog
        ref={hop}
        aria-labelledby="hop-xac-nhan-tieu-de"
        className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
        onCancel={(su) => {
          su.preventDefault();
          dangHoi?.tra(false);
        }}
        onClick={(su) => {
          // Bấm ra nền mờ (chính phần tử dialog, ngoài khung nội dung) = Không.
          if (su.target === su.currentTarget) dangHoi?.tra(false);
        }}
      >
        {tc ? (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              {nguyHiem ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive-dam" aria-hidden />
              ) : null}
              <h2 id="hop-xac-nhan-tieu-de" className="text-base font-semibold">
                {tc.tieuDe}
              </h2>
            </div>
            {tc.noiDung ? (
              <div className="whitespace-pre-line text-sm text-muted-foreground">{tc.noiDung}</div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                ref={nutKhong}
                type="button"
                variant="outline"
                onClick={() => dangHoi?.tra(false)}
              >
                {tc.nutKhong ?? 'Không'}
              </Button>
              <Button
                type="button"
                variant={nguyHiem ? 'destructive' : 'default'}
                onClick={() => dangHoi?.tra(true)}
              >
                {tc.nutCo ?? 'Có, xoá hẳn'}
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </NguCanh.Provider>
  );
}

/** Hỏi Có / Không, trả về true khi người dùng bấm Có. */
export function useXacNhan(): HamHoi {
  const hoi = useContext(NguCanh);
  if (!hoi) throw new Error('useXacNhan phải nằm trong <CungCapXacNhan>.');
  return hoi;
}
