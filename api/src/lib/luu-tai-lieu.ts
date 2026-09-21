/**
 * Lưu TÀI LIỆU (Word, PDF, bảng tính…) lên ổ đĩa VPS.
 *
 * Dùng lại đúng khuôn của `luu-anh.ts` — thư mục chia theo NĂM/THÁNG, tên file
 * sinh ngẫu nhiên, file nằm ngoài thư mục web tĩnh, chỉ đọc qua API có xác thực
 * — nhưng KHÔNG đi qua sharp: đây là file bất kỳ, không phải ảnh.
 *
 * Ba điểm an toàn không được bỏ:
 *   1. DANH SÁCH TRẮNG kiểu file. Đặc biệt CẤM text/html và image/svg+xml: phục
 *      vụ inline một file HTML người dùng tải lên là một lỗ XSS lưu trữ.
 *   2. Tên file gốc chỉ dùng để HIỂN THỊ, không bao giờ dùng làm đường dẫn.
 *   3. Chỉ PDF, ảnh và văn bản thuần mới được xem inline; còn lại buộc tải về.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../env.js';
import { loi400 } from './loi-http.js';
import { log, moTaLoi } from './ghi-log.js';
import { duongDanTuyetDoi, thuMucGoc } from './luu-anh.js';

/** Kiểu file cho phép → đuôi file dùng khi lưu. */
const KIEU_CHO_PHEP = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  ['application/vnd.ms-powerpoint', 'ppt'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  ['text/plain', 'txt'],
  ['text/markdown', 'md'],
  ['text/csv', 'csv'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['application/zip', 'zip'],
]);

/**
 * Kiểu được phép mở thẳng trong trang. Mọi kiểu khác buộc tải về, kể cả khi
 * trình duyệt có thể hiển thị được — mở inline một file lạ là mở cửa cho XSS.
 */
const XEM_INLINE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain']);

export function xemInlineDuoc(mimeType: string): boolean {
  return XEM_INLINE.has(mimeType);
}

export interface TaiLieuDaLuu {
  /** Đường dẫn tương đối so với UPLOAD_DIR, vd "tai-lieu/2026/09/ab12cd34.pdf". */
  filePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
}

/** Cắt tên hiển thị cho gọn và bỏ ký tự điều khiển; KHÔNG dùng làm đường dẫn. */
function tenHienThi(tho: string): string {
  // eslint-disable-next-line no-control-regex
  const sach = tho.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (sach || 'tai-lieu').slice(0, 191);
}

export async function luuTaiLieu(tep: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}): Promise<TaiLieuDaLuu> {
  const duoi = KIEU_CHO_PHEP.get(tep.mimetype);
  if (!duoi) {
    throw loi400(
      'Định dạng file chưa được hỗ trợ. Nhận PDF, Word, Excel, PowerPoint, văn bản, ảnh và ZIP.',
      'DINH_DANG_KHONG_HO_TRO',
      { kieu: tep.mimetype },
    );
  }
  if (tep.buffer.length > env.UPLOAD_DOC_MAX_BYTES) {
    throw loi400(
      `File vượt quá ${Math.round(env.UPLOAD_DOC_MAX_BYTES / 1024 / 1024)}MB. File lớn (catalogue của hãng…) nên để trên Drive rồi dán link vào mục "Liên kết ngoài".`,
    );
  }

  const nay = new Date();
  const thuMuc = join(
    'tai-lieu',
    String(nay.getFullYear()),
    String(nay.getMonth() + 1).padStart(2, '0'),
  );
  await mkdir(join(thuMucGoc(), thuMuc), { recursive: true });

  const duongDanTuongDoi = join(thuMuc, `${randomBytes(12).toString('hex')}.${duoi}`);
  await writeFile(join(thuMucGoc(), duongDanTuongDoi), tep.buffer);

  return {
    filePath: duongDanTuongDoi,
    fileName: tenHienThi(tep.originalname),
    mimeType: tep.mimetype,
    byteSize: tep.buffer.length,
    checksum: createHash('sha256').update(tep.buffer).digest('hex'),
  };
}

/** Xoá file tài liệu trên đĩa; lỗi chỉ ghi log vì bản ghi CSDL mới là nguồn sự thật. */
export async function xoaFileTaiLieu(duongDanTuongDoi: string): Promise<void> {
  const dayDu = duongDanTuyetDoi(duongDanTuongDoi);
  if (!dayDu) return;
  try {
    await unlink(dayDu);
  } catch (loi) {
    log.warn('Không xoá được file tài liệu', { duongDan: duongDanTuongDoi, ...moTaLoi(loi) });
  }
}
