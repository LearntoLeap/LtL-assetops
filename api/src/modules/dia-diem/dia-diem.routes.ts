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
import { loi404 } from '../../lib/loi-http.js';
import { dieuKienDiaDiem } from '../../lib/pham-vi.js';
import { toaDoHopLe } from '../../lib/khoang-cach.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauAdmin,
  yeuCauDangNhap,
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
