import { z } from 'zod';
import { TINH_TRANG, TRANG_THAI_KIEM_KE } from '@ltl/taisan-shared';
import { chuoiTuyChon } from '../../lib/luoc-do-chung.js';

export const luocDoTaoKiemKe = z.object({
  name: z.string().trim().min(3, 'Chưa đặt tên đợt kiểm kê.').max(191),
  locationId: z.string().trim().min(1, 'Chưa chọn địa điểm kiểm kê.').max(30),
  note: chuoiTuyChon(2000),
});
export type DuLieuTaoKiemKe = z.infer<typeof luocDoTaoKiemKe>;

/** Ghi kết quả thực đếm cho một dòng. Ảnh không bắt buộc nhưng nên có. */
export const luocDoGhiDem = z.object({
  countedQuantity: z.coerce.number().int().min(0).max(1_000_000),
  countedCondition: z.enum(TINH_TRANG),
  anhIds: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
  note: chuoiTuyChon(2000),
});
export type DuLieuGhiDem = z.infer<typeof luocDoGhiDem>;

export const luocDoChot = z.object({
  /** Có tạo bút toán điều chỉnh tồn theo thực đếm hay không. */
  dieuChinhTon: z.boolean().default(true),
  note: chuoiTuyChon(2000),
});
export type DuLieuChot = z.infer<typeof luocDoChot>;

export const luocDoLocKiemKe = z.object({
  status: z.enum(TRANG_THAI_KIEM_KE).optional(),
  locationId: chuoiTuyChon(30),
  trang: z.coerce.number().int().positive().default(1),
  moiTrang: z.coerce.number().int().positive().max(200).default(25),
});
export type DuLieuLocKiemKe = z.infer<typeof luocDoLocKiemKe>;
