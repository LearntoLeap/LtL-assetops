/**
 * Nghiệp vụ xác thực.
 *
 * KHÔNG có hàm tự đăng ký — tài khoản chỉ được tạo ở modules/nguoi-dung bởi ADMIN.
 */
import type { UserRole } from '@prisma/client';
import { prisma } from '../../prisma.js';
import {
  bamToken,
  capAccessToken,
  capRefreshToken,
  docRefreshToken,
} from '../../lib/jwt.js';
import { bamMatKhau, khopMatKhau, kiemTraDoManh } from '../../lib/mat-khau.js';
import { loi400, loi401, loi403, LoiHttp } from '../../lib/loi-http.js';
import { ghiAudit, ghiAuditKhongChan, type NguoiThaoTac } from '../../lib/audit.js';
import { gioiHanDangNhap } from '../../lib/gioi-han-lan.js';
import { log } from '../../lib/ghi-log.js';
import { ghiViTriDangNhapKho } from './khoa-vi-tri.js';
import type { DuLieuDangNhap } from './auth.schema.js';

export interface BoiCanhGoi {
  ip: string | null;
  userAgent: string | null;
}

export interface HoSoNguoiDung {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  department: string | null;
  locationId: string | null;
  tenDiaDiem: string | null;
  mustChangePassword: boolean;
}

export interface KetQuaDangNhap {
  accessToken: string;
  refreshToken: string;
  nguoiDung: HoSoNguoiDung;
}

async function capBoToken(nguoiDung: {
  id: string;
  email: string;
  role: UserRole;
  locationId: string | null;
}, boiCanh: BoiCanhGoi): Promise<{ accessToken: string; refreshToken: string }> {
  const refresh = capRefreshToken(nguoiDung.id);
  await prisma.refreshToken.create({
    data: {
      userId: nguoiDung.id,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.hetHanLuc,
      ip: boiCanh.ip,
      userAgent: boiCanh.userAgent,
    },
  });
  return {
    accessToken: capAccessToken({
      sub: nguoiDung.id,
      email: nguoiDung.email,
      role: nguoiDung.role,
      locationId: nguoiDung.locationId,
    }),
    refreshToken: refresh.token,
  };
}

/** Thông điệp chung cho email sai và mật khẩu sai — không tiết lộ email có tồn tại. */
const SAI_THONG_TIN = 'Email hoặc mật khẩu không đúng.';

export async function dangNhap(
  duLieu: DuLieuDangNhap,
  boiCanh: BoiCanhGoi,
): Promise<KetQuaDangNhap> {
  const khoaGioiHan = `${duLieu.email}|${boiCanh.ip ?? 'khong-ro'}`;
  const phaiCho = gioiHanDangNhap.ghiNhan(khoaGioiHan);
  if (phaiCho !== null) {
    throw new LoiHttp(
      429,
      `Đã thử sai quá nhiều lần. Vui lòng chờ ${phaiCho} giây rồi thử lại.`,
      'QUA_NHIEU_LAN',
      { choGiay: phaiCho },
    );
  }

  const nguoiDung = await prisma.user.findUnique({
    where: { email: duLieu.email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      fullName: true,
      role: true,
      phone: true,
      department: true,
      locationId: true,
      isLocked: true,
      mustChangePassword: true,
      location: { select: { name: true } },
    },
  });

  if (!nguoiDung || !(await khopMatKhau(duLieu.matKhau, nguoiDung.passwordHash))) {
    await ghiAuditKhongChan({
      actor: null,
      action: 'auth.login.that_bai',
      entityType: 'user',
      entityId: nguoiDung?.id ?? null,
      ...boiCanh,
      note: `Đăng nhập thất bại với email ${duLieu.email}.`,
    });
    throw loi401(SAI_THONG_TIN);
  }

  const nguoiThaoTac: NguoiThaoTac = {
    id: nguoiDung.id,
    email: nguoiDung.email,
    role: nguoiDung.role,
  };

  if (nguoiDung.isLocked) {
    await ghiAuditKhongChan({
      actor: nguoiThaoTac,
      action: 'auth.login.tu_choi',
      entityType: 'user',
      entityId: nguoiDung.id,
      ...boiCanh,
      note: 'Tài khoản đang bị khoá.',
    });
    throw loi403('Tài khoản đã bị khoá. Liên hệ quản trị viên.');
  }

  // XÁC NHẬN BẰNG GPS ĐÃ BỎ HẲN. Không còn phép kiểm nào chặn đăng nhập theo
  // vị trí. Nếu máy có gửi toạ độ thì vẫn ghi nhật ký kèm khoảng cách tới kho,
  // để sau còn truy được ai đăng nhập từ đâu — nhưng thiếu toạ độ cũng vào
  // được bình thường.
  let khoangCach: number | null = null;
  if (nguoiDung.role === 'KHO') {
    const kq = await ghiViTriDangNhapKho({
      nguoiDung: { ...nguoiThaoTac, locationId: nguoiDung.locationId },
      toaDo: duLieu.viTri
        ? { latitude: duLieu.viTri.latitude, longitude: duLieu.viTri.longitude }
        : null,
      boiCanh,
    });
    khoangCach = kq.khoangCachM;
  }

  const boToken = await capBoToken(nguoiDung, boiCanh);
  await prisma.user.update({
    where: { id: nguoiDung.id },
    data: { lastLoginAt: new Date() },
  });

  // Ghi nhật ký MỌI lần đăng nhập, kèm toạ độ nếu có (đặc tả vai trò KHO).
  await ghiAudit({
    actor: nguoiThaoTac,
    action: 'auth.login',
    entityType: 'user',
    entityId: nguoiDung.id,
    ...boiCanh,
    latitude: duLieu.viTri?.latitude ?? null,
    longitude: duLieu.viTri?.longitude ?? null,
    distanceM: khoangCach,
    note:
      nguoiDung.role === 'KHO'
        ? khoangCach === null
          ? 'Đăng nhập kho — máy không gửi toạ độ.'
          : `Đăng nhập kho, cách kho ${khoangCach}m.`
        : null,
  });

  gioiHanDangNhap.xoa(khoaGioiHan);

  return {
    ...boToken,
    nguoiDung: {
      id: nguoiDung.id,
      email: nguoiDung.email,
      fullName: nguoiDung.fullName,
      role: nguoiDung.role,
      phone: nguoiDung.phone,
      department: nguoiDung.department,
      locationId: nguoiDung.locationId,
      tenDiaDiem: nguoiDung.location?.name ?? null,
      mustChangePassword: nguoiDung.mustChangePassword,
    },
  };
}

