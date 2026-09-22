/**
 * Danh mục nền: dòng giải pháp và loại tài sản.
 * Đọc: mọi tài khoản đã đăng nhập (form tạo thiết bị cần).
 * Ghi: ADMIN và VAN_HANH. Xoá: chỉ ADMIN, và chỉ khi chưa có thiết bị nào dùng.
 */
import { Router } from 'express';
import { z } from 'zod';
import { KIEU_QUAN_LY } from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi404, loi409 } from '../../lib/loi-http.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauAdmin,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';

export const danhMucRouter = Router();
danhMucRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

const chiSuaDuoc = yeuCauVaiTro('ADMIN', 'VAN_HANH');

/** Mã danh mục: CHỮ HOA, số và gạch dưới — dùng trong file Excel nhập liệu. */
const maDanhMuc = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'Mã phải có ít nhất 2 ký tự.')
  .max(64)
  .regex(/^[A-Z0-9_]+$/, 'Mã chỉ gồm chữ in hoa, số và dấu gạch dưới.');

const luocDoDongGiaiPhap = z.object({
  code: maDanhMuc,
  name: z.string().trim().min(1, 'Chưa nhập tên.').max(191),
  note: z.string().trim().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const luocDoLoaiTaiSan = luocDoDongGiaiPhap.extend({
  defaultTrackingType: z.enum(KIEU_QUAN_LY).default('DON_VI'),
  /**
   * Loại này có bắt buộc quét/gõ đúng mã thiết bị khi xuất–nhập kho hay không.
   * Chỉ nên bật cho loại có dán nhãn mã trên từng cái (robot); loại còn lại khai
   * TÊN + SỐ LƯỢNG kèm ảnh, vì thùng 200 quyển vở không có nhãn nào để quét.
   */
  yeuCauQuetMa: z.boolean().default(false),
});

// ---------------------------------------------------------------- dòng giải pháp

danhMucRouter.get(
  '/dong-giai-phap',
  batAsync(async (_req, res) => {
    const muc = await prisma.productLine.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assets: true } } },
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

danhMucRouter.post(
  '/dong-giai-phap',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoDongGiaiPhap.parse(req.body);
    if (await prisma.productLine.findUnique({ where: { code: duLieu.code }, select: { id: true } })) {
      throw loi409('Mã dòng giải pháp đã tồn tại.', { truong: 'code' });
    }
    const muc = await prisma.productLine.create({
      data: { ...duLieu, note: duLieu.note ?? null },
    });
    await ghiAudit({
      actor,
      action: 'product_line.create',
      entityType: 'product_line',
      entityId: muc.id,
      afterValue: { code: muc.code, name: muc.name },
      ...boiCanh(req),
    });
    res.status(201).json({ ok: true, muc });
  }),
);

danhMucRouter.patch(
  '/dong-giai-phap/:id',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const duLieu = luocDoDongGiaiPhap.partial().omit({ code: true }).parse(req.body);
    const truoc = await prisma.productLine.findUnique({ where: { id } });
    if (!truoc) throw loi404('Không tìm thấy dòng giải pháp.');

    const sau = await prisma.productLine.update({
      where: { id },
      data: {
        ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
        ...(duLieu.note === undefined ? {} : { note: duLieu.note || null }),
        ...(duLieu.sortOrder === undefined ? {} : { sortOrder: duLieu.sortOrder }),
        ...(duLieu.isActive === undefined ? {} : { isActive: duLieu.isActive }),
      },
    });
    await ghiAudit({
      actor,
      action: 'product_line.update',
      entityType: 'product_line',
      entityId: id,
      beforeValue: { name: truoc.name, isActive: truoc.isActive, sortOrder: truoc.sortOrder },
      afterValue: { name: sau.name, isActive: sau.isActive, sortOrder: sau.sortOrder },
      ...boiCanh(req),
    });
    res.json({ ok: true, muc: sau });
  }),
);

