/**
 * Lưu ảnh lên ổ đĩa VPS.
 *
 * - Thư mục chia theo NĂM/THÁNG để một thư mục không phình ra hàng vạn file.
 * - Ảnh nén về cạnh dài nhất UPLOAD_MAX_EDGE (mặc định 1600px), chuyển sang WebP:
 *   ảnh điện thoại 4–8MB thường còn vài trăm KB mà vẫn đọc rõ MÃ THIẾT BỊ in
 *   trên nhãn trong ảnh — đây là điểm mấu chốt, ảnh là bằng chứng.
 * - Tên file sinh ngẫu nhiên, KHÔNG dùng tên người dùng đặt (chặn path traversal).
 * - File nằm ngoài thư mục web tĩnh; chỉ đọc được qua API có xác thực.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { env } from '../env.js';
import { loi400 } from './loi-http.js';
import { log, moTaLoi } from './ghi-log.js';

const KIEU_CHO_PHEP = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export interface AnhDaLuu {
  /** Đường dẫn tương đối so với UPLOAD_DIR, vd "2026/09/ab12cd34.webp". */
  filePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  checksum: string;
}

/** Thư mục gốc chứa ảnh, luôn là đường dẫn tuyệt đối đã chuẩn hoá. */
export function thuMucGoc(): string {
  return resolve(env.UPLOAD_DIR);
}

/**
 * Ghép đường dẫn tuyệt đối từ đường dẫn tương đối lưu trong CSDL, CHẶN mọi mưu
 * toan thoát khỏi thư mục gốc. Trả về null nếu đường dẫn không hợp lệ.
 */
export function duongDanTuyetDoi(duongDanTuongDoi: string): string | null {
  if (isAbsolute(duongDanTuongDoi) || duongDanTuongDoi.includes('\0')) return null;
  const goc = thuMucGoc();
  const dayDu = resolve(goc, normalize(duongDanTuongDoi));
  if (dayDu !== goc && !dayDu.startsWith(goc + sep)) return null;
  return dayDu;
}

export async function luuAnh(tep: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}): Promise<AnhDaLuu> {
  if (!KIEU_CHO_PHEP.has(tep.mimetype)) {
    throw loi400(
      `Chỉ nhận ảnh JPEG, PNG, WebP hoặc HEIC. File gửi lên là "${tep.mimetype}".`,
      'ANH_SAI_DINH_DANG',
    );
  }
  if (tep.buffer.length > env.UPLOAD_MAX_BYTES) {
    throw loi400(
      `Ảnh vượt quá ${Math.round(env.UPLOAD_MAX_BYTES / 1024 / 1024)}MB.`,
      'ANH_QUA_LON',
    );
  }

  const bayGio = new Date();
  const nam = String(bayGio.getUTCFullYear());
  const thang = String(bayGio.getUTCMonth() + 1).padStart(2, '0');
  const tenFile = `${randomBytes(12).toString('hex')}.webp`;
  const duongDanTuongDoi = `${nam}/${thang}/${tenFile}`;

  await mkdir(join(thuMucGoc(), nam, thang), { recursive: true });

  let daNen: Buffer;
  let thongTin: sharp.OutputInfo;
  try {
    const ketQua = await sharp(tep.buffer, { failOn: 'error' })
      .rotate() // xoay theo EXIF — ảnh chụp dọc không bị nằm ngang
      .resize({
        width: env.UPLOAD_MAX_EDGE,
        height: env.UPLOAD_MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    daNen = ketQua.data;
    thongTin = ketQua.info;
  } catch (loi) {
    log.warn('Không xử lý được ảnh tải lên', moTaLoi(loi));
    throw loi400('File gửi lên không phải ảnh đọc được.', 'ANH_HONG');
  }

  await writeFile(join(thuMucGoc(), duongDanTuongDoi), daNen);

  return {
    filePath: duongDanTuongDoi,
    fileName: tep.originalname.slice(0, 191),
    mimeType: 'image/webp',
    byteSize: daNen.length,
    width: thongTin.width,
    height: thongTin.height,
    checksum: createHash('sha256').update(daNen).digest('hex'),
  };
}

/** Xoá file ảnh trên đĩa; lỗi chỉ ghi log vì bản ghi CSDL mới là nguồn sự thật. */
export async function xoaFileAnh(duongDanTuongDoi: string): Promise<void> {
  const dayDu = duongDanTuyetDoi(duongDanTuongDoi);
  if (!dayDu) return;
  try {
    await unlink(dayDu);
  } catch (loi) {
    log.warn('Không xoá được file ảnh', { duongDan: duongDanTuongDoi, ...moTaLoi(loi) });
  }
}
