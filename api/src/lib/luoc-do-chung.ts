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

/**
 * Danh sách id cho thao tác hàng loạt (xoá / khôi phục / xoá hẳn nhiều dòng).
 *
 * Giới hạn 500 để một cú bấm nhầm không quét cả cơ sở dữ liệu, và để lô chạy
 * xong trong thời gian chờ của trình duyệt — mỗi id là một giao dịch riêng.
 */
export const luocDoNhieuIdChung = z.object({
  ids: z
    .array(z.string().trim().min(1).max(30))
    .min(1, 'Chưa chọn dòng nào.')
    .max(500, 'Mỗi lần tối đa 500 dòng. Chọn bớt rồi làm tiếp.'),
});
