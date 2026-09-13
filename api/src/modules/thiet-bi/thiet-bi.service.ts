/**
 * Nghiệp vụ thiết bị.
 *
 * Hai điều được giữ chặt ở đây:
 *   1. Tạo thiết bị LUÔN sinh kèm movement NHAP_BAN_DAU trong cùng transaction,
 *      nên tồn kho suy ra từ `movements` không bao giờ thiếu gốc (nguyên tắc #5).
 *   2. Sửa thiết bị KHÔNG đụng tới vị trí / tình trạng / trạng thái phân bổ —
 *      những thứ đó chỉ đổi qua luồng yêu cầu đã duyệt (nguyên tắc #2).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { loi400, loi404, loi409 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { dieuKienTaiSan } from '../../lib/pham-vi.js';
import { tonCuaTaiSan } from '../../lib/ton-kho.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type {
  DuLieuLocThietBi,
  DuLieuSuaThietBi,
  DuLieuTaoThietBi,
} from './thiet-bi.schema.js';

const CHON_DONG = {
  id: true,
  code: true,
  name: true,
  serialNumber: true,
  origin: true,
  originNote: true,
  receivedDate: true,
  value: true,
  purpose: true,
  trackingType: true,
  condition: true,
  allocationStatus: true,
  dueReturnAt: true,
  note: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, code: true, name: true } },
  productLine: { select: { id: true, code: true, name: true } },
  currentLocation: { select: { id: true, code: true, name: true, type: true } },
  holder: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.AssetSelect;

export type DongThietBi = Prisma.AssetGetPayload<{ select: typeof CHON_DONG }>;

function doiNgay(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw loi400(`Ngày không hợp lệ: ${iso}`, 'NGAY_KHONG_HOP_LE');
  return d;
}

/** Chuyển Decimal của Prisma về number để trả JSON gọn. */
function donDong(d: DongThietBi) {
  return { ...d, value: d.value === null ? null : Number(d.value) };
}

