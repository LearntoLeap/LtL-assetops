/**
 * BÁO HỎNG — luồng E.
 *
 * Dùng lại bảng `requests` với `type = BAO_HONG` thay vì thêm bảng ticket riêng:
 * cùng vòng đời (tạo → xử lý → đóng), cùng chỗ đính ảnh, cùng nhật ký thao tác.
 *
 * Khác các loại yêu cầu khác ở hai điểm:
 *   - tạo xong vào thẳng "Chờ duyệt" (không có bước nháp — hỏng thì báo ngay);
 *   - bắt buộc có ẢNH và MÔ TẢ; xử lý xong thì cập nhật tình trạng thiết bị.
 */
import { Router } from 'express';
import { z } from 'zod';
import { TINH_TRANG } from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi400, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { dieuKienTaiSan } from '../../lib/pham-vi.js';
import { phatChoNguoiDuyet, SU_KIEN } from '../../realtime.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauNguoiDuyet,
} from '../../middleware/xac-thuc.js';

export const baoHongRouter = Router();
baoHongRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

const luocDoTao = z.object({
  /** Mã thiết bị — báo hỏng luôn gắn với đúng một mã. */
  code: z.string().trim().toUpperCase().min(3).max(64),
  moTa: z.string().trim().min(10, 'Mô tả hỏng hóc phải có ít nhất 10 ký tự.').max(5000),
  /** Bắt buộc có ảnh: không có ảnh thì không biết hỏng thế nào. */
  anhIds: z
    .array(z.string().trim().min(1).max(30))
    .min(1, 'Phải có ít nhất một ảnh chụp chỗ hỏng.')
    .max(5),
  /** Tình trạng người báo đánh giá. */
  tinhTrangDeXuat: z.enum(TINH_TRANG).default('CAN_BAO_TRI'),
});

const luocDoXuLy = z.object({
  tinhTrangMoi: z.enum(TINH_TRANG),
  ketLuan: z.string().trim().min(5, 'Ghi rõ kết luận xử lý.').max(2000),
  /** Đóng ticket hay để mở theo dõi tiếp. */
  dong: z.boolean().default(true),
});

const luocDoLoc = z.object({
  dangMo: z.enum(['true', 'false']).default('true'),
  moiTrang: z.coerce.number().int().positive().max(200).default(50),
});

const CHON = {
  id: true,
  code: true,
  status: true,
  reason: true,
  createdAt: true,
  completedAt: true,
  rejectionNote: true,
  createdBy: { select: { id: true, fullName: true, email: true, role: true } },
  approvedBy: { select: { id: true, fullName: true } },
  items: {
    select: {
      asset: {
        select: {
          id: true,
          code: true,
          name: true,
          condition: true,
          currentLocation: { select: { id: true, name: true } },
        },
      },
    },
  },
  photos: { select: { id: true, kind: true, createdAt: true } },
} as const;

/** Tạo phiếu báo hỏng: mọi vai trò đều báo được thiết bị trong phạm vi của mình. */
baoHongRouter.post(
  '/',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTao.parse(req.body);

    // Chỉ báo hỏng được thiết bị thuộc phạm vi của mình — điểm trường không báo
    // hộ thiết bị của trường khác.
    const thietBi = await prisma.asset.findFirst({
      where: { code: duLieu.code, ...dieuKienTaiSan(actor) },
      select: { id: true, code: true, name: true, condition: true },
    });
    if (!thietBi) {
      throw loi404(
        `Không tìm thấy thiết bị mã ${duLieu.code} trong phạm vi của bạn.`,
      );
    }

    const anh = await prisma.photo.findMany({
      where: { id: { in: duLieu.anhIds } },
      select: { id: true, kind: true, requestId: true },
    });
    if (anh.length !== duLieu.anhIds.length) {
      throw loi422('Có ảnh không tồn tại trong hệ thống.', 'ANH_KHONG_TON_TAI');
    }
    const saiLoai = anh.filter((a) => a.kind !== 'BAO_HONG').map((a) => a.id);
    if (saiLoai.length > 0) {
      throw loi422('Ảnh phải được tải lên với loại "Ảnh báo hỏng".', 'ANH_SAI_LOAI', {
        anhIds: saiLoai,
      });
    }
    const daDung = anh.filter((a) => a.requestId !== null).map((a) => a.id);
    if (daDung.length > 0) {
      throw loi422('Có ảnh đã gắn với phiếu khác.', 'ANH_DA_DUNG', { anhIds: daDung });
    }

    const phieu = await prisma.$transaction(async (tx) => {
      const code = await capSoChungTu(tx, TIEN_TO.YEU_CAU);
      const bayGio = new Date();
      const taoMoi = await tx.request.create({
        data: {
          code,
          type: 'BAO_HONG',
          // Hỏng thì báo ngay, không qua bước nháp.
          status: 'CHO_DUYET',
          createdById: actor.id,
          reason: duLieu.moTa,
          submittedAt: bayGio,
          items: { create: [{ assetId: thietBi.id, quantity: 1 }] },
        },
        select: CHON,
      });

      await tx.photo.updateMany({
        where: { id: { in: duLieu.anhIds } },
        data: { requestId: taoMoi.id, assetId: thietBi.id },
      });

      await tx.alert.create({
        data: {
          type: 'BAO_HONG',
          severity:
            duLieu.tinhTrangDeXuat === 'HONG' || duLieu.tinhTrangDeXuat === 'MAT'
              ? 'CAO'
              : 'TRUNG_BINH',
          title: `Báo hỏng ${thietBi.code} — ${thietBi.name}`,
          message: `${actor.email} báo: ${duLieu.moTa}`,
          assetId: thietBi.id,
          requestId: taoMoi.id,
          entityType: 'request',
          entityId: taoMoi.id,
        },
      });

      await ghiAudit(
        {
          actor,
          action: 'damage_report.create',
          entityType: 'request',
          entityId: taoMoi.id,
          afterValue: {
            code,
            assetCode: thietBi.code,
            tinhTrangDeXuat: duLieu.tinhTrangDeXuat,
            tinhTrangHienTai: thietBi.condition,
          },
          photoIds: duLieu.anhIds,
          note: duLieu.moTa.slice(0, 500),
          ...boiCanh(req),
        },
        tx,
      );
      return taoMoi;
    });

    phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
      id: phieu.id,
      code: phieu.code,
      thongDiep: `Báo hỏng mới: ${thietBi.code}.`,
    });
    res.status(201).json({ ok: true, phieu });
  }),
);

