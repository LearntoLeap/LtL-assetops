import { z } from 'zod';
import { VAI_TRO } from '@ltl/taisan-shared';

const vaiTro = z.enum(VAI_TRO);

const soDienThoai = z
  .string()
  .trim()
  .regex(/^[0-9+\s.-]{8,20}$/, 'Số điện thoại không hợp lệ.')
  .optional();

export const luocDoTaoNguoiDung = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng.').max(191),
  matKhau: z.string().min(1, 'Chưa nhập mật khẩu khởi tạo.'),
  fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự.').max(191),
  role: vaiTro,
  phone: soDienThoai,
  department: z.string().trim().max(191).optional(),
  /** Bắt buộc với vai trò KHO và TRUONG. */
  locationId: z.string().trim().max(30).optional(),
  /** Mặc định true: người dùng phải đổi mật khẩu ở lần đăng nhập đầu. */
  mustChangePassword: z.boolean().default(true),
});
export type DuLieuTaoNguoiDung = z.infer<typeof luocDoTaoNguoiDung>;

export const luocDoSuaNguoiDung = z
  .object({
    fullName: z.string().trim().min(2).max(191).optional(),
    role: vaiTro.optional(),
    phone: soDienThoai.or(z.literal('')),
    department: z.string().trim().max(191).or(z.literal('')).optional(),
    locationId: z.string().trim().max(30).or(z.literal('')).optional(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });
export type DuLieuSuaNguoiDung = z.infer<typeof luocDoSuaNguoiDung>;

export const luocDoKhoa = z.object({
  isLocked: z.boolean(),
  lyDo: z.string().trim().max(255).optional(),
});

export const luocDoDatLaiMatKhau = z.object({
  matKhauMoi: z.string().min(1, 'Chưa nhập mật khẩu mới.'),
});

export const luocDoLocNguoiDung = z.object({
  role: vaiTro.optional(),
  isLocked: z.enum(['true', 'false']).optional(),
  /** Tìm theo email hoặc họ tên. */
  tuKhoa: z.string().trim().max(191).optional(),
  trang: z.coerce.number().int().positive().default(1),
  moiTrang: z.coerce.number().int().positive().max(200).default(50),
});
export type DuLieuLocNguoiDung = z.infer<typeof luocDoLocNguoiDung>;
