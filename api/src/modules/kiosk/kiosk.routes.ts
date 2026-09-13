/**
 * MÀN HÌNH KIOSK TẠI KHO (giai đoạn 6).
 *
 * Ba việc:
 *   - dải thống kê cho màn hình lớn (`/thong-ke`) và danh sách việc đang chờ
 *     (`/cho-xu-ly`) — cả hai lọc theo phạm vi vai trò ở server;
 *   - ảnh nền lưu THEO TÀI KHOẢN (`/cai-dat`), chọn mẫu có sẵn hoặc ảnh tải lên;
 *   - danh sách tablet nhóm "Cố định tại kho" cho màn hình tablet riêng.
 *
 * Khoá theo vị trí GPS của tài khoản KHO đã làm ở giai đoạn 2 (lúc đăng nhập),
 * nên ở đây không kiểm lại: phiên đã vào được là phiên đã qua chốt vị trí.
 */
import { Router } from 'express';
import { z } from 'zod';
import { ANH_NEN_KIOSK } from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi404, loi422 } from '../../lib/loi-http.js';
import { dieuKienTaiSan, dieuKienYeuCau } from '../../lib/pham-vi.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
} from '../../middleware/xac-thuc.js';
import { soLieuNhanh } from '../bao-cao/bao-cao.service.js';

export const kioskRouter = Router();
kioskRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

kioskRouter.get(
  '/thong-ke',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    res.json({ ok: true, soLieu: await soLieuNhanh(nguoiDung) });
  }),
);

/** Việc đang chờ tay người ở kho: chờ duyệt, đã duyệt chờ xuất, biên bản chờ xác nhận. */
kioskRouter.get(
  '/cho-xu-ly',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const [yeuCau, bienBan] = await Promise.all([
      prisma.request.findMany({
        where: {
          ...dieuKienYeuCau(nguoiDung),
          type: { not: 'BAO_HONG' },
          status: { in: ['CHO_DUYET', 'DA_DUYET'] },
        },
        select: {
          id: true,
          code: true,
          type: true,
          status: true,
          createdAt: true,
          createdBy: { select: { fullName: true } },
          toLocation: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        take: 30,
      }),
      prisma.handoverNote.findMany({
        where: { status: 'CHO_XAC_NHAN' },
        select: {
          id: true,
          code: true,
          createdAt: true,
          receiverOrg: true,
          receiverLocation: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 30,
      }),
    ]);
    res.json({ ok: true, yeuCau, bienBan });
  }),
);

/** Tablet nhóm "Cố định tại kho" — kèm người đang giữ và lần mượn gần nhất. */
kioskRouter.get(
  '/tablet',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const muc = await prisma.asset.findMany({
      where: {
        ...dieuKienTaiSan(nguoiDung),
        purpose: 'CO_DINH_TAI_KHO',
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        serialNumber: true,
        condition: true,
        allocationStatus: true,
        dueReturnAt: true,
        category: { select: { name: true } },
        currentLocation: { select: { id: true, name: true } },
        holder: { select: { id: true, fullName: true, department: true } },
        // Lần mượn gần nhất: bút toán cho mượn / trả gần đây nhất của chính mã này.
        movements: {
          where: { type: { in: ['CHO_MUON', 'TRA_VE_KHO', 'XUAT_KHO', 'NHAP_KHO'] } },
          select: {
            id: true,
            type: true,
            performedAt: true,
            note: true,
            performedBy: { select: { fullName: true } },
            request: { select: { id: true, code: true, createdBy: { select: { fullName: true } } } },
          },
          orderBy: { performedAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { code: 'asc' },
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

const luocDoCaiDat = z
  .object({
    backgroundKey: z.enum(ANH_NEN_KIOSK).nullable().optional(),
    backgroundPhotoId: z.string().trim().min(1).max(30).nullable().optional(),
  })
  .refine((v) => v.backgroundKey !== undefined || v.backgroundPhotoId !== undefined, {
    message: 'Chưa chọn ảnh nền nào.',
  });

kioskRouter.get(
  '/cai-dat',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const caiDat = await prisma.kioskSetting.findUnique({
      where: { userId: nguoiDung.id },
      select: { backgroundKey: true, backgroundPhotoId: true, updatedAt: true },
    });
    res.json({
      ok: true,
      caiDat: caiDat ?? { backgroundKey: null, backgroundPhotoId: null, updatedAt: null },
    });
  }),
);

/**
 * Lưu ảnh nền THEO TÀI KHOẢN. Chọn mẫu có sẵn thì xoá ảnh tải lên và ngược lại —
 * để không có hai nguồn nền cùng lúc rồi phải đoán cái nào thắng.
 */
kioskRouter.put(
  '/cai-dat',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoCaiDat.parse(req.body);

    let khoa: string | null = null;
    let idAnh: string | null = null;

    if (duLieu.backgroundPhotoId) {
      const anh = await prisma.photo.findUnique({
        where: { id: duLieu.backgroundPhotoId },
        select: { id: true, kind: true },
      });
      if (!anh) throw loi404('Không tìm thấy ảnh nền.');
      if (anh.kind !== 'KIOSK_BACKGROUND') {
        throw loi422('Ảnh phải được tải lên với loại "Ảnh nền màn hình kho".', 'ANH_SAI_LOAI');
      }
      idAnh = anh.id;
    } else if (duLieu.backgroundKey) {
      khoa = duLieu.backgroundKey;
    }

    const caiDat = await prisma.kioskSetting.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, backgroundKey: khoa, backgroundPhotoId: idAnh },
      update: { backgroundKey: khoa, backgroundPhotoId: idAnh },
      select: { backgroundKey: true, backgroundPhotoId: true, updatedAt: true },
    });

    await ghiAudit({
      actor,
      action: 'kiosk.doi_anh_nen',
      entityType: 'kiosk_setting',
      entityId: actor.id,
      afterValue: { backgroundKey: khoa, backgroundPhotoId: idAnh },
      ...boiCanh(req),
    });

    res.json({ ok: true, caiDat });
  }),
);
