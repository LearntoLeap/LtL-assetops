import { z } from 'zod';
import { VAI_TRO } from '@ltl/taisan-shared';
import {
  chuoiSua,
  chuoiTuyChon,
  soDienThoaiSua,
  soDienThoaiTuyChon,
} from '../../lib/luoc-do-chung.js';

const vaiTro = z.enum(VAI_TRO);

export const luocDoTaoNguoiDung = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng.').max(191),
  matKhau: z.string().min(1, 'Chưa nhập mật khẩu khởi tạo.'),
  fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự.').max(191),
  role: vaiTro,
  phone: soDienThoaiTuyChon,
  department: chuoiTuyChon(191),
  /** Bắt buộc với vai trò KHO và TRUONG. */
  locationId: z.string().trim().max(30).optional(),
  /** Mặc định true: người dùng phải đổi mật khẩu ở lần đăng nhập đầu. */
  mustChangePassword: z.boolean().default(true),
});
export type DuLieuTaoNguoiDung = z.infer<typeof luocDoTaoNguoiDung>;

/** Bỏ trường = giữ nguyên; gửi chuỗi rỗng = xoá giá trị đó. */
export const luocDoSuaNguoiDung = z
  .object({
    fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự.').max(191).optional(),
    role: vaiTro.optional(),
    phone: soDienThoaiSua,
    department: chuoiSua(191),
    locationId: chuoiSua(30),
  })
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
