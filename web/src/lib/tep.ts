/**
 * Tải file từ API (cần header Authorization nên không dùng thẻ <a href> được).
 * Lấy blob rồi tạo liên kết tạm để trình duyệt lưu file.
 */
import { kho, LoiApi } from '@/lib/api';

const DIA_CHI_API: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

/** Đọc tên file từ header Content-Disposition, có phương án dự phòng. */
function docTenTep(phanHoi: Response, macDinh: string): string {
  const cd = phanHoi.headers.get('content-disposition') ?? '';
  const khop = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return khop?.[1] ? decodeURIComponent(khop[1]) : macDinh;
}

export async function taiTep(duongDan: string, tenMacDinh: string): Promise<void> {
  const token = kho.docAccess();
  const phanHoi = await fetch(`${DIA_CHI_API}${duongDan}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!phanHoi.ok) {
    let thongDiep = `Tải file thất bại (lỗi ${phanHoi.status}).`;
    try {
      const than: unknown = await phanHoi.json();
      if (typeof than === 'object' && than !== null && 'thongDiep' in than) {
        thongDiep = String((than as { thongDiep: unknown }).thongDiep);
      }
    } catch {
      // Phản hồi không phải JSON — giữ thông điệp mặc định.
    }
    throw new LoiApi(phanHoi.status, thongDiep);
  }

  const blob = await phanHoi.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = docTenTep(phanHoi, tenMacDinh);
    document.body.append(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface LoiDongNhap {
  dong: number;
  cot: string;
  thongDiep: string;
}

export interface KetQuaXemTruoc {
  ok: true;
  tenTep: string;
  tongDong: number;
  soHopLe: number;
  soLoi: number;
  loi: LoiDongNhap[];
  xemTruoc: Array<Record<string, unknown>>;
}

/** Gửi file lên endpoint nhập liệu (multipart/form-data). */
export async function guiTep<T>(duongDan: string, tep: File): Promise<T> {
  const token = kho.docAccess();
  const form = new FormData();
  form.append('tep', tep);

  const phanHoi = await fetch(`${DIA_CHI_API}${duongDan}`, {
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
      chiTiet?: Record<string, unknown>;
    };
    throw new LoiApi(
      phanHoi.status,
      o.thongDiep ?? `Tải file lên thất bại (lỗi ${phanHoi.status}).`,
      o.maLoi ?? 'LOI_CHUNG',
      o.chiTiet,
    );
  }
  return than as T;
}