danhMucRouter.delete(
  '/dong-giai-phap/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.productLine.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    if (!truoc) throw loi404('Không tìm thấy dòng giải pháp.');
    if (truoc._count.assets > 0) {
      throw loi409(
        `Còn ${truoc._count.assets} thiết bị thuộc dòng này nên không xoá được. Hãy đặt Ngừng dùng thay vì xoá.`,
        { soThietBi: truoc._count.assets },
      );
    }
    await prisma.$transaction(async (tx) => {
      await ghiAudit(
        {
          actor,
          action: 'product_line.delete',
          entityType: 'product_line',
          entityId: id,
          beforeValue: { code: truoc.code, name: truoc.name },
          ...boiCanh(req),
        },
        tx,
      );
      await tx.productLine.delete({ where: { id } });
    });
    res.json({ ok: true, thongDiep: 'Đã xoá dòng giải pháp.' });
  }),
);

// ------------------------------------------------------------------ loại tài sản

danhMucRouter.get(
  '/loai-tai-san',
  batAsync(async (_req, res) => {
    const muc = await prisma.assetCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assets: true } } },
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

danhMucRouter.post(
  '/loai-tai-san',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoLoaiTaiSan.parse(req.body);
    if (await prisma.assetCategory.findUnique({ where: { code: duLieu.code }, select: { id: true } })) {
      throw loi409('Mã loại tài sản đã tồn tại.', { truong: 'code' });
    }
    const muc = await prisma.assetCategory.create({
      data: { ...duLieu, note: duLieu.note ?? null },
    });
    await ghiAudit({
      actor,
      action: 'asset_category.create',
      entityType: 'asset_category',
      entityId: muc.id,
      afterValue: { code: muc.code, name: muc.name },
      ...boiCanh(req),
    });
    res.status(201).json({ ok: true, muc });
  }),
);

danhMucRouter.patch(
  '/loai-tai-san/:id',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const duLieu = luocDoLoaiTaiSan.partial().omit({ code: true }).parse(req.body);
    const truoc = await prisma.assetCategory.findUnique({ where: { id } });
    if (!truoc) throw loi404('Không tìm thấy loại tài sản.');

    const sau = await prisma.assetCategory.update({
      where: { id },
      data: {
        ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
        ...(duLieu.note === undefined ? {} : { note: duLieu.note || null }),
        ...(duLieu.sortOrder === undefined ? {} : { sortOrder: duLieu.sortOrder }),
        ...(duLieu.isActive === undefined ? {} : { isActive: duLieu.isActive }),
        ...(duLieu.defaultTrackingType === undefined
          ? {}
          : { defaultTrackingType: duLieu.defaultTrackingType }),
        ...(duLieu.yeuCauQuetMa === undefined ? {} : { yeuCauQuetMa: duLieu.yeuCauQuetMa }),
      },
    });
    await ghiAudit({
      actor,
      action: 'asset_category.update',
      entityType: 'asset_category',
      entityId: id,
      beforeValue: {
        name: truoc.name,
        defaultTrackingType: truoc.defaultTrackingType,
        yeuCauQuetMa: truoc.yeuCauQuetMa,
      },
      afterValue: {
        name: sau.name,
        defaultTrackingType: sau.defaultTrackingType,
        yeuCauQuetMa: sau.yeuCauQuetMa,
      },
      ...boiCanh(req),
    });
    res.json({ ok: true, muc: sau });
  }),
);

danhMucRouter.delete(
  '/loai-tai-san/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.assetCategory.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    if (!truoc) throw loi404('Không tìm thấy loại tài sản.');
    if (truoc._count.assets > 0) {
      throw loi409(
        `Còn ${truoc._count.assets} thiết bị thuộc loại này nên không xoá được. Hãy đặt Ngừng dùng thay vì xoá.`,
        { soThietBi: truoc._count.assets },
      );
    }
    await prisma.$transaction(async (tx) => {
      await ghiAudit(
        {
          actor,
          action: 'asset_category.delete',
          entityType: 'asset_category',
          entityId: id,
          beforeValue: { code: truoc.code, name: truoc.name },
          ...boiCanh(req),
        },
        tx,
      );
      await tx.assetCategory.delete({ where: { id } });
    });
    res.json({ ok: true, thongDiep: 'Đã xoá loại tài sản.' });
  }),
);
