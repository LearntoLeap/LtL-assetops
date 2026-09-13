/**
 * Quản lý tài khoản. Chỉ ADMIN tạo/xoá được; VAN_HANH sửa và khoá được nhưng
 * KHÔNG tạo/xoá, và KHÔNG chạm được vào tài khoản ADMIN (đặc tả phân quyền).
 * Không có đường tự đăng ký ở bất cứ đâu.
 */
import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { bamMatKhau, kiemTraDoManh } from '../../lib/mat-khau.js';
import { loi400, loi403, loi404, loi409 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type {
  DuLieuLocNguoiDung,
  DuLieuSuaNguoiDung,
  DuLieuTaoNguoiDung,
} from './nguoi-dung.schema.js';

/** Vai trò buộc phải gắn với một điểm lưu trữ, và loại điểm tương ứng. */
const DIEM_BAT_BUOC: Partial<Record<UserRole, Prisma.EnumLocationTypeFilter>> = {
  KHO: { in: ['KHO_VAN_PHONG', 'KHO_SU_KIEN'] },
  TRUONG: { equals: 'DIEM_TRUONG' },
};

const CHON_HO_SO = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  department: true,
  locationId: true,
  isLocked: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  location: { select: { id: true, code: true, name: true, type: true } },
} satisfies Prisma.UserSelect;

export type HoSoQuanTri = Prisma.UserGetPayload<{ select: typeof CHON_HO_SO }>;

/**
 * Kiểm điểm lưu trữ khớp vai trò. Vai trò KHO phải gắn kho, TRUONG phải gắn
 * điểm trường — gắn sai thì phạm vi dữ liệu sẽ sai theo.
 */
async function kiemDiemLuuTru(role: UserRole, locationId: string | null): Promise<void> {
  const batBuoc = DIEM_BAT_BUOC[role];
  if (!batBuoc) return;

  if (!locationId) {
    throw loi400(
      role === 'KHO'
        ? 'Vai trò Kho phải được gán một điểm kho.'
        : 'Vai trò Điểm trường phải được gán một điểm trường.',
      'THIEU_DIEM_LUU_TRU',
    );
  }

  const diem = await prisma.location.findFirst({
    where: { id: locationId, type: batBuoc },
    select: { id: true },
  });
  if (!diem) {
    throw loi400(
      role === 'KHO'
        ? 'Điểm đã chọn không phải điểm kho.'
        : 'Điểm đã chọn không phải điểm trường.',
      'DIEM_LUU_TRU_SAI_LOAI',
    );
  }
}

/** VAN_HANH không được chạm vào tài khoản ADMIN. */
function chanVanHanhSuaAdmin(actorRole: UserRole, roleMucTieu: UserRole): void {
  if (actorRole === 'VAN_HANH' && roleMucTieu === 'ADMIN') {
    throw loi403('Vai trò Vận hành không được thao tác trên tài khoản Quản trị hệ thống.');
  }
}

/** Không được để hệ thống còn 0 quản trị viên hoạt động. */
async function chanBoAdminCuoiCung(userId: string): Promise<void> {
  const conLai = await prisma.user.count({
    where: { role: 'ADMIN', isLocked: false, id: { not: userId } },
  });
  if (conLai === 0) {
    throw loi409(
      'Đây là quản trị viên hoạt động duy nhất. Hãy tạo hoặc mở khoá một quản trị viên khác trước.',
    );
  }
}

