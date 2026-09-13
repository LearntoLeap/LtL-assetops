/**
 * Điểm lưu trữ — GIAI ĐOẠN 2 chỉ mở phần tối thiểu:
 *   - đọc danh sách (trang quản lý tài khoản cần chọn kho / điểm trường),
 *   - ADMIN cấu hình toạ độ GPS và bán kính của kho (yêu cầu khoá vị trí).
 * CRUD đầy đủ (tạo/sửa/xoá điểm, import Excel) làm ở giai đoạn 3.
 */
import { Router } from 'express';
import { z } from 'zod';
import { LOAI_DIEM_LUU_TRU } from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi404, loi409 } from '../../lib/loi-http.js';
import { dieuKienDiaDiem } from '../../lib/pham-vi.js';
import { toaDoHopLe } from '../../lib/khoang-cach.js';
import {
  chuoiSua,
  chuoiTuyChon,
  soDienThoaiSua,
  soDienThoaiTuyChon,
} from '../../lib/luoc-do-chung.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauAdmin,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';

export const diaDiemRouter = Router();

diaDiemRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

const luocDoLoc = z.object({
  type: z.enum(LOAI_DIEM_LUU_TRU).optional(),
  chiHoatDong: z.enum(['true', 'false']).default('true'),
});

const CHON = {
  id: true,
  code: true,
  name: true,
  type: true,
  address: true,
  contactName: true,
  contactPhone: true,
  latitude: true,
  longitude: true,
  gpsRadiusM: true,
  isActive: true,
  note: true,
} as const;

/** Danh sách điểm lưu trữ — LỌC THEO PHẠM VI VAI TRÒ ở phía server. */
diaDiemRouter.get(
  '/',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const loc = luocDoLoc.parse(req.query);

    const muc = await prisma.location.findMany({
      where: {
        // Phạm vi vai trò: TRUONG chỉ thấy trường mình, NHAN_SU chỉ thấy nơi
        // đang giữ thiết bị của mình. Gọi thẳng API cũng không ra ngoài được.
        ...dieuKienDiaDiem(nguoiDung),
        ...(loc.type ? { type: loc.type } : {}),
        ...(loc.chiHoatDong === 'true' ? { isActive: true } : {}),
      },
      select: CHON,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    res.json({
      ok: true,
      muc: muc.map((d) => ({
        ...d,
        latitude: d.latitude === null ? null : Number(d.latitude),
        longitude: d.longitude === null ? null : Number(d.longitude),
      })),
      tong: muc.length,
    });
  }),
);

const luocDoGps = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).nullable(),
    longitude: z.coerce.number().min(-180).max(180).nullable(),
    gpsRadiusM: z.coerce.number().int().min(20).max(50_000).nullable(),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), {
    message: 'Vĩ độ và kinh độ phải cùng có hoặc cùng để trống.',
  })
  .refine(
    (v) =>
      v.latitude === null ||
      toaDoHopLe({ latitude: v.latitude, longitude: v.longitude ?? 0 }),
    { message: 'Toạ độ không hợp lệ.' },
  );

/** ADMIN cấu hình toạ độ GPS + bán kính cho phép của một điểm (thường là kho). */
diaDiemRouter.patch(
  '/:id/gps',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const duLieu = luocDoGps.parse(req.body);

    const truoc = await prisma.location.findUnique({
      where: { id },
      select: { id: true, name: true, latitude: true, longitude: true, gpsRadiusM: true },
    });
    if (!truoc) throw loi404('Không tìm thấy điểm lưu trữ.');

    const sau = await prisma.location.update({
      where: { id },
      data: {
        latitude: duLieu.latitude,
        longitude: duLieu.longitude,
        gpsRadiusM: duLieu.gpsRadiusM,
      },
      select: CHON,
    });

    await ghiAudit({
      actor,
      action: 'location.cau_hinh_gps',
      entityType: 'location',
      entityId: id,
      beforeValue: {
        latitude: truoc.latitude === null ? null : Number(truoc.latitude),
        longitude: truoc.longitude === null ? null : Number(truoc.longitude),
        gpsRadiusM: truoc.gpsRadiusM,
      },
      afterValue: {
        latitude: duLieu.latitude,
        longitude: duLieu.longitude,
        gpsRadiusM: duLieu.gpsRadiusM,
      },
      note: `Cấu hình khoá vị trí cho ${truoc.name}.`,
      ...boiCanh(req),
    });

    res.json({
      ok: true,
      diaDiem: {
        ...sau,
        latitude: sau.latitude === null ? null : Number(sau.latitude),
        longitude: sau.longitude === null ? null : Number(sau.longitude),
      },
    });
  }),
);

