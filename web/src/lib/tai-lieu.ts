/**
 * Tài liệu wiki: tải lên và mở lại.
 *
 * Đi theo đúng khuôn của `anh.ts` — file nằm sau endpoint có xác thực nên
 * không đặt thẳng URL vào <a href> được, phải tải bằng fetch kèm token rồi mở
 * object URL.
 */
import { LoiApi, diaChiApi } from './api';
import type { LoaiTaiLieuWiki } from '@ltl/taisan-shared';
import type { TaiLieuWiki } from './kieu';

function docToken(): string | null {
  try {
    return localStorage.getItem('ltl-taisan:access-token');
  } catch {
    return null;
  }
}

async function nemNeuHong(phanHoi: Response, macDinh: string): Promise<void> {
  if (phanHoi.ok) return;
  const kieu = phanHoi.headers.get('content-type') ?? '';
  const than: unknown = kieu.includes('application/json') ? await phanHoi.json() : null;
  const o = (typeof than === 'object' && than !== null ? than : {}) as {
    thongDiep?: string;
    maLoi?: string;
  };
  throw new LoiApi(phanHoi.status, o.thongDiep ?? macDinh, o.maLoi ?? 'LOI_CHUNG');
}

export async function taiTaiLieuLen(
  articleId: string,
  duLieu: { loai: LoaiTaiLieuWiki; tieuDe: string; moTa?: string },
  tep: File | null,
  lienKetNgoai?: string,
): Promise<TaiLieuWiki> {
  const form = new FormData();
  form.append('loai', duLieu.loai);
  form.append('tieuDe', duLieu.tieuDe);
  if (duLieu.moTa) form.append('moTa', duLieu.moTa);
  if (tep) form.append('tep', tep);
  else if (lienKetNgoai) form.append('lienKetNgoai', lienKetNgoai);

  const token = docToken();
  const phanHoi = await fetch(`${diaChiApi}/api/wiki/bai/${articleId}/tai-lieu`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  await nemNeuHong(phanHoi, 'Tải tài liệu thất bại.');
  const than = (await phanHoi.json()) as { taiLieu: TaiLieuWiki };
  return than.taiLieu;
}

/**
 * Mở tài liệu trong tab mới. Phải tải bằng fetch kèm token rồi mở blob, vì
 * endpoint phục vụ file đòi xác thực — dán thẳng URL vào thẻ <a> sẽ ra 401.
 */
export async function moTaiLieu(doc: TaiLieuWiki): Promise<void> {
  if (doc.lienKetNgoai) {
    window.open(doc.lienKetNgoai, '_blank', 'noopener,noreferrer');
    return;
  }
  const token = docToken();
  const phanHoi = await fetch(`${diaChiApi}/api/wiki/tai-lieu/${doc.id}/tep`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  await nemNeuHong(phanHoi, 'Không mở được tài liệu.');

  const blob = await phanHoi.blob();
  const url = URL.createObjectURL(blob);
  // PDF/ảnh thì xem ngay; định dạng khác thì tải về với đúng tên gốc.
  const xemDuoc = /^(application\/pdf|image\/|text\/plain)/.test(doc.mimeType ?? '');
  if (xemDuoc) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName ?? doc.tieuDe;
    a.click();
  }
  // Nhả object URL sau khi trình duyệt kịp dùng; thu hồi ngay thì tab mới trắng.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function coTep(byteSize: number | null): string {
  if (byteSize === null) return '';
  if (byteSize < 1024) return `${byteSize} B`;
  if (byteSize < 1024 * 1024) return `${Math.round(byteSize / 1024)} KB`;
  return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
}

/** Nhãn ngắn theo định dạng, để gắn cạnh tên tài liệu. */
export function nhanDinhDang(doc: TaiLieuWiki): string {
  if (doc.lienKetNgoai) return 'Liên kết';
  const m = doc.mimeType ?? '';
  if (m === 'application/pdf') return 'PDF';
  if (m.includes('wordprocessingml') || m === 'application/msword') return 'Word';
  if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel') return 'Excel';
  if (m.includes('presentationml') || m === 'application/vnd.ms-powerpoint') return 'PowerPoint';
  if (m.startsWith('image/')) return 'Ảnh';
  if (m === 'application/zip') return 'ZIP';
  if (m.startsWith('text/')) return 'Văn bản';
  return 'Tệp';
}