export async function danhSach(
  nguoiDung: NguoiDungDaXacThuc,
  loc: DuLieuLocThietBi,
): Promise<{ muc: ReturnType<typeof donDong>[]; tong: number; trang: number; moiTrang: number }> {
  const dieuKien: Prisma.AssetWhereInput = {
    // Phạm vi vai trò kiểm ở SERVER — gọi thẳng API cũng không ra ngoài được.
    ...dieuKienTaiSan(nguoiDung),
    ...(loc.chiHoatDong === 'true' ? { isActive: true } : {}),
    ...(loc.categoryId ? { categoryId: loc.categoryId } : {}),
    ...(loc.productLineId ? { productLineId: loc.productLineId } : {}),
    ...(loc.locationId ? { currentLocationId: loc.locationId } : {}),
    ...(loc.condition ? { condition: loc.condition } : {}),
    ...(loc.allocationStatus ? { allocationStatus: loc.allocationStatus } : {}),
    ...(loc.purpose ? { purpose: loc.purpose } : {}),
    ...(loc.trackingType ? { trackingType: loc.trackingType } : {}),
    ...(loc.tuKhoa
      ? {
          OR: [
            { code: { contains: loc.tuKhoa } },
            { name: { contains: loc.tuKhoa } },
            { serialNumber: { contains: loc.tuKhoa } },
          ],
        }
      : {}),
  };

  const thuTu: Prisma.AssetOrderByWithRelationInput =
    loc.sapXep === 'name'
      ? { name: 'asc' }
      : loc.sapXep === 'moi_nhat'
        ? { createdAt: 'desc' }
        : { code: 'asc' };

  const [muc, tong] = await Promise.all([
    prisma.asset.findMany({
      where: dieuKien,
      select: CHON_DONG,
      orderBy: thuTu,
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.asset.count({ where: dieuKien }),
  ]);

  return { muc: muc.map(donDong), tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

/** Chi tiết: kèm tồn kho SUY RA từ movements và lịch sử di chuyển gần nhất. */
export async function xemMot(nguoiDung: NguoiDungDaXacThuc, id: string) {
  const thietBi = await prisma.asset.findFirst({
    where: { id, ...dieuKienTaiSan(nguoiDung) },
    select: CHON_DONG,
  });
  if (!thietBi) throw loi404('Không tìm thấy thiết bị, hoặc thiết bị không thuộc phạm vi của bạn.');

  const [ton, lichSu, tenDiaDiem] = await Promise.all([
    tonCuaTaiSan(thietBi.id),
    prisma.movement.findMany({
      where: { assetId: thietBi.id },
      orderBy: { performedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        quantity: true,
        conditionBefore: true,
        conditionAfter: true,
        performedAt: true,
        note: true,
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } },
        performedBy: { select: { id: true, fullName: true } },
        request: { select: { id: true, code: true, type: true } },
      },
    }),
    prisma.location.findMany({ select: { id: true, name: true } }),
  ]);

  const ten = new Map(tenDiaDiem.map((d) => [d.id, d.name]));
  return {
    thietBi: donDong(thietBi),
    tonKho: {
      tongTon: ton.tongTon,
      theoDiaDiem: ton.theoDiaDiem.map((d) => ({
        locationId: d.locationId,
        tenDiaDiem: ten.get(d.locationId) ?? '(đã xoá)',
        ton: d.ton,
      })),
    },
    lichSu,
  };
}

/** Tra cứu theo MÃ — dùng cho quét QR tại kho. */
export async function timTheoMa(nguoiDung: NguoiDungDaXacThuc, code: string) {
  const chuanHoa = code.trim().toUpperCase();
  const thietBi = await prisma.asset.findFirst({
    where: { code: chuanHoa, ...dieuKienTaiSan(nguoiDung) },
    select: { id: true },
  });
  if (!thietBi) {
    throw loi404(
      `Không tìm thấy thiết bị có mã ${chuanHoa}, hoặc thiết bị không thuộc phạm vi của bạn.`,
    );
  }
  return xemMot(nguoiDung, thietBi.id);
}

/**
 * Tra cứu RÚT GỌN theo mã — mọi vai trò đã đăng nhập đều gọi được.
 *
 * Vì sao không dùng phạm vi như `timTheoMa`: nhân sự phòng ban muốn MƯỢN một
 * thiết bị thì bắt buộc phải nhập được mã của nó, mà thiết bị đó dĩ nhiên chưa
 * thuộc phạm vi của họ. Endpoint này chỉ trả đủ thông tin để người lập yêu cầu
 * biết mình gõ đúng mã (tên, loại, tình trạng, đang ở đâu) — KHÔNG trả giá trị,
 * tồn kho hay lịch sử, và KHÔNG cho duyệt danh sách toàn kho.
 */
export async function traCuuNhanh(code: string) {
  const chuanHoa = code.trim().toUpperCase();
  const thietBi = await prisma.asset.findUnique({
    where: { code: chuanHoa },
    select: {
      id: true,
      code: true,
      name: true,
      trackingType: true,
      condition: true,
      allocationStatus: true,
      isActive: true,
      category: { select: { name: true } },
      currentLocation: { select: { name: true } },
    },
  });
  if (!thietBi) throw loi404(`Không có thiết bị nào mang mã ${chuanHoa}.`);
  return thietBi;
}

export async function tao(
  duLieu: DuLieuTaoThietBi,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<ReturnType<typeof donDong>> {
  const [daCo, loai, diem] = await Promise.all([
    prisma.asset.findUnique({ where: { code: duLieu.code }, select: { id: true } }),
    prisma.assetCategory.findUnique({ where: { id: duLieu.categoryId }, select: { id: true } }),
    prisma.location.findUnique({ where: { id: duLieu.nhapVeLocationId }, select: { id: true } }),
  ]);
  if (daCo) throw loi409(`Mã thiết bị ${duLieu.code} đã tồn tại.`, { truong: 'code' });
  if (!loai) throw loi400('Loại tài sản không tồn tại.', 'LOAI_KHONG_TON_TAI');
  if (!diem) throw loi400('Điểm nhập về không tồn tại.', 'DIEM_KHONG_TON_TAI');

  if (duLieu.productLineId) {
    const dong = await prisma.productLine.findUnique({
      where: { id: duLieu.productLineId },
      select: { id: true },
    });
    if (!dong) throw loi400('Dòng giải pháp không tồn tại.', 'DONG_KHONG_TON_TAI');
  }

  const ngayNhap = duLieu.receivedDate ? doiNgay(duLieu.receivedDate) : new Date();

  return prisma.$transaction(async (tx) => {
    const thietBi = await tx.asset.create({
      data: {
        code: duLieu.code,
        name: duLieu.name,
        categoryId: duLieu.categoryId,
        productLineId: duLieu.productLineId || null,
        serialNumber: duLieu.serialNumber || null,
        origin: duLieu.origin,
        originNote: duLieu.originNote || null,
        receivedDate: ngayNhap,
        value: duLieu.value ?? null,
        purpose: duLieu.purpose,
        trackingType: duLieu.trackingType,
        condition: duLieu.condition,
        // Thiết bị mới luôn bắt đầu ở nơi nhận hàng, trạng thái Tại kho.
        currentLocationId: duLieu.nhapVeLocationId,
        allocationStatus: 'TAI_KHO',
        dueReturnAt: duLieu.dueReturnAt ? doiNgay(duLieu.dueReturnAt) : null,
        note: duLieu.note || null,
        createdById: actor.id,
      },
      select: CHON_DONG,
    });

    // Gốc của tồn kho: từ ngoài hệ thống → điểm nhận hàng.
    await tx.movement.create({
      data: {
        assetId: thietBi.id,
        type: 'NHAP_BAN_DAU',
        fromLocationId: null,
        toLocationId: duLieu.nhapVeLocationId,
        quantity: duLieu.soLuongNhap,
        conditionAfter: duLieu.condition,
        performedById: actor.id,
        performedAt: ngayNhap,
        note: 'Nhập ban đầu khi tạo thiết bị.',
      },
    });

    await ghiAudit(
      {
        actor,
        action: 'asset.create',
        entityType: 'asset',
        entityId: thietBi.id,
        afterValue: {
          code: thietBi.code,
          name: thietBi.name,
          trackingType: thietBi.trackingType,
          soLuongNhap: duLieu.soLuongNhap,
          nhapVeLocationId: duLieu.nhapVeLocationId,
        },
        ...ctx,
      },
      tx,
    );

    return donDong(thietBi);
  });
}

export async function sua(
  id: string,
  duLieu: DuLieuSuaThietBi,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<ReturnType<typeof donDong>> {
  const truoc = await prisma.asset.findUnique({ where: { id }, select: CHON_DONG });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');

  if (duLieu.categoryId) {
    const loai = await prisma.assetCategory.findUnique({
      where: { id: duLieu.categoryId },
      select: { id: true },
    });
    if (!loai) throw loi400('Loại tài sản không tồn tại.', 'LOAI_KHONG_TON_TAI');
  }
  if (duLieu.productLineId) {
    const dong = await prisma.productLine.findUnique({
      where: { id: duLieu.productLineId },
      select: { id: true },
    });
    if (!dong) throw loi400('Dòng giải pháp không tồn tại.', 'DONG_KHONG_TON_TAI');
  }

  const sau = await prisma.asset.update({
    where: { id },
    data: {
      ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
      ...(duLieu.categoryId === undefined ? {} : { categoryId: duLieu.categoryId }),
      ...(duLieu.productLineId === undefined ? {} : { productLineId: duLieu.productLineId || null }),
      ...(duLieu.serialNumber === undefined ? {} : { serialNumber: duLieu.serialNumber || null }),
      ...(duLieu.origin === undefined ? {} : { origin: duLieu.origin }),
      ...(duLieu.originNote === undefined ? {} : { originNote: duLieu.originNote || null }),
      ...(duLieu.receivedDate === undefined
        ? {}
        : { receivedDate: duLieu.receivedDate ? doiNgay(duLieu.receivedDate) : null }),
      ...(duLieu.value === undefined ? {} : { value: duLieu.value }),
      ...(duLieu.purpose === undefined ? {} : { purpose: duLieu.purpose }),
      ...(duLieu.dueReturnAt === undefined
        ? {}
        : { dueReturnAt: duLieu.dueReturnAt ? doiNgay(duLieu.dueReturnAt) : null }),
      ...(duLieu.note === undefined ? {} : { note: duLieu.note || null }),
      ...(duLieu.isActive === undefined ? {} : { isActive: duLieu.isActive }),
    },
    select: CHON_DONG,
  });

  await ghiAudit({
    actor,
    action: 'asset.update',
    entityType: 'asset',
    entityId: id,
    beforeValue: {
      name: truoc.name,
      categoryId: truoc.category.id,
      productLineId: truoc.productLine?.id ?? null,
      serialNumber: truoc.serialNumber,
      origin: truoc.origin,
      value: truoc.value === null ? null : Number(truoc.value),
      purpose: truoc.purpose,
      isActive: truoc.isActive,
    },
    afterValue: {
      name: sau.name,
      categoryId: sau.category.id,
      productLineId: sau.productLine?.id ?? null,
      serialNumber: sau.serialNumber,
      origin: sau.origin,
      value: sau.value === null ? null : Number(sau.value),
      purpose: sau.purpose,
      isActive: sau.isActive,
    },
    ...ctx,
  });

  return donDong(sau);
}

/**
 * Xoá thiết bị — chỉ khi CHƯA phát sinh nghiệp vụ gì (mới tạo, nhập sai mã).
 * Thiết bị đã có lịch sử thì dùng "Ngừng theo dõi" (isActive = false) để giữ
 * nguyên nhật ký di chuyển và các chứng từ liên quan.
 */
export async function xoa(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');

  const [soMovement, yeuCau, anh, bbbg, kiemKe] = await Promise.all([
    prisma.movement.count({ where: { assetId: id, type: { not: 'NHAP_BAN_DAU' } } }),
    prisma.requestItem.count({ where: { assetId: id } }),
    prisma.photo.count({ where: { assetId: id } }),
    prisma.handoverNoteItem.count({ where: { assetId: id } }),
    prisma.inventoryCountItem.count({ where: { assetId: id } }),
  ]);
  const rangBuoc = { diChuyen: soMovement, yeuCau, anh, bienBan: bbbg, kiemKe };
  const tong = Object.values(rangBuoc).reduce((s, n) => s + n, 0);

  if (tong > 0) {
    throw loi409(
      'Thiết bị đã phát sinh nghiệp vụ nên không xoá được (nhật ký và chứng từ phải giữ nguyên). Hãy dùng "Ngừng theo dõi".',
      rangBuoc,
    );
  }

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'asset.delete',
        entityType: 'asset',
        entityId: id,
        beforeValue: { code: truoc.code, name: truoc.name },
        note: 'Xoá thiết bị chưa phát sinh nghiệp vụ.',
        ...ctx,
      },
      tx,
    );
    await tx.movement.deleteMany({ where: { assetId: id } });
    await tx.asset.delete({ where: { id } });
  });
}