baoHongRouter.get(
  '/',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const loc = luocDoLoc.parse(req.query);
    const muc = await prisma.request.findMany({
      where: {
        type: 'BAO_HONG',
        ...(loc.dangMo === 'true'
          ? { status: { in: ['CHO_DUYET', 'DA_DUYET'] } }
          : { status: { in: ['DA_HOAN_TAT', 'TU_CHOI'] } }),
        // Người báo luôn thấy phiếu của mình; ngoài ra lọc theo phạm vi thiết bị.
        OR: [
          { createdById: nguoiDung.id },
          { items: { some: { asset: dieuKienTaiSan(nguoiDung) } } },
        ],
      },
      select: CHON,
      orderBy: { createdAt: 'desc' },
      take: loc.moiTrang,
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

baoHongRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const phieu = await prisma.request.findFirst({
      where: {
        id: String(req.params['id']),
        type: 'BAO_HONG',
        OR: [
          { createdById: nguoiDung.id },
          { items: { some: { asset: dieuKienTaiSan(nguoiDung) } } },
        ],
      },
      select: CHON,
    });
    if (!phieu) throw loi404('Không tìm thấy phiếu báo hỏng, hoặc phiếu ngoài phạm vi của bạn.');
    res.json({ ok: true, phieu });
  }),
);

/** Xử lý phiếu: cập nhật tình trạng thiết bị và đóng ticket. */
baoHongRouter.post(
  '/:id/xu-ly',
  yeuCauNguoiDuyet,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const duLieu = luocDoXuLy.parse(req.body);

    const phieu = await prisma.request.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        items: { select: { asset: { select: { id: true, code: true, condition: true } } } },
      },
    });
    if (!phieu) throw loi404('Không tìm thấy phiếu báo hỏng.');
    if (phieu.type !== 'BAO_HONG') throw loi400('Phiếu này không phải báo hỏng.', 'SAI_LOAI');
    if (phieu.status === 'DA_HOAN_TAT') throw loi409('Phiếu báo hỏng đã đóng.');

    const thietBi = phieu.items[0]?.asset;
    if (!thietBi) throw loi422('Phiếu báo hỏng không gắn thiết bị nào.', 'THIEU_THIET_BI');

    const ketQua = await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id: thietBi.id },
        data: { condition: duLieu.tinhTrangMoi },
      });

      const capNhat = await tx.request.update({
        where: { id },
        data: {
          status: duLieu.dong ? 'DA_HOAN_TAT' : 'DA_DUYET',
          approvedById: actor.id,
          approvedAt: new Date(),
          ...(duLieu.dong ? { completedAt: new Date() } : {}),
        },
        select: CHON,
      });

      if (duLieu.dong) {
        await tx.alert.updateMany({
          where: { requestId: id, resolvedAt: null },
          data: { resolvedAt: new Date(), resolvedById: actor.id, resolutionNote: duLieu.ketLuan },
        });
      }

      await ghiAudit(
        {
          actor,
          action: duLieu.dong ? 'damage_report.close' : 'damage_report.update',
          entityType: 'asset',
          entityId: thietBi.id,
          beforeValue: { condition: thietBi.condition },
          afterValue: { condition: duLieu.tinhTrangMoi, phieu: phieu.code, dong: duLieu.dong },
          note: duLieu.ketLuan,
          ...boiCanh(req),
        },
        tx,
      );
      return capNhat;
    });

    res.json({ ok: true, phieu: ketQua });
  }),
);
