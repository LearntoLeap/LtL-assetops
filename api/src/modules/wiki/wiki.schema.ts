import { z } from 'zod';
import {
  LOAI_DICH_WIKI,
  LOAI_MUC_WIKI,
  LOAI_TAI_LIEU_WIKI,
  MUC_DO_LUU_Y,
  TRANG_THAI_WIKI,
} from '@ltl/taisan-shared';
import { chuoiTuyChon } from '../../lib/luoc-do-chung.js';

/** Một đích mà bài wiki áp dụng cho: đúng MỘT loại + một id. */
export const luocDoDich = z.object({
  loai: z.enum(LOAI_DICH_WIKI),
  id: z.string().trim().min(1).max(30),
});

/**
 * Một mục có cấu trúc trong bài. Bốn loại dùng chung một hình dạng, ràng buộc
 * riêng của từng loại kiểm ở đây vì CSDL không kiểm hộ được:
 *   - LUU_Y bắt buộc có mức độ (quyết định màu và việc có đẩy lên đầu trang);
 *   - LOI_THUONG_GAP bắt buộc có cách xử lý, chứ nêu triệu chứng rồi bỏ đó thì
 *     người đọc không được gì.
 */
export const luocDoMuc = z
  .object({
    loai: z.enum(LOAI_MUC_WIKI),
    tieuDe: z.string().trim().min(1, 'Chưa nhập nội dung mục.').max(191),
    noiDung: chuoiTuyChon(20000),
    soLuong: z.coerce.number().int().min(0).max(100_000).optional(),
    donVi: chuoiTuyChon(32),
    mucDo: z.enum(MUC_DO_LUU_Y).optional(),
    /** Thành phần này ứng với mã nào trong kho. */
    assetId: chuoiTuyChon(30),
  })
  .refine((v) => v.loai !== 'LUU_Y' || v.mucDo !== undefined, {
    message: 'Lưu ý phải chọn mức độ: Cần biết, Cẩn thận hay Nguy hiểm.',
    path: ['mucDo'],
  })
  .refine((v) => v.loai !== 'LOI_THUONG_GAP' || Boolean(v.noiDung), {
    message: 'Lỗi thường gặp phải ghi cách xử lý, không chỉ nêu triệu chứng.',
    path: ['noiDung'],
  });

const than = {
  tieuDe: z.string().trim().min(3, 'Tiêu đề phải có ít nhất 3 ký tự.').max(191),
  tomTat: chuoiTuyChon(500),
  moTa: chuoiTuyChon(50_000),
  huongDan: chuoiTuyChon(50_000),
  coverPhotoId: chuoiTuyChon(30),
  status: z.enum(TRANG_THAI_WIKI).default('BAN_NHAP'),
  dich: z.array(luocDoDich).max(200).default([]),
  muc: z.array(luocDoMuc).max(300).default([]),
};

export const luocDoTaoBai = z.object(than);
export type DuLieuTaoBai = z.infer<typeof luocDoTaoBai>;

export const luocDoSuaBai = z.object({
  ...than,
  /** Ghi lại vì sao sửa — hiện ở lịch sử phiên bản. */
  lyDo: chuoiTuyChon(255),
});
export type DuLieuSuaBai = z.infer<typeof luocDoSuaBai>;

export const luocDoLocBai = z.object({
  tuKhoa: chuoiTuyChon(191),
  dongGiaiPhapId: chuoiTuyChon(30),
  loaiTaiSanId: chuoiTuyChon(30),
  status: z.enum(TRANG_THAI_WIKI).optional(),
  trang: z.coerce.number().int().positive().default(1),
  moiTrang: z.coerce.number().int().positive().max(100).default(24),
});

/**
 * Gắn tài liệu. Một dòng tài liệu là HOẶC file tải lên, HOẶC link ngoài —
 * không phải cả hai, cũng không được rỗng cả hai.
 */
export const luocDoTaiLieu = z
  .object({
    loai: z.enum(LOAI_TAI_LIEU_WIKI).default('KHAC'),
    tieuDe: z.string().trim().min(1, 'Chưa đặt tên tài liệu.').max(191),
    moTa: chuoiTuyChon(2000),
    lienKetNgoai: chuoiTuyChon(1000),
  })
  .refine((v) => !v.lienKetNgoai || /^https?:\/\//i.test(v.lienKetNgoai), {
    message: 'Liên kết ngoài phải bắt đầu bằng http:// hoặc https://',
    path: ['lienKetNgoai'],
  });
