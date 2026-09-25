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
import { xoaFileAnh } from '../../lib/luu-anh.js';
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
  gpsRequired: true,
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

/**
 * DANH SÁCH NƠI ĐẾN — chỉ thông tin nhận dạng, mở cho mọi tài khoản đã đăng nhập.
 *
 * Cần cho luồng luân chuyển giữa các trường: trường A phải chọn được trường B
 * làm nơi đến, dù trường B không nằm trong phạm vi dữ liệu của trường A. Không
 * trả địa chỉ, người liên hệ, toạ độ hay bán kính GPS — muốn xem những thứ đó
 * thì vẫn phải qua danh sách đã lọc phạm vi ở trên.
 */
diaDiemRouter.get(
  '/noi-den',
  batAsync(async (req, res) => {
    const loc = luocDoLoc.parse(req.query);
    const muc = await prisma.location.findMany({
      where: {
        // Tuyến này KHÔNG qua `dieuKienDiaDiem` (cố ý: ai cũng cần thấy mọi nơi
        // đến để lập yêu cầu), nên phải tự chặn điểm đã xoá ở đây.
        deletedAt: null,
        ...(loc.type ? { type: loc.type } : {}),
        ...(loc.chiHoatDong === 'true' ? { isActive: true } : {}),
      },
      select: { id: true, code: true, name: true, type: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

const luocDoGps = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).nullable(),
    longitude: z.coerce.number().min(-180).max(180).nullable(),
    gpsRadiusM: z.coerce.number().int().min(20).max(50_000).nullable(),
    // z.boolean() chứ KHÔNG dùng z.coerce.boolean(): coerce biến chuỗi "false"
    // thành true (Boolean("false") === true), nên công tắc sẽ không tắt được.
    // Mặc định true để lời gọi cũ (chưa gửi trường này) giữ nguyên hành vi.
    gpsRequired: z.boolean().default(true),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), {
    message: 'Vĩ độ và kinh độ phải cùng có hoặc cùng để trống.',
  })
  // Còn bật khoá thì BẮT BUỘC có toạ độ, nếu không tài khoản kho sẽ bị chặn
  // sạch: phép kiểm là fail-safe, thiếu toạ độ là từ chối đăng nhập. Chặn ngay
  // ở đây để ADMIN thấy lỗi lúc lưu, chứ không để nhân viên kho phát hiện lúc
  // đứng trước máy mà không vào được.
  .refine((v) => !v.gpsRequired || v.latitude !== null, {
    message:
      'Còn bật khoá vị trí thì phải có toạ độ. Hãy đặt toạ độ, hoặc tắt khoá vị trí cho điểm này.',
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
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        gpsRadiusM: true,
        gpsRequired: true,
      },
    });
    if (!truoc) throw loi404('Không tìm thấy điểm lưu trữ.');

    const sau = await prisma.location.update({
      where: { id },
      data: {
        latitude: duLieu.latitude,
        longitude: duLieu.longitude,
        gpsRadiusM: duLieu.gpsRadiusM,
        gpsRequired: duLieu.gpsRequired,
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
        gpsRequired: truoc.gpsRequired,
      },
      afterValue: {
        latitude: duLieu.latitude,
        longitude: duLieu.longitude,
        gpsRadiusM: duLieu.gpsRadiusM,
        gpsRequired: duLieu.gpsRequired,
      },
      note:
        truoc.gpsRequired === duLieu.gpsRequired
          ? `Cấu hình khoá vị trí cho ${truoc.name}.`
          : `${duLieu.gpsRequired ? 'BẬT' : 'TẮT'} khoá vị trí cho ${truoc.name}.`,
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

/**
 * THÙNG RÁC — chỉ ADMIN. Phải khai TRƯỚC `/:id` vì Express khớp tuyến theo thứ
 * tự khai báo, để sau thì "thung-rac" bị nuốt thành một id.
 */
diaDiemRouter.get(
  '/thung-rac',
  yeuCauAdmin,
  batAsync(async (_req, res) => {
    const muc = await prisma.location.findMany({
      where: { deletedAt: { not: null } },
      select: {
        ...CHON,
        deletedAt: true,
        deletedBy: { select: { id: true, fullName: true } },
        _count: { select: { assets: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

diaDiemRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    // Vẫn chặn theo phạm vi: TRUONG không xem được điểm của trường khác.
    const diaDiem = await prisma.location.findFirst({
      // AND chứ không spread: dieuKienDiaDiem cũng đặt khoá `id` (vai trò
      // TRUONG trả về { id: { in: [...] } }), nên spread sẽ ghi đè id trong
      // params và truy vấn thành "điểm ĐẦU TIÊN trong phạm vi" — đo thật:
      // hỏi chi tiết Kho văn phòng lại trả về Trường Tiểu học Minh Khai.
      where: { AND: [{ id: String(req.params['id']) }, dieuKienDiaDiem(nguoiDung)] },
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
    // CỐ Ý không lọc `deletedAt: null`: mã của điểm trong thùng rác VẪN nằm
    // trong khoá duy nhất, nên phải báo trùng — nhưng nói rõ nó ở đâu, vì người
    // dùng tìm khắp danh sách sẽ không thấy đâu cả.
    const daCo = await prisma.location.findUnique({
      where: { code: duLieu.code },
      select: { id: true, deletedAt: true },
    });
    if (daCo?.deletedAt) {
      throw loi409(
        `Mã ${duLieu.code} đang thuộc một điểm trong THÙNG RÁC. Vào Điểm lưu trữ → Thùng rác để khôi phục, hoặc xoá vĩnh viễn rồi mới tạo lại mã này.`,
        { truong: 'code', maLoi: 'MA_O_THUNG_RAC', diaDiemId: daCo.id },
      );
    }
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

/**
 * Đếm những gì đang trỏ vào một điểm — dùng cho cả xoá mềm lẫn xoá vĩnh viễn.
 *
 * Xoá mềm thì con số này chỉ để CẢNH BÁO và ghi vào nhật ký kiểm toán (vẫn cho
 * xoá). Xoá vĩnh viễn thì nó là điều kiện CHẶN thật, vì lúc đó bản ghi biến mất
 * và mọi khoá ngoại trỏ vào nó sẽ gãy.
 */
async function demRangBuoc(id: string): Promise<{
  rangBuoc: Record<string, number>;
  tong: number;
  keRa: string;
}> {
  const [thietBi, diChuyen, taiKhoan, yeuCau, bbbg, kiemKe] = await Promise.all([
    prisma.asset.count({ where: { currentLocationId: id, deletedAt: null } }),
    prisma.movement.count({ where: { OR: [{ fromLocationId: id }, { toLocationId: id }] } }),
    prisma.user.count({ where: { locationId: id } }),
    prisma.request.count({ where: { OR: [{ fromLocationId: id }, { toLocationId: id }] } }),
    prisma.handoverNote.count({ where: { receiverLocationId: id } }),
    prisma.inventoryCount.count({ where: { locationId: id } }),
  ]);
  const rangBuoc = { thietBi, diChuyen, taiKhoan, yeuCau, bienBan: bbbg, kiemKe };
  const NHAN: Record<keyof typeof rangBuoc, string> = {
    thietBi: 'thiết bị đang ở đây',
    diChuyen: 'lượt xuất–nhập kho đã ghi',
    taiKhoan: 'tài khoản gắn với điểm này',
    yeuCau: 'yêu cầu',
    bienBan: 'biên bản bàn giao',
    kiemKe: 'đợt kiểm kê',
  };
  const keRa = (Object.keys(rangBuoc) as Array<keyof typeof rangBuoc>)
    .filter((k) => rangBuoc[k] > 0)
    .map((k) => `${rangBuoc[k]} ${NHAN[k]}`)
    .join(', ');
  return { rangBuoc, tong: Object.values(rangBuoc).reduce((a, b) => a + b, 0), keRa };
}


/**
 * XOÁ MỀM một điểm lưu trữ — LUÔN cho xoá, kể cả khi đang có thiết bị và lịch sử.
 *
 * Trước đây chặn cứng khi còn bất cứ thứ gì trỏ vào, mà điểm lưu trữ thì gần
 * như luôn có một lượt xuất–nhập nào đó, nên trên thực tế không xoá được điểm
 * nào cả. Nay xoá được ở mọi tình trạng nhưng KHÔNG mất gì: bản ghi vẫn nguyên,
 * lịch sử cũ vẫn đọc được tên điểm, khôi phục lại được nguyên trạng.
 *
 * Số ràng buộc vẫn đếm — không để chặn nữa, mà để ghi vào nhật ký kiểm toán:
 * sáu tháng sau nhìn lại còn biết lúc xoá điểm đó đang giữ bao nhiêu thiết bị.
 */
diaDiemRouter.delete(
  '/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.location.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, deletedAt: true },
    });
    if (!truoc) throw loi404('Không tìm thấy điểm lưu trữ.');
    if (truoc.deletedAt) throw loi409('Điểm này đã nằm trong thùng rác rồi.');

    const { rangBuoc, tong, keRa } = await demRangBuoc(id);

    await prisma.$transaction(async (tx) => {
      await tx.location.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: actor.id },
      });
      await ghiAudit(
        {
          actor,
          action: 'location.delete',
          entityType: 'location',
          entityId: id,
          beforeValue: { code: truoc.code, name: truoc.name, ...rangBuoc },
          ...boiCanh(req),
        },
        tx,
      );
    });

    res.json({
      ok: true,
      thongDiep:
        tong > 0
          ? `Đã chuyển điểm "${truoc.name}" vào thùng rác (lúc xoá còn ${keRa}). Khôi phục lại được ở Điểm lưu trữ → Thùng rác.`
          : `Đã chuyển điểm "${truoc.name}" vào thùng rác. Khôi phục lại được ở Điểm lưu trữ → Thùng rác.`,
      rangBuoc,
    });
  }),
);

/** Khôi phục một điểm từ thùng rác về nguyên trạng. */
diaDiemRouter.post(
  '/:id/khoi-phuc',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.location.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, deletedAt: true },
    });
    if (!truoc) throw loi404('Không tìm thấy điểm lưu trữ.');
    if (!truoc.deletedAt) throw loi409('Điểm này không nằm trong thùng rác.');

    await prisma.$transaction(async (tx) => {
      await tx.location.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
      await ghiAudit(
        {
          actor,
          action: 'location.restore',
          entityType: 'location',
          entityId: id,
          afterValue: { code: truoc.code, name: truoc.name },
          ...boiCanh(req),
        },
        tx,
      );
    });

    res.json({ ok: true, thongDiep: `Đã khôi phục điểm "${truoc.name}".` });
  }),
);

/**
 * XOÁ VĨNH VIỄN — xoá luôn, KHÔNG điều kiện.
 *
 * Quyết định của LtL: xoá hẳn là xoá hẳn. Thiết bị KHÔNG mất, chỉ trống ô "vị
 * trí hiện tại" để điền lại.
 *
 * PHẢI XOÁ TAY `movements` tại điểm này, không được để khoá ngoại tự SET NULL.
 * Lý do là nguyên tắc bất biến #5 (xem `lib/ton-kho.ts`): tồn được suy ra từ
 * movements, và ở đó `to_location_id = NULL` mang nghĩa RIÊNG là "hàng ra khỏi
 * hệ thống". Nên nếu để SET NULL:
 *
 *   - một lượt điều chuyển `từ Kho VP → điểm bị xoá` biến thành "hàng rời khỏi
 *     hệ thống từ Kho VP", tồn của KHO VP — một điểm chẳng liên quan — tụt đi
 *     đúng số đó mà không ai biết;
 *   - một lượt nhập ban đầu `NULL → điểm bị xoá` thành `NULL → NULL`, cộng vào
 *     tồn số 0, thiết bị tự nhiên mất tồn.
 *
 * Xoá hẳn dòng movement thì sổ tự khớp trở lại: lượt điều chuyển coi như chưa
 * từng xảy ra nên hàng "quay về" Kho VP đúng bằng số đã chuyển đi; còn thiết bị
 * chỉ từng nằm ở mỗi điểm bị xoá thì về tồn 0 và trống vị trí — đúng là "trống
 * phần kho để điền lại".
 *
 * Các bảng còn lại (thiết bị, tài khoản, yêu cầu, biên bản, xuất linh kiện) đã
 * khai SET NULL ở khoá ngoại nên bản ghi sống nguyên, chỉ trống ô địa điểm.
 * `inventory_counts` khai NOT NULL + RESTRICT nên phải xoá tay (dòng kiểm kê
 * cascade theo). `gps_override_codes` đã cascade sẵn.
 */
diaDiemRouter.delete(
  '/:id/vinh-vien',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.location.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, deletedAt: true },
    });
    if (!truoc) throw loi404('Không tìm thấy điểm lưu trữ.');
    if (!truoc.deletedAt) {
      throw loi409('Phải chuyển điểm vào thùng rác trước khi xoá vĩnh viễn.');
    }

    const { rangBuoc } = await demRangBuoc(id);

    // Lấy đường dẫn ảnh TRƯỚC khi xoá: ảnh của movement cascade mất cùng
    // movement, sau đó không còn chỗ nào tìm lại file trên đĩa.
    const buocSeXoa = await prisma.movement.findMany({
      where: { OR: [{ fromLocationId: id }, { toLocationId: id }] },
      select: { id: true },
    });
    const anhCanDonDia = await prisma.photo.findMany({
      where: { movementId: { in: buocSeXoa.map((b) => b.id) } },
      select: { filePath: true },
    });

    await prisma.$transaction(async (tx) => {
      await ghiAudit(
        {
          actor,
          action: 'location.purge',
          entityType: 'location',
          entityId: id,
          beforeValue: { code: truoc.code, name: truoc.name, ...rangBuoc },
          note: `Xoá vĩnh viễn — xoá theo ${buocSeXoa.length} lượt xuất–nhập kho và ${rangBuoc['kiemKe']} đợt kiểm kê tại điểm này. Thiết bị giữ nguyên, chỉ trống vị trí.`,
          ...boiCanh(req),
        },
        tx,
      );
      await tx.inventoryCount.deleteMany({ where: { locationId: id } });
      await tx.movement.deleteMany({
        where: { OR: [{ fromLocationId: id }, { toLocationId: id }] },
      });
      await tx.location.delete({ where: { id } });
    });

    for (const a of anhCanDonDia) await xoaFileAnh(a.filePath);

    // Nói HẾT những gì vừa mất, kể cả phần người dùng không bấm trực tiếp.
    const keoTheo: string[] = [];
    if (buocSeXoa.length > 0) keoTheo.push(`${buocSeXoa.length} lượt xuất–nhập kho`);
    if ((rangBuoc['kiemKe'] ?? 0) > 0) keoTheo.push(`${rangBuoc['kiemKe']} đợt kiểm kê`);
    const phanThietBi =
      (rangBuoc['thietBi'] ?? 0) > 0
        ? ` ${rangBuoc['thietBi']} thiết bị vẫn còn nguyên, chỉ trống ô vị trí — vào Thiết bị để nhập lại kho.`
        : '';
    res.json({
      ok: true,
      thongDiep:
        keoTheo.length > 0
          ? `Đã xoá vĩnh viễn điểm "${truoc.name}", xoá theo ${keoTheo.join(' và ')}.${phanThietBi}`
          : `Đã xoá vĩnh viễn điểm "${truoc.name}".${phanThietBi}`,
      daXoaTheo: { diChuyen: buocSeXoa.length, kiemKe: rangBuoc['kiemKe'] ?? 0 },
      rangBuoc,
    });
  }),
);
