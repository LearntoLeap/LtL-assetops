/**
 * Tải ảnh lên và đọc ảnh về.
 *
 * Ảnh chỉ đọc được qua API CÓ XÁC THỰC, mà thẻ <img> thì không gửi được header
 * Authorization. Cố tình KHÔNG nhét token vào query string — nginx/aaPanel ghi
 * nguyên URL vào access log, token sẽ nằm lù lù trong file log. Thay vào đó tải
 * ảnh về dạng blob kèm header rồi dựng object URL.
 *
 * Ảnh là bất biến (tên file ngẫu nhiên, không sửa được) nên cache theo id trong
 * bộ nhớ trang: mở đi mở lại danh sách không tải lại ảnh.
 */
import type { LoaiAnh } from '@ltl/taisan-shared';
import { kho, LoiApi } from '@/lib/api';

const DIA_CHI_API: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

export interface AnhDaTai {
  id: string;
  kind: LoaiAnh;
  width: number | null;
  height: number | null;
  byteSize: number;
  createdAt: string;
}

const boNho = new Map<string, Promise<string>>();

/** Lấy object URL của một ảnh (có cache). Ném LoiApi nếu không có quyền xem. */
export function docAnh(id: string): Promise<string> {
  const daCo = boNho.get(id);
  if (daCo) return daCo;

  const dangTai = (async () => {
    const token = kho.docAccess();
    const phanHoi = await fetch(`${DIA_CHI_API}/api/anh/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!phanHoi.ok) {
      throw new LoiApi(phanHoi.status, `Không đọc được ảnh (lỗi ${phanHoi.status}).`);
    }
    return URL.createObjectURL(await phanHoi.blob());
  })();

  boNho.set(id, dangTai);
  // Tải hỏng thì bỏ khỏi cache để lần sau thử lại được.
  dangTai.catch(() => boNho.delete(id));
  return dangTai;
}

/** Dọn cache khi đăng xuất, tránh người sau xem được ảnh của người trước. */
export function xoaCacheAnh(): void {
  for (const dangTai of boNho.values()) {
    void dangTai.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
  }
  boNho.clear();
}

export async function taiAnhLen(
  tep: File,
  kind: LoaiAnh,
  assetId?: string,
  viTri?: { latitude: number; longitude: number },
): Promise<AnhDaTai> {
  const token = kho.docAccess();
  const form = new FormData();
  form.append('anh', tep);
  form.append('kind', kind);
  if (assetId) form.append('assetId', assetId);
  if (viTri) {
    form.append('latitude', String(viTri.latitude));
    form.append('longitude', String(viTri.longitude));
  }

  const phanHoi = await fetch(`${DIA_CHI_API}/api/anh`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const kieu = phanHoi.headers.get('content-type') ?? '';
  const than: unknown = kieu.includes('application/json') ? await phanHoi.json() : null;

  if (!phanHoi.ok) {
    const o = (typeof than === 'object' && than !== null ? than : {}) as {
      thongDiep?: string;
      maLoi?: string;
    };
    throw new LoiApi(
      phanHoi.status,
      o.thongDiep ?? `Tải ảnh thất bại (lỗi ${phanHoi.status}).`,
      o.maLoi ?? 'LOI_CHUNG',
    );
  }
  return (than as { anh: AnhDaTai }).anh;
}
