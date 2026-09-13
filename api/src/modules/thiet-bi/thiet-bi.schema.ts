import { z } from 'zod';
import {
  KIEU_QUAN_LY,
  MUC_DICH_SU_DUNG,
  NGUON_GOC,
  TINH_TRANG,
  TRANG_THAI_PHAN_BO,
} from '@ltl/taisan-shared';

/**
 * MÃ THIẾT BỊ — nguyên tắc bất biến #1.
 * Chữ in hoa, số, gạch ngang và gạch dưới. Chuẩn hoá về chữ hoa để
 * "ltl-rb-0001" và "LTL-RB-0001" không thành hai thiết bị khác nhau.
 */
export const maThietBi = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, 'Mã thiết bị phải có ít nhất 3 ký tự.')
  .max(64, 'Mã thiết bị tối đa 64 ký tự.')
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Mã chỉ gồm chữ in hoa, số và các dấu . _ -');

const ngayISO = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo dạng NĂM-THÁNG-NGÀY, ví dụ 2026-03-15');

export const luocDoTaoThietBi = z
  .object({
    code: maThietBi,
    name: z.string().trim().min(2, 'Tên thiết bị phải có ít nhất 2 ký tự.').max(191),
    categoryId: z.string().trim().min(1, 'Chưa chọn loại tài sản.').max(30),
    productLineId: z.string().trim().max(30).optional(),
    serialNumber: z.string().trim().max(191).optional(),
    origin: z.enum(NGUON_GOC),
    originNote: z.string().trim().max(255).optional(),
    receivedDate: ngayISO.optional(),
    value: z.coerce.number().min(0).max(999_999_999_999).optional(),
    purpose: z.enum(MUC_DICH_SU_DUNG),
    trackingType: z.enum(KIEU_QUAN_LY),
    condition: z.enum(TINH_TRANG).default('TOT'),
    /** Điểm nhận hàng lúc nhập ban đầu — sinh ra movement NHAP_BAN_DAU. */
    nhapVeLocationId: z.string().trim().min(1, 'Chưa chọn nơi nhập về.').max(30),
    /** Số lượng lúc nhập; tài sản quản lý theo đơn vị luôn là 1. */
    soLuongNhap: z.coerce.number().int().min(1).max(1_000_000).default(1),
    dueReturnAt: ngayISO.optional(),
    note: z.string().trim().max(5000).optional(),
  })
  .refine((v) => v.trackingType !== 'DON_VI' || v.soLuongNhap === 1, {
    message: 'Thiết bị quản lý theo từng đơn vị phải có số lượng nhập bằng 1.',
    path: ['soLuongNhap'],
  });
export type DuLieuTaoThietBi = z.infer<typeof luocDoTaoThietBi>;

/**
 * Sửa thiết bị: CHỈ các trường mô tả.
 *
 * Cố tình KHÔNG cho sửa `currentLocationId`, `allocationStatus`, `condition` ở
 * đây — vị trí và trạng thái chỉ đổi qua luồng yêu cầu → duyệt → xuất/nhập kho
 * (giai đoạn 4) hoặc điều chỉnh sau kiểm kê (giai đoạn 5), để không ai lách được
 * nguyên tắc bất biến #2 bằng cách sửa trực tiếp.
 */
export const luocDoSuaThietBi = z
  .object({
    name: z.string().trim().min(2).max(191).optional(),
    categoryId: z.string().trim().min(1).max(30).optional(),
    productLineId: z.string().trim().max(30).nullable().optional(),
    serialNumber: z.string().trim().max(191).nullable().optional(),
    origin: z.enum(NGUON_GOC).optional(),
    originNote: z.string().trim().max(255).nullable().optional(),
    receivedDate: ngayISO.nullable().optional(),
    value: z.coerce.number().min(0).max(999_999_999_999).nullable().optional(),
    purpose: z.enum(MUC_DICH_SU_DUNG).optional(),
    dueReturnAt: ngayISO.nullable().optional(),
    note: z.string().trim().max(5000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });
export type DuLieuSuaThietBi = z.infer<typeof luocDoSuaThietBi>;

export const luocDoLocThietBi = z.object({
  tuKhoa: z.string().trim().max(191).optional(),
  categoryId: z.string().trim().max(30).optional(),
  productLineId: z.string().trim().max(30).optional(),
  locationId: z.string().trim().max(30).optional(),
  condition: z.enum(TINH_TRANG).optional(),
  allocationStatus: z.enum(TRANG_THAI_PHAN_BO).optional(),
  purpose: z.enum(MUC_DICH_SU_DUNG).optional(),
  trackingType: z.enum(KIEU_QUAN_LY).optional(),
  chiHoatDong: z.enum(['true', 'false']).default('true'),
  sapXep: z.enum(['code', 'name', 'moi_nhat']).default('code'),
  trang: z.coerce.number().int().positive().default(1),
  moiTrang: z.coerce.number().int().positive().max(200).default(50),
});
export type DuLieuLocThietBi = z.infer<typeof luocDoLocThietBi>;
