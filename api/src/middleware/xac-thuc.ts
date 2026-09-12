/**
 * Xác thực và phân quyền — CHỐT CHẶN CHÍNH của hệ thống (nguyên tắc #6).
 * Mọi endpoint nghiệp vụ đều phải đi qua `yeuCauDangNhap`, và hầu hết còn qua
 * `yeuCauVaiTro(...)`. Ẩn nút ở frontend chỉ là phụ.
 */
import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { prisma } from '../prisma.js';
import { docAccessToken } from '../lib/jwt.js';
import { loi401, loi403 } from '../lib/loi-http.js';
import { batAsync } from '../lib/bat-async.js';
import type { NguoiDungDaXacThuc } from '../types/express.js';

function docBearer(header: string | undefined): string {
  if (!header) throw loi401();
  const [loai, token] = header.split(' ');
  if (loai?.toLowerCase() !== 'bearer' || !token) {
    throw loi401('Header Authorization phải có dạng: Bearer <token>.');
  }
  return token;
}

/**
 * Bắt buộc đăng nhập. Đọc lại người dùng từ CSDL mỗi lần gọi — để việc ADMIN
 * khoá tài khoản hoặc đổi vai trò có hiệu lực NGAY, không phải chờ token hết hạn.
 */
export const yeuCauDangNhap: RequestHandler = batAsync(async (req, _res, next) => {
  const noiDung = docAccessToken(docBearer(req.get('authorization')));

  const nguoiDung = await prisma.user.findUnique({
    where: { id: noiDung.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      locationId: true,
      isLocked: true,
      mustChangePassword: true,
    },
  });

  if (!nguoiDung) throw loi401('Tài khoản không còn tồn tại.');
  if (nguoiDung.isLocked) {
    throw loi403('Tài khoản đã bị khoá. Liên hệ quản trị viên.');
  }

  const { isLocked: _boQua, ...conLai } = nguoiDung;
  req.nguoiDung = conLai satisfies NguoiDungDaXacThuc;
  next();
});

/** Lấy người dùng đã xác thực; ném 401 nếu thiếu (lỗi lắp middleware sai thứ tự). */
export function nguoiDungHienTai(req: { nguoiDung?: NguoiDungDaXacThuc }): NguoiDungDaXacThuc {
  if (!req.nguoiDung) throw loi401();
  return req.nguoiDung;
}

/** Chỉ cho phép các vai trò được liệt kê. */
export function yeuCauVaiTro(...vaiTro: readonly UserRole[]): RequestHandler {
  const chapNhan = new Set<UserRole>(vaiTro);
  return (req, _res, next) => {
    const nguoiDung = nguoiDungHienTai(req);
    if (!chapNhan.has(nguoiDung.role)) {
      next(loi403('Vai trò của bạn không được thực hiện thao tác này.'));
      return;
    }
    next();
  };
}

/**
 * Chặn mọi thao tác nghiệp vụ khi tài khoản còn phải đổi mật khẩu.
 * Đặt SAU `yeuCauDangNhap`, và KHÔNG đặt cho route đổi mật khẩu / đăng xuất /
 * xem thông tin bản thân.
 */
export const chanKhiChuaDoiMatKhau: RequestHandler = (req, _res, next) => {
  const nguoiDung = nguoiDungHienTai(req);
  if (nguoiDung.mustChangePassword) {
    next(
      loi403(
        'Bạn phải đổi mật khẩu trước khi dùng hệ thống.',
      ),
    );
    return;
  }
  next();
};

/** Duyệt/từ chối yêu cầu: chỉ ADMIN và VAN_HANH. */
export const yeuCauNguoiDuyet = yeuCauVaiTro('ADMIN', 'VAN_HANH');
/** Tạo/xoá tài khoản: chỉ ADMIN (VAN_HANH bị loại trừ theo đặc tả). */
export const yeuCauAdmin = yeuCauVaiTro('ADMIN');