// ===========================================================================
// CRUD điểm lưu trữ (giai đoạn 3)
// ===========================================================================

const chiSuaDuoc = yeuCauVaiTro('ADMIN', 'VAN_HANH');

const maDiaDiem = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'Mã điểm phải có ít nhất 2 ký tự.')
  .max(64)
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Mã chỉ gồm chữ in hoa, số và các dấu . _ -');

const luocDoTaoDiaDiem = z.object({
  code: maDiaDiem,
  name: z.string().trim().min(2, 'Tên điểm phải có ít nhất 2 ký tự.').max(191),
  type: z.enum(LOAI_DIEM_LUU_TRU),
  address: chuoiTuyChon(2000),
  contactName: chuoiTuyChon(191),
  contactPhone: soDienThoaiTuyChon,
  note: chuoiTuyChon(2000),
  isActive: z.boolean().default(true),
});

/** Bỏ trường = giữ nguyên; gửi chuỗi rỗng = xoá giá trị đó. */
const luocDoSuaDiaDiem = z
  .object({
    name: z.string().trim().min(2, 'Tên điểm phải có ít nhất 2 ký tự.').max(191).optional(),
    type: z.enum(LOAI_DIEM_LUU_TRU).optional(),
    address: chuoiSua(2000),
    contactName: chuoiSua(191),
    contactPhone: soDienThoaiSua,
    note: chuoiSua(2000),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });

function donDiaDiem<T extends { latitude: unknown; longitude: unknown }>(d: T) {
  return {
    ...d,
    latitude: d.latitude === null ? null : Number(d.latitude),
    longitude: d.longitude === null ? null : Number(d.longitude),
  };
}

diaDiemRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    // Vẫn chặn theo phạm vi: TRUONG không xem được điểm của trường khác.
    const diaDiem = await prisma.location.findFirst({
      where: { id: String(req.params['id']), ...dieuKienDiaDiem(nguoiDung) },
      select: CHON,
    });
    if (!diaDiem) throw loi404('Không tìm thấy điểm lưu trữ, hoặc ngoài phạm vi của bạn.');
    res.json({ ok: true, diaDiem: donDiaDiem(diaDiem) });
  }),
);

diaDiemRouter.post(
  '/',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoDiaDiem.parse(req.body);
    const daCo = await prisma.location.findUnique({
      where: { code: duLieu.code },
      select: { id: true },
    });
    if (daCo) throw loi409(`Mã điểm ${duLieu.code} đã tồn tại.`, { truong: 'code' });

    const diaDiem = await prisma.location.create({
      data: {
        code: duLieu.code,
        name: duLieu.name,
        type: duLieu.type,
        address: duLieu.address || null,
        contactName: duLieu.contactName || null,
        contactPhone: duLieu.contactPhone || null,
        note: duLieu.note || null,
        isActive: duLieu.isActive,
      },
      select: CHON,
    });

    await ghiAudit({
      actor,
      action: 'location.create',
      entityType: 'location',
      entityId: diaDiem.id,
      afterValue: { code: diaDiem.code, name: diaDiem.name, type: diaDiem.type },
      ...boiCanh(req),
    });
    res.status(201).json({ ok: true, diaDiem: donDiaDiem(diaDiem) });
  }),
);