export async function danhSach(
  loc: DuLieuLocNguoiDung,
): Promise<{ muc: HoSoQuanTri[]; tong: number; trang: number; moiTrang: number }> {
  const dieuKien: Prisma.UserWhereInput = {
    ...(loc.role ? { role: loc.role } : {}),
    ...(loc.isLocked ? { isLocked: loc.isLocked === 'true' } : {}),
    ...(loc.tuKhoa
      ? {
          OR: [{ email: { contains: loc.tuKhoa } }, { fullName: { contains: loc.tuKhoa } }],
        }
      : {}),
  };

  const [muc, tong] = await Promise.all([
    prisma.user.findMany({
      where: dieuKien,
      select: CHON_HO_SO,
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.user.count({ where: dieuKien }),
  ]);
  return { muc, tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

export async function xemMot(id: string): Promise<HoSoQuanTri> {
  const nguoiDung = await prisma.user.findUnique({ where: { id }, select: CHON_HO_SO });
  if (!nguoiDung) throw loi404('Không tìm thấy tài khoản.');
  return nguoiDung;
}

export async function tao(
  duLieu: DuLieuTaoNguoiDung,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<HoSoQuanTri> {
  kiemTraDoManh(duLieu.matKhau);
  const locationId = duLieu.locationId?.trim() || null;
  await kiemDiemLuuTru(duLieu.role, locationId);

  const daCo = await prisma.user.findUnique({
    where: { email: duLieu.email },
    select: { id: true },
  });
  if (daCo) throw loi409('Email này đã có tài khoản.', { truong: 'email' });

  const taoMoi = await prisma.user.create({
    data: {
      email: duLieu.email,
      passwordHash: await bamMatKhau(duLieu.matKhau),
      fullName: duLieu.fullName,
      phone: duLieu.phone ?? null,
      role: duLieu.role,
      department: duLieu.department ?? null,
      locationId,
      mustChangePassword: duLieu.mustChangePassword,
      createdById: actor.id,
    },
    select: CHON_HO_SO,
  });

  await ghiAudit({
    actor,
    action: 'user.create',
    entityType: 'user',
    entityId: taoMoi.id,
    afterValue: {
      email: taoMoi.email,
      fullName: taoMoi.fullName,
      role: taoMoi.role,
      department: taoMoi.department,
      locationId: taoMoi.locationId,
    },
    ...ctx,
  });

  return taoMoi;
}

export async function sua(
  id: string,
  duLieu: DuLieuSuaNguoiDung,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<HoSoQuanTri> {
  const truoc = await xemMot(id);
  chanVanHanhSuaAdmin(actor.role, truoc.role);

  const roleMoi = duLieu.role ?? truoc.role;
  chanVanHanhSuaAdmin(actor.role, roleMoi);

  // Lược đồ đã chuẩn hoá: undefined = giữ nguyên, null = bỏ gán điểm.
  const locationId = duLieu.locationId === undefined ? truoc.locationId : duLieu.locationId;
  await kiemDiemLuuTru(roleMoi, locationId);

  if (truoc.role === 'ADMIN' && roleMoi !== 'ADMIN') {
    await chanBoAdminCuoiCung(id);
  }

  const sau = await prisma.user.update({
    where: { id },
    data: {
      ...(duLieu.fullName === undefined ? {} : { fullName: duLieu.fullName }),
      ...(duLieu.role === undefined ? {} : { role: duLieu.role }),
      ...(duLieu.phone === undefined ? {} : { phone: duLieu.phone }),
      ...(duLieu.department === undefined ? {} : { department: duLieu.department }),
      ...(duLieu.locationId === undefined ? {} : { locationId }),
    },
    select: CHON_HO_SO,
  });

  await ghiAudit({
    actor,
    action: 'user.update',
    entityType: 'user',
    entityId: id,
    beforeValue: {
      fullName: truoc.fullName,
      role: truoc.role,
      phone: truoc.phone,
      department: truoc.department,
      locationId: truoc.locationId,
    },
    afterValue: {
      fullName: sau.fullName,
      role: sau.role,
      phone: sau.phone,
      department: sau.department,
      locationId: sau.locationId,
    },
    ...ctx,
  });

  return sau;
}

export async function datKhoa(
  id: string,
  isLocked: boolean,
  lyDo: string | undefined,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<HoSoQuanTri> {
  const truoc = await xemMot(id);
  chanVanHanhSuaAdmin(actor.role, truoc.role);

  if (id === actor.id && isLocked) {
    throw loi400('Không thể tự khoá tài khoản của chính mình.', 'TU_KHOA');
  }
  if (isLocked && truoc.role === 'ADMIN') await chanBoAdminCuoiCung(id);
  if (truoc.isLocked === isLocked) return truoc;

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.user.update({
      where: { id },
      data: { isLocked },
      select: CHON_HO_SO,
    });
    // Khoá tài khoản thì thu hồi ngay mọi phiên đang mở.
    if (isLocked) {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await ghiAudit(
      {
        actor,
        action: isLocked ? 'user.lock' : 'user.unlock',
        entityType: 'user',
        entityId: id,
        beforeValue: { isLocked: truoc.isLocked },
        afterValue: { isLocked },
        note: lyDo ?? null,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  return sau;
}

export async function datLaiMatKhau(
  id: string,
  matKhauMoi: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<void> {
  const truoc = await xemMot(id);
  chanVanHanhSuaAdmin(actor.role, truoc.role);
  kiemTraDoManh(matKhauMoi);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        passwordHash: await bamMatKhau(matKhauMoi),
        // Người dùng buộc phải tự đổi lại ở lần đăng nhập tới.
        mustChangePassword: true,
      },
    });
    await tx.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await ghiAudit(
      {
        actor,
        action: 'user.dat_lai_mat_khau',
        entityType: 'user',
        entityId: id,
        note: 'Quản trị đặt lại mật khẩu; đã thu hồi mọi phiên và bắt buộc đổi lại.',
        ...ctx,
      },
      tx,
    );
  });
}

/**
 * Xoá tài khoản — chỉ ADMIN. Từ chối nếu tài khoản đã xuất hiện trong dữ liệu
 * lịch sử (movements, requests, ảnh…): lịch sử phải giữ được người thực hiện.
 * Khi đó dùng chức năng KHOÁ thay vì xoá.
 */
export async function xoa(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await xemMot(id);
  if (id === actor.id) throw loi400('Không thể tự xoá tài khoản của chính mình.', 'TU_XOA');
  if (truoc.role === 'ADMIN') await chanBoAdminCuoiCung(id);

  const [movement, yeuCau, duyet, anh, kiemKe, bbbg, taiSanGiu] = await Promise.all([
    prisma.movement.count({ where: { performedById: id } }),
    prisma.request.count({ where: { createdById: id } }),
    prisma.request.count({ where: { approvedById: id } }),
    prisma.photo.count({ where: { uploadedById: id } }),
    prisma.inventoryCount.count({ where: { createdById: id } }),
    prisma.handoverNote.count({ where: { createdById: id } }),
    prisma.asset.count({ where: { holderUserId: id } }),
  ]);
  const rangBuoc = { movement, yeuCau, duyet, anh, kiemKe, bbbg, taiSanGiu };
  const tong = Object.values(rangBuoc).reduce((s, n) => s + n, 0);

  if (tong > 0) {
    throw loi409(
      'Tài khoản đã có dữ liệu lịch sử nên không xoá được (lịch sử phải giữ được người thực hiện). Hãy dùng chức năng Khoá tài khoản.',
      rangBuoc,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Ghi audit TRƯỚC khi xoá, vì audit_logs.actor_user_id sẽ thành null sau đó.
    await ghiAudit(
      {
        actor,
        action: 'user.delete',
        entityType: 'user',
        entityId: id,
        beforeValue: { email: truoc.email, fullName: truoc.fullName, role: truoc.role },
        note: 'Xoá tài khoản chưa phát sinh dữ liệu lịch sử.',
        ...ctx,
      },
      tx,
    );
    await tx.user.delete({ where: { id } });
  });
}
