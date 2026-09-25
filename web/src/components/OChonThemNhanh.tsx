import { useEffect, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { goiApi, LoiApi } from '@/lib/api';
import type { DanhMuc, TrangDuLieu } from '@/lib/kieu';

/** Giá trị riêng của mục "+ Thêm mới…" — không trùng id thật nào (id là cuid). */
const THEM_MOI = '__them_moi__';

interface Props {
  id: string;
  nhan: string;
  /** Đường API của bảng tra cứu, VD `/api/danh-muc/nguon-goc`. */
  duongApi: string;
  giaTri: string;
  onDoi: (id: string) => void;
  /** Có được thêm mục mới ngay tại đây không — theo vai trò. */
  duocThem: boolean;
  required?: boolean;
  /** Gợi ý trong ô gõ tên mục mới. */
  goiY?: string;
}

/**
 * Ô chọn lấy danh sách từ CSDL, KÈM đường thêm mục mới ngay tại chỗ.
 *
 * Dùng cho nguồn gốc và mục đích sử dụng — hai thứ trước đây là danh sách cứng
 * bốn giá trị. Người ở kho gặp một nguồn gốc chưa có trong danh sách giữa lúc
 * đang điền form; bắt họ rời trang, vào Danh mục thêm, rồi quay lại điền từ đầu
 * thì cuối cùng sẽ có người chọn bừa "Khác" cho xong. Gõ thêm tại chỗ là để
 * tránh đúng việc đó.
 *
 * Mục thêm ở đây được GHI VÀO CSDL ngay, nên lần sau mở form là đã có sẵn.
 * Muốn sửa tên, sắp xếp hay xoá thì vào Danh mục — chỗ đó mới biết mục nào đang
 * có bao nhiêu thiết bị dùng.
 */
export function OChonThemNhanh({
  id,
  nhan,
  duongApi,
  giaTri,
  onDoi,
  duocThem,
  required,
  goiY,
}: Props) {
  const [muc, datMuc] = useState<DanhMuc[]>([]);
  const [dangThem, datDangThem] = useState(false);
  const [tenMoi, datTenMoi] = useState('');
  const [dangLuu, datDangLuu] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const oNhap = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let conDung = true;
    async function tai(): Promise<void> {
      try {
        const kq = await goiApi<TrangDuLieu<DanhMuc>>(duongApi);
        if (!conDung) return;
        datMuc(kq.muc);
      } catch (e) {
        if (conDung) datLoi(e instanceof LoiApi ? e.message : `Không tải được ${nhan}.`);
      }
    }
    void tai();
    return () => {
      conDung = false;
    };
  }, [duongApi, nhan]);

  // Mở ô gõ thì đưa con trỏ vào luôn, khỏi bắt bấm thêm một lần nữa.
  useEffect(() => {
    if (dangThem) oNhap.current?.focus();
  }, [dangThem]);

  /**
   * ĐỒNG BỘ giá trị đang hiện với giá trị form thật sự giữ.
   *
   * Không có đoạn này thì hỏng đúng kiểu khó chịu nhất: `<select>` mà `value`
   * không khớp option nào thì trình duyệt TỰ hiện option đầu, nhưng state của
   * form vẫn rỗng. Người dùng mở form, nhìn thấy "Nhập từ IPP" chình ình, điền
   * nốt rồi bấm Lưu — và nhận về "Chưa chọn nguồn gốc." Đã gặp đúng lỗi này lúc
   * kiểm thử.
   *
   * Nên: nạp xong mà giá trị đang giữ không trỏ vào mục nào có thật thì chọn
   * luôn mục đầu, để cái hiện ra và cái gửi đi là một.
   */
  useEffect(() => {
    if (muc.length === 0) return;
    if (giaTri && muc.some((m) => m.id === giaTri)) return;
    // Ưu tiên mục đang dùng; cả bảng đều Ngừng dùng thì vẫn phải khớp cái đang hiện.
    const dau = muc.find((m) => m.isActive) ?? muc[0];
    if (dau) onDoi(dau.id);
  }, [muc, giaTri, onDoi]);

  /**
   * Mục đã Ngừng dùng thì không cho chọn MỚI, nhưng vẫn phải hiện nếu thiết bị
   * đang sửa mang đúng mục đó — bỏ đi thì ô chọn nhảy sang giá trị khác và
   * người dùng lặng lẽ đổi mất nguồn gốc của thiết bị mà không hề biết.
   */
  const hien = muc.filter((m) => m.isActive || m.id === giaTri);

  async function luuMucMoi(): Promise<void> {
    const ten = tenMoi.trim();
    if (!ten) return;
    datLoi(null);
    datDangLuu(true);
    try {
      // Mã do server sinh từ tên — người dùng không phải nghĩ thêm một cái mã.
      const kq = await goiApi<{ ok: true; muc: DanhMuc }>(duongApi, {
        method: 'POST',
        than: { name: ten },
      });
      datMuc((cu) => [...cu, kq.muc]);
      onDoi(kq.muc.id);
      datTenMoi('');
      datDangThem(false);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : `Không thêm được ${nhan}.`);
    } finally {
      datDangLuu(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {nhan}
        {required ? ' *' : ''}
      </Label>

      {dangThem ? (
        <div className="flex min-w-0 gap-1.5">
          <Input
            ref={oNhap}
            value={tenMoi}
            onChange={(su) => datTenMoi(su.target.value)}
            placeholder={goiY ?? `Tên ${nhan.toLowerCase()} mới`}
            maxLength={191}
            aria-label={`Tên ${nhan.toLowerCase()} mới`}
            // Enter trong ô này phải là "lưu mục mới", KHÔNG phải gửi cả form
            // thiết bị — form đó còn thiếu trường thì sẽ báo lỗi tứ tung.
            onKeyDown={(su) => {
              if (su.key === 'Enter') {
                su.preventDefault();
                void luuMucMoi();
              }
              if (su.key === 'Escape') {
                su.preventDefault();
                datDangThem(false);
                datTenMoi('');
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            // `shrink-0`: trong hàng flex, ô gõ tên giành hết chỗ và bóp hai nút
            // từ 40px xuống 30px — vùng bấm 30px trên điện thoại là quá nhỏ.
            className="shrink-0"
            onClick={() => void luuMucMoi()}
            disabled={dangLuu || tenMoi.trim() === ''}
            aria-label={`Lưu ${nhan.toLowerCase()} mới`}
          >
            <Check aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0"
            onClick={() => {
              datDangThem(false);
              datTenMoi('');
              datLoi(null);
            }}
            aria-label="Huỷ thêm mới"
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <Select
          id={id}
          {...(required ? { required: true } : {})}
          value={giaTri}
          onChange={(su) => {
            if (su.target.value === THEM_MOI) datDangThem(true);
            else onDoi(su.target.value);
          }}
        >
          {/* Bảng rỗng thì phải nói rõ, đừng để ô chọn trống không ai hiểu vì sao. */}
          {hien.length === 0 ? <option value="">— chưa có mục nào —</option> : null}
          {hien.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.isActive ? '' : ' (ngừng dùng)'}
            </option>
          ))}
          {duocThem ? <option value={THEM_MOI}>+ Thêm mới…</option> : null}
        </Select>
      )}

      {loi ? <p className="text-xs text-destructive-dam">{loi}</p> : null}
      {dangThem ? (
        <p className="text-xs text-muted-foreground">
          <Plus className="mr-0.5 inline size-3" aria-hidden />
          Mục mới được lưu vào hệ thống, lần sau chọn thẳng. Sửa tên hoặc xoá ở Danh mục.
        </p>
      ) : null}
    </div>
  );
}