diaDiemRouter.patch(
  '/:id',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const duLieu = luocDoSuaDiaDiem.parse(req.body);
    const truoc = await prisma.location.findUnique({ where: { id }, select: CHON });
    if (!truoc) throw loi404('Không tìm thấy điểm lưu trữ.');

    // Đổi loại điểm có thể làm tài khoản KHO/TRUONG đang gắn vào đó sai phạm vi.
    if (duLieu.type && duLieu.type !== truoc.type) {
      const soTaiKhoan = await prisma.user.count({
        where: { locationId: id, role: { in: ['KHO', 'TRUONG'] } },
      });
      if (soTaiKhoan > 0) {
        throw loi409(
          `Có ${soTaiKhoan} tài khoản Kho/Điểm trường đang gắn với điểm này nên không đổi được loại điểm. Hãy chuyển các tài khoản đó sang điểm khác trước.`,
          { soTaiKhoan },
        );
      }
    }

    const sau = await prisma.location.update({
      where: { id },
      data: {
        ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
        ...(duLieu.type === undefined ? {} : { type: duLieu.type }),
        ...(duLieu.address === undefined ? {} : { address: duLieu.address }),
        ...(duLieu.contactName === undefined ? {} : { contactName: duLieu.contactName }),
        ...(duLieu.contactPhone === undefined ? {} : { contactPhone: duLieu.contactPhone }),
        ...(duLieu.note === undefined ? {} : { note: duLieu.note }),
        ...(duLieu.isActive === undefined ? {} : { isActive: duLieu.isActive }),
      },
      select: CHON,
    });

    await ghiAudit({
      actor,
      action: 'location.update',
      entityType: 'location',
      entityId: id,
      beforeValue: { name: truoc.name, type: truoc.type, isActive: truoc.isActive },
      afterValue: { name: sau.name, type: sau.type, isActive: sau.isActive },
      ...boiCanh(req),
    });
    res.json({ ok: true, diaDiem: donDiaDiem(sau) });
  }),
);

/** Xoá điểm: chỉ ADMIN, và chỉ khi không còn gì tham chiếu tới nó. */
diaDiemRouter.delete(
  '/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.location.findUnique({
      where: { id },
      select: { id: true, code: true, name: true },
    });
    if (!truoc) throw loi404('Không tìm thấy điểm lưu trữ.');

    const [thietBi, diChuyen, taiKhoan, yeuCau, bbbg, kiemKe] = await Promise.all([
      prisma.asset.count({ where: { currentLocationId: id } }),
      prisma.movement.count({ where: { OR: [{ fromLocationId: id }, { toLocationId: id }] } }),
      prisma.user.count({ where: { locationId: id } }),
      prisma.request.count({ where: { OR: [{ fromLocationId: id }, { toLocationId: id }] } }),
      prisma.handoverNote.count({ where: { receiverLocationId: id } }),
      prisma.inventoryCount.count({ where: { locationId: id } }),
    ]);
    const rangBuoc = { thietBi, diChuyen, taiKhoan, yeuCau, bienBan: bbbg, kiemKe };
    const tong = Object.values(rangBuoc).reduce((s, n) => s + n, 0);

    if (tong > 0) {
      throw loi409(
        'Điểm này đang được tham chiếu nên không xoá được. Hãy đặt Ngừng dùng thay vì xoá.',
        rangBuoc,
      );
    }

    await prisma.$transaction(async (tx) => {
      await ghiAudit(
        {
          actor,
          action: 'location.delete',
          entityType: 'location',
          entityId: id,
          beforeValue: { code: truoc.code, name: truoc.name },
          ...boiCanh(req),
        },
        tx,
      );
      await tx.location.delete({ where: { id } });
    });
    res.json({ ok: true, thongDiep: 'Đã xoá điểm lưu trữ.' });
  }),
);
