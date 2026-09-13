/**
 * Mảnh lược đồ zod dùng lại ở nhiều module.
 *
 * Biểu mẫu HTML gửi ô trống thành CHUỖI RỖNG chứ không bỏ hẳn trường đi, nên
 * các trường không bắt buộc phải hiểu được chuỗi rỗng. Nhưng ý nghĩa của chuỗi
 * rỗng khác nhau giữa tạo mới và sửa:
 *
 *   - TẠO MỚI: '' nghĩa là "không điền"  → quy về `undefined`.
 *   - SỬA:     '' nghĩa là "xoá giá trị" → quy về `null`;
 *              bỏ hẳn trường mới là "giữ nguyên" (`undefined`).
 *
 * Tách hai bộ giúp người dùng xoá được số điện thoại đã nhập nhầm, thay vì bấm
 * lưu mà không có gì xảy ra.
 */
import { z } from 'zod';

const MAU_SO_DIEN_THOAI = /^[0-9+\s.-]{8,20}$/;
const LOI_SO_DIEN_THOAI =
  'Số điện thoại không hợp lệ (8–20 ký tự, chỉ gồm số và các dấu + . - khoảng trắng).';

/** Số điện thoại khi TẠO MỚI: bỏ trống được; đã điền thì phải đúng dạng. */
export const soDienThoaiTuyChon = z
  .string()
  .trim()
  .max(20, 'Số điện thoại tối đa 20 ký tự.')
  .optional()
  .transform((v) => (v === '' ? undefined : v))
  .refine((v) => v === undefined || MAU_SO_DIEN_THOAI.test(v), { message: LOI_SO_DIEN_THOAI });

/** Số điện thoại khi SỬA: '' hoặc null là xoá; bỏ trường là giữ nguyên. */
export const soDienThoaiSua = z
  .string()
  .trim()
  .max(20, 'Số điện thoại tối đa 20 ký tự.')
  .nullable()
  .optional()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === undefined || v === null || MAU_SO_DIEN_THOAI.test(v), {
    message: LOI_SO_DIEN_THOAI,
  });

/** Chuỗi không bắt buộc khi TẠO MỚI: '' → `undefined`. */
export function chuoiTuyChon(toiDa: number) {
  return z
    .string()
    .trim()
    .max(toiDa)
    .optional()
    .transform((v) => (v === '' ? undefined : v));
}

/** Chuỗi không bắt buộc khi SỬA: '' hoặc null → `null` (xoá giá trị). */
export function chuoiSua(toiDa: number) {
  return z
    .string()
    .trim()
    .max(toiDa)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));
}
