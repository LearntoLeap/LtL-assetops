/**
 * Mã vượt quyền GPS dùng MỘT LẦN — chỉ ADMIN cấp.
 *
 * Mã gốc chỉ hiện ĐÚNG MỘT LẦN ở phản hồi lúc cấp; CSDL chỉ lưu bcrypt hash và
 * 4 ký tự đầu. Vì vậy không có endpoint nào đọc lại mã: mất thì cấp mã mới.
 */
import { Router } from 'express';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi400, loi404, loi409 } from '../../lib/loi-http.js';
import { sinhMa, tienToMa } from '../../lib/ma-vuot-quyen.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauAdmin,
  yeuCauDangNhap,
} from '../../middleware/xac-thuc.js';

export const vuotQuyenGpsRouter = Router();

// Toàn bộ nhóm route này chỉ ADMIN dùng được.
vuotQuyenGpsRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau, yeuCauAdmin);

const SO_VONG_BCRYPT = 10;
const PHUT_TOI_DA = 24 * 60;

const luocDoCap = z.object({
  locationId: z.string().trim().min(1, 'Chưa chọn kho.').max(30),
  /** Cấp riêng cho một tài khoản (tuỳ chọn) — để trống là dùng được cho mọi tài khoản kho đó. */
  issuedForId: z.string().trim().max(30).optional(),
  reason: z.string().trim().max(255).optional(),
  /** Hiệu lực tính bằng phút, mặc định 60, tối đa 24 giờ. */
  hieuLucPhut: z.coerce.number().int().min(5).max(PHUT_TOI_DA).default(60),
});

vuotQuyenGpsRouter.post(
  '/',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoCap.parse(req.body);

    const kho = await prisma.location.findUnique({
      where: { id: duLieu.locationId },
      select: { id: true, name: true, type: true },
    });
    if (!kho) throw loi404('Không tìm thấy điểm lưu trữ.');
    if (kho.type !== 'KHO_VAN_PHONG' && kho.type !== 'KHO_SU_KIEN') {
      throw loi400('Mã vượt quyền GPS chỉ cấp cho điểm kho.', 'DIEM_KHONG_PHAI_KHO');
    }

    if (duLieu.issuedForId) {
      const nhan = await prisma.user.findUnique({
        where: { id: duLieu.issuedForId },
        select: { id: true, role: true, locationId: true },
      });
      if (!nhan) throw loi404('Không tìm thấy tài khoản được cấp mã.');
      if (nhan.role !== 'KHO') {
        throw loi400('Chỉ cấp mã vượt quyền cho tài khoản vai trò Kho.', 'SAI_VAI_TRO');
      }
      if (nhan.locationId !== kho.id) {
        throw loi400('Tài khoản này không thuộc kho đã chọn.', 'KHONG_THUOC_KHO');
      }
    }

    const { maChuan, maHienThi } = sinhMa();
    const hetHan = new Date(Date.now() + duLieu.hieuLucPhut * 60_000);

    const banGhi = await prisma.gpsOverrideCode.create({
      data: {
        codeHash: await hash(maChuan, SO_VONG_BCRYPT),
        codePrefix: tienToMa(maChuan),
        locationId: kho.id,
        issuedById: actor.id,
        issuedForId: duLieu.issuedForId ?? null,
        reason: duLieu.reason ?? null,
        expiresAt: hetHan,
      },
      select: { id: true, codePrefix: true, expiresAt: true, createdAt: true },
    });

    await ghiAudit({
      actor,
      action: 'gps_override.cap',
      entityType: 'gps_override_code',
      entityId: banGhi.id,
      afterValue: {
        locationId: kho.id,
        tenKho: kho.name,
        codePrefix: banGhi.codePrefix,
        expiresAt: hetHan.toISOString(),
        issuedForId: duLieu.issuedForId ?? null,
      },
      note: duLieu.reason ?? 'Cấp mã vượt quyền GPS dùng một lần.',
      ...boiCanh(req),
    });

    res.status(201).json({
      ok: true,
      // Mã gốc CHỈ trả về lần này. Đọc cho nhân viên kho rồi không lưu lại.
      ma: maHienThi,
      canhBao: 'Mã chỉ hiện một lần. Đọc cho nhân viên kho ngay; mất thì phải cấp mã mới.',
      banGhi: { ...banGhi, tenKho: kho.name },
    });
  }),
);

const luocDoLoc = z.object({
  locationId: z.string().trim().max(30).optional(),
  trangThai: z.enum(['con_hieu_luc', 'da_dung', 'het_han', 'tat_ca']).default('con_hieu_luc'),
});

vuotQuyenGpsRouter.get(
  '/',
  batAsync(async (req, res) => {
    const loc = luocDoLoc.parse(req.query);
    const bayGio = new Date();
    const theoTrangThai =
      loc.trangThai === 'con_hieu_luc'
        ? { usedAt: null, expiresAt: { gt: bayGio } }
        : loc.trangThai === 'da_dung'
          ? { usedAt: { not: null } }
          : loc.trangThai === 'het_han'
            ? { usedAt: null, expiresAt: { lte: bayGio } }
            : {};

    const muc = await prisma.gpsOverrideCode.findMany({
      where: { ...(loc.locationId ? { locationId: loc.locationId } : {}), ...theoTrangThai },
      select: {
        id: true,
        codePrefix: true,
        reason: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        location: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, fullName: true } },
        issuedFor: { select: { id: true, fullName: true } },
        usedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

/** Thu hồi mã chưa dùng (đặt hết hạn về hiện tại). Mã đã dùng thì giữ làm bằng chứng. */
vuotQuyenGpsRouter.delete(
  '/:id',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);

    const banGhi = await prisma.gpsOverrideCode.findUnique({
      where: { id },
      select: { id: true, usedAt: true, codePrefix: true },
    });
    if (!banGhi) throw loi404('Không tìm thấy mã vượt quyền.');
    if (banGhi.usedAt) {
      throw loi409('Mã đã được dùng nên không thu hồi được — bản ghi giữ lại làm bằng chứng.');
    }

    await prisma.gpsOverrideCode.update({
      where: { id },
      data: { expiresAt: new Date() },
    });

    await ghiAudit({
      actor,
      action: 'gps_override.thu_hoi',
      entityType: 'gps_override_code',
      entityId: id,
      note: `Thu hồi mã ${banGhi.codePrefix}****.`,
      ...boiCanh(req),
    });

    res.json({ ok: true, thongDiep: 'Đã thu hồi mã vượt quyền.' });
  }),
);
