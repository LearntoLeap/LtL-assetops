import { z } from 'zod';

const toaDoTuyChon = z
  .object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    /** Độ chính xác GPS (mét) do trình duyệt báo — chỉ để ghi nhật ký. */
    doChinhXacM: z.coerce.number().nonnegative().optional(),
  })
  .optional();

export const luocDoDangNhap = z.object({
  email: z.string().trim().toLowerCase().email('Email không đúng định dạng.'),
  matKhau: z.string().min(1, 'Chưa nhập mật khẩu.'),
  /** Bắt buộc với vai trò KHO — server kiểm và quyết định. */
  viTri: toaDoTuyChon,
  /** Mã vượt quyền GPS dùng một lần do ADMIN cấp. */
  maVuotQuyen: z.string().trim().max(32).optional(),
});
export type DuLieuDangNhap = z.infer<typeof luocDoDangNhap>;

export const luocDoLamMoi = z.object({
  refreshToken: z.string().min(1, 'Thiếu refresh token.'),
});

export const luocDoDoiMatKhau = z.object({
  matKhauCu: z.string().min(1, 'Chưa nhập mật khẩu hiện tại.'),
  matKhauMoi: z.string().min(1, 'Chưa nhập mật khẩu mới.'),
});
