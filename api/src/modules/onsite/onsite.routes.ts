/**
 * CẬP NHẬT ONSITE theo từng điểm trường.
 *
 * Người xuống trường (nhân sự phụ trách, kho, vận hành, hoặc chính tài khoản
 * trường) ghi lại tình trạng từng thiết bị thấy tận mắt, kèm ảnh. Mỗi lần ghi
 * là một phiếu OS-2026-0001 gồm nhiều dòng thiết bị.
 *
 * CHỈ GHI NHẬN — không ghi movement, không sửa tình trạng trong sổ. Tồn kho chỉ
 * đổi qua xuất / nhập / kiểm kê (nguyên tắc #5); nếu thấy hỏng, mất, hoặc số
 * thấy khác số sổ thì hệ thống tạo cảnh báo cho quản trị xử lý tiếp (Báo hỏng,
 * Kiểm kê).
 *
 * PHẠM VI (kiểm ở đây, không dựa vào ẩn nút):
 *   - tài khoản TRƯỜNG: chỉ trường của mình — xem và ghi;
 *   - quản trị, vận hành, kho, nhân sự: mọi điểm trường.
 */
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { NHAN_TINH_TRANG, TINH_TRANG } from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi403, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { tonTatCa, tonTheoDiaDiem } from '../../lib/ton-kho.js';
import { phatChoDiaDiem, phatChoNguoiDuyet, SU_KIEN } from '../../realtime.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';

export const onsiteRouter = Router();
onsiteRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

/** Tình trạng coi là "có vấn đề" — cần quản trị để mắt. */
const TINH_TRANG_VAN_DE = new Set(['HONG', 'MAT', 'CAN_BAO_TRI']);

/** Điểm trường người dùng được xem / ghi onsite. */
function dieuKienDiemOnsite(nd: NguoiDungDaXacThuc): Prisma.LocationWhereInput {
  const coBan: Prisma.LocationWhereInput = { deletedAt: null, type: 'DIEM_TRUONG' };
  if (nd.role === 'TRUONG') {
    if (!nd.locationId) {
      throw loi403('Tài khoản điểm trường chưa được gán trường phụ trách. Liên hệ quản trị viên.');
    }
    return { AND: [coBan, { id: nd.locationId }] };
  }
  return coBan;
}

async function diemTrongPhamVi(nd: NguoiDungDaXacThuc, locationId: string) {
  const diem = await prisma.location.findFirst({
    where: { AND: [{ id: locationId }, dieuKienDiemOnsite(nd)] },
    select: { id: true, code: true, name: true, address: true, isActive: true },
  });
  if (!diem) throw loi404('Không tìm thấy điểm trường, hoặc điểm này ngoài phạm vi của bạn.');
  return diem;
}

/** Dòng có vấn đề: tình trạng xấu, hoặc số thấy khác số sổ sách. */
function laVanDe(m: { condition: string; seenQuantity: number | null; systemQuantity: number }) {
  return (
    TINH_TRANG_VAN_DE.has(m.condition) ||
    (m.seenQuantity !== null && m.seenQuantity !== m.systemQuantity)
  );
}

// ---------------------------------------------------------------------------
// Danh sách điểm trường + tóm tắt
// ---------------------------------------------------------------------------

