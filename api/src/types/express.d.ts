import type { UserRole } from '@prisma/client';

/** Người dùng đã xác thực, gắn vào request bởi middleware `yeuCauDangNhap`. */
export interface NguoiDungDaXacThuc {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** Điểm lưu trữ gắn với tài khoản: KHO → kho, TRUONG → điểm trường. */
  locationId: string | null;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      nguoiDung?: NguoiDungDaXacThuc;
    }
  }
}