/**
 * Đổi refresh token cũ lấy bộ token mới (rotation).
 * Nếu phát hiện dùng lại token ĐÃ THU HỒI → thu hồi toàn bộ token của người đó,
 * vì đó là dấu hiệu token bị đánh cắp.
 */
export async function lamMoiToken(
  refreshToken: string,
  boiCanh: BoiCanhGoi,
): Promise<{ accessToken: string; refreshToken: string }> {
  const noiDung = docRefreshToken(refreshToken);
  const banGhi = await prisma.refreshToken.findUnique({
    where: { tokenHash: bamToken(refreshToken) },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  });

  if (!banGhi) throw loi401('Refresh token không còn hiệu lực. Vui lòng đăng nhập lại.');

  if (banGhi.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: banGhi.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await ghiAuditKhongChan({
      actor: null,
      action: 'auth.refresh.dung_lai_token_da_thu_hoi',
      entityType: 'user',
      entityId: banGhi.userId,
      ...boiCanh,
      note: 'Dùng lại refresh token đã thu hồi — đã thu hồi toàn bộ phiên của tài khoản.',
    });
    log.warn('Refresh token đã thu hồi bị dùng lại', { userId: banGhi.userId });
    throw loi401('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
  }

  if (banGhi.expiresAt <= new Date()) {
    throw loi401('Refresh token đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const nguoiDung = await prisma.user.findUnique({
    where: { id: noiDung.sub },
    select: { id: true, email: true, role: true, locationId: true, isLocked: true },
  });
  if (!nguoiDung) throw loi401('Tài khoản không còn tồn tại.');
  if (nguoiDung.isLocked) throw loi403('Tài khoản đã bị khoá. Liên hệ quản trị viên.');

  // Thu hồi token cũ rồi cấp token mới trong cùng một transaction.
  return prisma.$transaction(async () => {
    await prisma.refreshToken.update({
      where: { id: banGhi.id },
      data: { revokedAt: new Date() },
    });
    return capBoToken(nguoiDung, boiCanh);
  });
}

export async function dangXuat(
  refreshToken: string | undefined,
  actor: NguoiThaoTac,
  boiCanh: BoiCanhGoi,
): Promise<void> {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: bamToken(refreshToken), userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await ghiAudit({
    actor,
    action: 'auth.logout',
    entityType: 'user',
    entityId: actor.id,
    ...boiCanh,
  });
}

export async function doiMatKhau(
  actor: NguoiThaoTac,
  matKhauCu: string,
  matKhauMoi: string,
  boiCanh: BoiCanhGoi,
): Promise<void> {
  const nguoiDung = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { passwordHash: true },
  });
  if (!nguoiDung) throw loi401('Tài khoản không còn tồn tại.');

  if (!(await khopMatKhau(matKhauCu, nguoiDung.passwordHash))) {
    throw loi400('Mật khẩu hiện tại không đúng.', 'MAT_KHAU_CU_SAI');
  }
  if (await khopMatKhau(matKhauMoi, nguoiDung.passwordHash)) {
    throw loi400('Mật khẩu mới phải khác mật khẩu hiện tại.', 'MAT_KHAU_TRUNG_CU');
  }
  kiemTraDoManh(matKhauMoi);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: { passwordHash: await bamMatKhau(matKhauMoi), mustChangePassword: false },
    });
    // Đổi mật khẩu thì mọi phiên khác phải đăng nhập lại.
    await tx.refreshToken.updateMany({
      where: { userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await ghiAudit(
      {
        actor,
        action: 'auth.doi_mat_khau',
        entityType: 'user',
        entityId: actor.id,
        ...boiCanh,
        note: 'Người dùng tự đổi mật khẩu; đã thu hồi toàn bộ phiên cũ.',
      },
      tx,
    );
  });
}

export async function hoSoCuaToi(userId: string): Promise<HoSoNguoiDung> {
  const nguoiDung = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      phone: true,
      department: true,
      locationId: true,
      mustChangePassword: true,
      location: { select: { name: true } },
    },
  });
  if (!nguoiDung) throw loi401('Tài khoản không còn tồn tại.');
  const { location, ...conLai } = nguoiDung;
  return { ...conLai, tenDiaDiem: location?.name ?? null };
}