onsiteRouter.get(
  '/diem',
  batAsync(async (req, res) => {
    const nd = nguoiDungHienTai(req);
    const { tuKhoa } = z
      .object({ tuKhoa: z.string().trim().max(191).optional() })
      .parse(req.query);

    const diem = await prisma.location.findMany({
      where: {
        AND: [
          dieuKienDiemOnsite(nd),
          tuKhoa ? { OR: [{ name: { contains: tuKhoa } }, { code: { contains: tuKhoa } }] } : {},
        ],
      },
      select: { id: true, code: true, name: true, address: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    const ids = diem.map((d) => d.id);

    const [ton, lanCuoi] = await Promise.all([
      tonTatCa(),
      ids.length === 0
        ? Promise.resolve([])
        : prisma.onsiteVisit.findMany({
            where: { deletedAt: null, locationId: { in: ids } },
            orderBy: { visitedAt: 'desc' },
            select: {
              id: true,
              code: true,
              locationId: true,
              visitedAt: true,
              createdBy: { select: { fullName: true } },
              items: { select: { condition: true, seenQuantity: true, systemQuantity: true } },
            },
          }),
    ]);

    // Tách bộ / hàng lẻ theo từng trường — cùng cách tính với trang Tổng quan.
    const kieu = new Map(
      (
        await prisma.asset.findMany({
          where: { deletedAt: null, id: { in: [...new Set(ton.map((t) => t.assetId))] } },
          select: { id: true, trackingType: true },
        })
      ).map((a) => [a.id, a.trackingType]),
    );
    const theoDiem = new Map<string, { bo: number; le: number; soMaLe: number }>();
    for (const t of ton) {
      if (t.ton <= 0 || !ids.includes(t.locationId)) continue;
      const k = kieu.get(t.assetId);
      if (!k) continue;
      const cu = theoDiem.get(t.locationId) ?? { bo: 0, le: 0, soMaLe: 0 };
      if (k === 'DON_VI') cu.bo += t.ton;
      else {
        cu.le += t.ton;
        cu.soMaLe += 1;
      }
      theoDiem.set(t.locationId, cu);
    }

    const cuoiTheoDiem = new Map<string, (typeof lanCuoi)[number]>();
    const soLan = new Map<string, number>();
    for (const v of lanCuoi) {
      if (!cuoiTheoDiem.has(v.locationId)) cuoiTheoDiem.set(v.locationId, v);
      soLan.set(v.locationId, (soLan.get(v.locationId) ?? 0) + 1);
    }

    res.json({
      ok: true,
      muc: diem.map((d) => {
        const v = cuoiTheoDiem.get(d.id);
        const sl = theoDiem.get(d.id) ?? { bo: 0, le: 0, soMaLe: 0 };
        return {
          ...d,
          bo: sl.bo,
          le: sl.le,
          soMaLe: sl.soMaLe,
          soLanCapNhat: soLan.get(d.id) ?? 0,
          lanCuoi: v
            ? {
                id: v.id,
                code: v.code,
                visitedAt: v.visitedAt,
                nguoiGhi: v.createdBy.fullName,
                soVanDe: v.items.filter(laVanDe).length,
              }
            : null,
        };
      }),
    });
  }),
);

// ---------------------------------------------------------------------------
// Một điểm trường: thiết bị đang ở đó + tình trạng ghi nhận gần nhất + lịch sử
// ---------------------------------------------------------------------------

onsiteRouter.get(
  '/diem/:locationId',
  batAsync(async (req, res) => {
    const nd = nguoiDungHienTai(req);
    const diem = await diemTrongPhamVi(nd, String(req.params['locationId']));

    // Thiết bị Ở TRƯỜNG tính theo tồn thật (nhật ký di chuyển), KHÔNG theo cột
    // vị trí: hàng lẻ chia một phần về trường thì cột vị trí vẫn là kho.
    const ton = (await tonTheoDiaDiem(diem.id)).filter((t) => t.ton > 0);
    const [thietBi, cacLan] = await Promise.all([
      prisma.asset.findMany({
        where: { deletedAt: null, id: { in: ton.map((t) => t.assetId) } },
        select: {
          id: true,
          code: true,
          name: true,
          trackingType: true,
          condition: true,
          category: { select: { name: true } },
        },
        orderBy: [{ trackingType: 'asc' }, { code: 'asc' }],
      }),
      prisma.onsiteVisit.findMany({
        where: { deletedAt: null, locationId: diem.id },
        orderBy: { visitedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          code: true,
          visitedAt: true,
          summary: true,
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { photos: true } },
          items: {
            select: {
              assetId: true,
              condition: true,
              seenQuantity: true,
              systemQuantity: true,
              note: true,
            },
          },
        },
      }),
    ]);
    const tonTheoMa = new Map(ton.map((t) => [t.assetId, t.ton]));

    // Ghi nhận gần nhất của từng thiết bị (các lần đã sắp mới → cũ).
    const ganNhat = new Map<
      string,
      { condition: string; seenQuantity: number | null; note: string | null; visitedAt: Date; code: string }
    >();
    for (const v of cacLan) {
      for (const m of v.items) {
        if (!ganNhat.has(m.assetId)) {
          ganNhat.set(m.assetId, {
            condition: m.condition,
            seenQuantity: m.seenQuantity,
            note: m.note,
            visitedAt: v.visitedAt,
            code: v.code,
          });
        }
      }
    }

    res.json({
      ok: true,
      diem,
      thietBi: thietBi.map((t) => ({
        ...t,
        tonTaiTruong: tonTheoMa.get(t.id) ?? 0,
        ghiNhanGanNhat: ganNhat.get(t.id) ?? null,
      })),
      cacLan: cacLan.map((v) => ({
        id: v.id,
        code: v.code,
        visitedAt: v.visitedAt,
        summary: v.summary,
        nguoiGhi: v.createdBy,
        soAnh: v._count.photos,
        soThietBi: v.items.length,
        soVanDe: v.items.filter(laVanDe).length,
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// Chi tiết một lần cập nhật
// ---------------------------------------------------------------------------

onsiteRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nd = nguoiDungHienTai(req);
    const lan = await prisma.onsiteVisit.findFirst({
      where: { id: String(req.params['id']), deletedAt: null, location: dieuKienDiemOnsite(nd) },
      select: {
        id: true,
        code: true,
        visitedAt: true,
        summary: true,
        createdAt: true,
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        photos: { select: { id: true }, orderBy: { createdAt: 'asc' } },
        items: {
          select: {
            id: true,
            systemQuantity: true,
            seenQuantity: true,
            condition: true,
            note: true,
            asset: { select: { id: true, code: true, name: true, trackingType: true } },
          },
        },
      },
    });
    if (!lan) throw loi404('Không tìm thấy lần cập nhật onsite này.');
    res.json({ ok: true, lan: { ...lan, anhIds: lan.photos.map((a) => a.id) } });
  }),
);

// ---------------------------------------------------------------------------
// Ghi một lần cập nhật
// ---------------------------------------------------------------------------

const luocDoTaoOnsite = z.object({
  locationId: z.string().trim().min(1).max(30),
  visitedAt: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Thời điểm không hợp lệ.')
    .optional(),
  summary: z.string().trim().max(5000).optional(),
  muc: z
    .array(
      z.object({
        assetId: z.string().trim().min(1).max(30),
        condition: z.enum(TINH_TRANG),
        seenQuantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .min(1, 'Phải ghi ít nhất một thiết bị.')
    .max(500),
  anhIds: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
});

onsiteRouter.post(
  '/',
  batAsync(async (req, res) => {
    const nd = nguoiDungHienTai(req);
    const duLieu = luocDoTaoOnsite.parse(req.body);
    const diem = await diemTrongPhamVi(nd, duLieu.locationId);
    if (!diem.isActive) throw loi422(`Điểm "${diem.name}" đã ngừng sử dụng.`, 'DIEM_NGUNG_DUNG');

    const assetIds = duLieu.muc.map((m) => m.assetId);
    if (new Set(assetIds).size !== assetIds.length) {
      throw loi422('Mỗi thiết bị chỉ ghi một dòng trong một lần cập nhật.', 'TRUNG_THIET_BI');
    }
    const thietBi = await prisma.asset.findMany({
      where: { id: { in: assetIds }, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (thietBi.length !== assetIds.length) {
      throw loi422('Có thiết bị không tồn tại hoặc đã bị xoá.', 'THIET_BI_KHONG_HOP_LE');
    }
    const tenTheoId = new Map(thietBi.map((t) => [t.id, t]));

    if (duLieu.anhIds.length > 0) {
      const anh = await prisma.photo.findMany({
        where: { id: { in: duLieu.anhIds } },
        select: { id: true, kind: true, onsiteVisitId: true, uploadedById: true },
      });
      if (anh.length !== duLieu.anhIds.length) {
        throw loi422('Có ảnh không tồn tại trong hệ thống.', 'ANH_KHONG_TON_TAI');
      }
      if (anh.some((a) => a.kind !== 'ONSITE')) {
        throw loi422('Ảnh phải được tải lên với loại "Ảnh cập nhật onsite".', 'ANH_SAI_LOAI');
      }
      if (anh.some((a) => a.onsiteVisitId !== null)) {
        throw loi409('Có ảnh đã gắn với một lần cập nhật khác.', { maLoi: 'ANH_DA_DUNG' });
      }
      if (anh.some((a) => a.uploadedById !== nd.id)) {
        throw loi403('Chỉ gắn được ảnh do chính bạn tải lên.');
      }
    }

    // Số sổ sách tại trường lúc ghi — chốt lại làm chứng cứ, sau này sổ đổi thì
    // vẫn biết hôm đó lệch bao nhiêu.
    const tonTruong = new Map((await tonTheoDiaDiem(diem.id)).map((t) => [t.assetId, t.ton]));
    const dong = duLieu.muc.map((m) => ({
      assetId: m.assetId,
      condition: m.condition,
      seenQuantity: m.seenQuantity ?? null,
      systemQuantity: Math.max(0, tonTruong.get(m.assetId) ?? 0),
      note: m.note || null,
    }));
    const vanDe = dong.filter(laVanDe);

    const lan = await prisma.$transaction(async (tx) => {
      const code = await capSoChungTu(tx, TIEN_TO.ONSITE);
      const taoMoi = await tx.onsiteVisit.create({
        data: {
          code,
          locationId: diem.id,
          visitedAt: duLieu.visitedAt ? new Date(duLieu.visitedAt) : new Date(),
          summary: duLieu.summary || null,
          createdById: nd.id,
          items: { create: dong },
        },
        select: { id: true, code: true },
      });
      if (duLieu.anhIds.length > 0) {
        await tx.photo.updateMany({
          where: { id: { in: duLieu.anhIds } },
          data: { onsiteVisitId: taoMoi.id },
        });
      }
      if (vanDe.length > 0) {
        const coMat = vanDe.some((m) => m.condition === 'MAT');
        const ke = vanDe
          .slice(0, 5)
          .map((m) => {
            const t = tenTheoId.get(m.assetId);
            const lech =
              m.seenQuantity !== null && m.seenQuantity !== m.systemQuantity
                ? ` (thấy ${m.seenQuantity}/sổ ${m.systemQuantity})`
                : '';
            return `${t?.code ?? m.assetId} ${NHAN_TINH_TRANG[m.condition]}${lech}`;
          })
          .join('; ');
        await tx.alert.create({
          data: {
            type: 'TINH_TRANG_THAY_DOI',
            severity: coMat ? 'CAO' : 'TRUNG_BINH',
            title: `Onsite ${diem.name}: ${vanDe.length} thiết bị cần để mắt`.slice(0, 191),
            message:
              `${nd.email} cập nhật onsite ${taoMoi.code} tại ${diem.name}: ${ke}` +
              (vanDe.length > 5 ? ` và ${vanDe.length - 5} thiết bị khác.` : '.') +
              ' Sổ sách chưa đổi — sửa số qua Kiểm kê, thiết bị hỏng qua Báo hỏng.',
            entityType: 'onsite_visit',
            entityId: taoMoi.id,
          },
        });
      }
      await ghiAudit(
        {
          actor: nd,
          action: 'onsite.create',
          entityType: 'onsite_visit',
          entityId: taoMoi.id,
          afterValue: { code: taoMoi.code, diem: diem.name, soThietBi: dong.length, soVanDe: vanDe.length },
          photoIds: duLieu.anhIds,
          ...boiCanh(req),
        },
        tx,
      );
      return taoMoi;
    });

    if (vanDe.length > 0) {
      phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
        id: lan.id,
        code: lan.code,
        thongDiep: `Onsite ${diem.name}: ${vanDe.length} thiết bị cần để mắt.`,
      });
    }
    phatChoDiaDiem(diem.id, SU_KIEN.KHO_DOI, { id: lan.id, code: lan.code });

    res.status(201).json({ ok: true, lan: { ...lan, soVanDe: vanDe.length } });
  }),
);

/** Xoá một lần cập nhật ghi nhầm — quản trị / vận hành (xoá mềm, giữ dấu vết). */
onsiteRouter.delete(
  '/:id',
  yeuCauVaiTro('ADMIN', 'VAN_HANH'),
  batAsync(async (req, res) => {
    const nd = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.onsiteVisit.findUnique({
      where: { id },
      select: { id: true, code: true, deletedAt: true },
    });
    if (!truoc || truoc.deletedAt) throw loi404('Không tìm thấy lần cập nhật onsite này.');
    await prisma.$transaction(async (tx) => {
      await tx.onsiteVisit.update({ where: { id }, data: { deletedAt: new Date() } });
      await ghiAudit(
        {
          actor: nd,
          action: 'onsite.soft_delete',
          entityType: 'onsite_visit',
          entityId: id,
          beforeValue: { code: truoc.code },
          ...boiCanh(req),
        },
        tx,
      );
    });
    res.json({ ok: true });
  }),
);
