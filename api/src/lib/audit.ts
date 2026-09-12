/**
 * Ghi nhật ký thao tác (nguyên tắc bất biến #4): ai, khi nào, từ đâu, đến đâu,
 * ảnh nào. Bảng `audit_logs` chỉ ghi thêm — không có hàm sửa/xoá ở đây, và
 * cũng không có endpoint nào sửa/xoá nó.
 */
import type { Request } from 'express';
import type { Prisma, UserRole } from '@prisma/client';
import { prisma, type PrismaTx } from '../prisma.js';
import { log, moTaLoi } from './ghi-log.js';

export interface NguoiThaoTac {
  id: string;
  email: string;
  role: UserRole;
}

export interface BanGhiAudit {
  /** null khi do hệ thống tự sinh (job quá hạn, script seed…). */
  actor: NguoiThaoTac | null;
  /** Vd "auth.login", "user.create", "request.approve". */
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeValue?: Prisma.InputJsonValue | undefined;
  afterValue?: Prisma.InputJsonValue | undefined;
  photoIds?: string[] | undefined;
  ip?: string | null;
  userAgent?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceM?: number | null;
  note?: string | null;
}

/** Rút IP thật và user agent từ request (API đã bật trust proxy). */
export function boiCanh(req: Request): { ip: string | null; userAgent: string | null } {
  const ua = req.get('user-agent');
  return {
    ip: req.ip ?? null,
    // Cột user_agent dài 191 ký tự
    userAgent: ua ? ua.slice(0, 191) : null,
  };
}

export async function ghiAudit(banGhi: BanGhiAudit, db: PrismaTx = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorUserId: banGhi.actor?.id ?? null,
      actorEmail: banGhi.actor?.email ?? null,
      actorRole: banGhi.actor?.role ?? null,
      action: banGhi.action,
      entityType: banGhi.entityType,
      entityId: banGhi.entityId ?? null,
      ...(banGhi.beforeValue === undefined ? {} : { beforeValue: banGhi.beforeValue }),
      ...(banGhi.afterValue === undefined ? {} : { afterValue: banGhi.afterValue }),
      ...(banGhi.photoIds === undefined ? {} : { photoIds: banGhi.photoIds }),
      ip: banGhi.ip ?? null,
      userAgent: banGhi.userAgent ?? null,
      latitude: banGhi.latitude ?? null,
      longitude: banGhi.longitude ?? null,
      distanceM: banGhi.distanceM ?? null,
      note: banGhi.note ?? null,
    },
  });
}

/**
 * Ghi audit cho những việc KHÔNG được phép thất bại theo (đăng nhập bị chặn,
 * đăng nhập sai…): nếu ghi log lỗi thì vẫn trả kết quả cho người dùng, nhưng
 * báo động vào log hệ thống.
 */
export async function ghiAuditKhongChan(banGhi: BanGhiAudit, db: PrismaTx = prisma): Promise<void> {
  try {
    await ghiAudit(banGhi, db);
  } catch (loi) {
    log.error('Không ghi được nhật ký thao tác', { action: banGhi.action, ...moTaLoi(loi) });
  }
}
