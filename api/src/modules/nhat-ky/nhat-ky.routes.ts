/**
 * Nhật ký thao tác và cảnh báo.
 *
 * `audit_logs` là bảng CHỈ GHI THÊM: ở đây chỉ có endpoint ĐỌC, không có
 * POST/PATCH/DELETE nào — đúng nguyên tắc bất biến #4.
 */
import { Router } from 'express';
import { z } from 'zod';
import { LOAI_CANH_BAO, VAI_TRO } from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi404 } from '../../lib/loi-http.js';
import { chuoiTuyChon } from '../../lib/luoc-do-chung.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauNguoiDuyet,
} from '../../middleware/xac-thuc.js';

export const nhatKyRouter = Router();
// Nhật ký và cảnh báo chỉ dành cho nhóm quản lý.
nhatKyRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau, yeuCauNguoiDuyet);

const luocDoLocNhatKy = z.object({
  action: chuoiTuyChon(96),
  entityType: chuoiTuyChon(64),
  entityId: chuoiTuyChon(64),
  actorRole: z.enum(VAI_TRO).optional(),
  tuNgay: chuoiTuyChon(32),
  denNgay: chuoiTuyChon(32),
  trang: z.coerce.number().int().positive().default(1),
  moiTrang: z.coerce.number().int().positive().max(200).default(50),
});

nhatKyRouter.get(
  '/',
  batAsync(async (req, res) => {
    const loc = luocDoLocNhatKy.parse(req.query);
    const tu = loc.tuNgay ? new Date(loc.tuNgay) : null;
    const den = loc.denNgay ? new Date(loc.denNgay) : null;

    const dieuKien = {
      ...(loc.action ? { action: { contains: loc.action } } : {}),
      ...(loc.entityType ? { entityType: loc.entityType } : {}),
      ...(loc.entityId ? { entityId: loc.entityId } : {}),
      ...(loc.actorRole ? { actorRole: loc.actorRole } : {}),
      ...(tu || den
        ? {
            createdAt: {
              ...(tu && !Number.isNaN(tu.getTime()) ? { gte: tu } : {}),
              ...(den && !Number.isNaN(den.getTime()) ? { lte: den } : {}),
            },
          }
        : {}),
    };

    const [muc, tong] = await Promise.all([
      prisma.auditLog.findMany({
        where: dieuKien,
        orderBy: { id: 'desc' },
        skip: (loc.trang - 1) * loc.moiTrang,
        take: loc.moiTrang,
        select: {
          id: true,
          actorEmail: true,
          actorRole: true,
          action: true,
          entityType: true,
          entityId: true,
          beforeValue: true,
          afterValue: true,
          photoIds: true,
          ip: true,
          latitude: true,
          longitude: true,
          distanceM: true,
          note: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where: dieuKien }),
    ]);

    res.json({
      ok: true,
      // id là BigInt — chuyển sang chuỗi để JSON không vỡ.
      muc: muc.map((m) => ({
        ...m,
        id: String(m.id),
        latitude: m.latitude === null ? null : Number(m.latitude),
        longitude: m.longitude === null ? null : Number(m.longitude),
      })),
      tong,
      trang: loc.trang,
      moiTrang: loc.moiTrang,
    });
  }),
);

const luocDoLocCanhBao = z.object({
  type: z.enum(LOAI_CANH_BAO).optional(),
  daXuLy: z.enum(['true', 'false']).default('false'),
  moiTrang: z.coerce.number().int().positive().max(200).default(50),
});

nhatKyRouter.get(
  '/canh-bao',
  batAsync(async (req, res) => {
    const loc = luocDoLocCanhBao.parse(req.query);
    const muc = await prisma.alert.findMany({
      where: {
        ...(loc.type ? { type: loc.type } : {}),
        ...(loc.daXuLy === 'true' ? { resolvedAt: { not: null } } : { resolvedAt: null }),
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: loc.moiTrang,
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        message: true,
        entityType: true,
        entityId: true,
        resolvedAt: true,
        resolutionNote: true,
        createdAt: true,
        asset: { select: { id: true, code: true, name: true } },
        request: { select: { id: true, code: true } },
        resolvedBy: { select: { id: true, fullName: true } },
      },
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

const luocDoXuLy = z.object({
  resolutionNote: z.string().trim().min(3, 'Ghi rõ đã xử lý thế nào.').max(2000),
});

nhatKyRouter.post(
  '/canh-bao/:id/xu-ly',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const { resolutionNote } = luocDoXuLy.parse(req.body);

    const truoc = await prisma.alert.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!truoc) throw loi404('Không tìm thấy cảnh báo.');

    const canhBao = await prisma.alert.update({
      where: { id },
      data: { resolvedAt: new Date(), resolvedById: actor.id, resolutionNote },
      select: { id: true, resolvedAt: true, resolutionNote: true },
    });
    await ghiAudit({
      actor,
      action: 'alert.resolve',
      entityType: 'alert',
      entityId: id,
      afterValue: { resolutionNote },
      note: truoc.title,
      ...boiCanh(req),
    });
    res.json({ ok: true, canhBao });
  }),
);
