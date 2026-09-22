/**
 * Nghiệp vụ thiết bị.
 *
 * Hai điều được giữ chặt ở đây:
 *   1. Tạo thiết bị LUÔN sinh kèm movement NHAP_BAN_DAU trong cùng transaction,
 *      nên tồn kho suy ra từ `movements` không bao giờ thiếu gốc (nguyên tắc #5).
 *   2. Sửa thiết bị KHÔNG đụng tới vị trí / tình trạng / trạng thái phân bổ —
 *      những thứ đó chỉ đổi qua luồng yêu cầu đã duyệt (nguyên tắc #2).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { loi400, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { dieuKienTaiSan } from '../../lib/pham-vi.js';
import { tonCuaTaiSan } from '../../lib/ton-kho.js';
import { xoaFileAnh } from '../../lib/luu-anh.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type {
  DuLieuLocThietBi,
  DuLieuSuaThietBi,
  DuLieuTaoNhanhThietBi,
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
        // Tên người ở kho tự khai lúc xuất/nhập — với loại không quét mã thì đây
        // là bản ghi bằng chữ duy nhất của thứ đã mang ra, phải hiện ra mới đối
        // chiếu được với ảnh khi nhập lại.
        declaredName: true,
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
 *
 * "Nghiệp vụ" ở đây là: movement khác NHAP_BAN_DAU, dòng yêu cầu, dòng biên bản
 * bàn giao, dòng kiểm kê. ẢNH thì KHÔNG — ảnh đi theo thiết bị (cascade) nên xoá
 * thiết bị là xoá cả ảnh và file trên đĩa.
 */
export async function xoa(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');

  // ẢNH KHÔNG PHẢI NGHIỆP VỤ nên không nằm trong danh sách chặn: `Photo.assetId`
  // khai `onDelete: Cascade`, tức ảnh là phần thân của bản ghi thiết bị chứ không
  // phải chứng từ độc lập. Đếm ảnh vào đây khiến MỌI thiết bị thêm nhanh (luồng
  // đó bắt buộc có ảnh) không bao giờ xoá được — đúng lỗi người dùng báo.
  const [soMovement, yeuCau, bbbg, kiemKe] = await Promise.all([
    prisma.movement.count({ where: { assetId: id, type: { not: 'NHAP_BAN_DAU' } } }),
    prisma.requestItem.count({ where: { assetId: id } }),
    prisma.handoverNoteItem.count({ where: { assetId: id } }),
    prisma.inventoryCountItem.count({ where: { assetId: id } }),
  ]);
  const rangBuoc = { diChuyen: soMovement, yeuCau, bienBan: bbbg, kiemKe };
  const tong = Object.values(rangBuoc).reduce((s, n) => s + n, 0);

  if (tong > 0) {
    throw loi409(
      'Thiết bị đã phát sinh nghiệp vụ nên không xoá được (nhật ký và chứng từ phải giữ nguyên). Hãy dùng "Ngừng theo dõi".',
      rangBuoc,
    );
  }

  // Lấy đường dẫn file TRƯỚC khi xoá: sau transaction thì bản ghi ảnh đã bị
  // cascade mất, không còn đường nào tìm lại file trên đĩa nữa.
  const anhCanDonDia = await prisma.photo.findMany({
    where: { assetId: id },
    select: { filePath: true },
  });

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

  // Đặt ngoài transaction: CSDL đã chốt xong thì mới dọn đĩa, và lỗi dọn đĩa
  // (file bị xoá tay, quyền ghi…) không được phép làm hỏng lượt xoá đã thành công.
  for (const a of anhCanDonDia) await xoaFileAnh(a.filePath);
}

/**
 * TẠO NHANH thiết bị khi lập yêu cầu mà mã chưa có trong kho.
 *
 * Dùng lại `tao()` ở trên thay vì viết đường ghi riêng: nhờ vậy vẫn sinh
 * movement NHAP_BAN_DAU, vẫn ghi nhật ký, vẫn qua đúng mọi ràng buộc — chỉ
 * khác ở chỗ MÃ do server sinh và các trường không hỏi thì lấy mặc định.
 *
 * Mã theo dạng LTL-TN-0001 (TN = "tạo nhanh"), đánh số theo mã lớn nhất đang
 * có cùng tiền tố. Đặt trong transaction cùng lệnh tạo để hai người bấm cùng
 * lúc không nhận cùng một số; nếu vẫn trùng (khoá UNIQUE bắt được) thì thử
 * lại tối đa 5 lần rồi mới báo lỗi.
 */
export async function taoNhanh(
  duLieu: DuLieuTaoNhanhThietBi,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<ReturnType<typeof donDong>> {
  const anh = await prisma.photo.findMany({
    where: { id: { in: duLieu.anhIds } },
    select: { id: true, kind: true, assetId: true },
  });
  if (anh.length !== duLieu.anhIds.length) {
    throw loi422('Có ảnh không tồn tại trong hệ thống.', 'ANH_KHONG_TON_TAI');
  }
  if (anh.some((a) => a.kind !== 'HIEN_TRANG')) {
    throw loi422('Ảnh phải được tải lên với loại "Ảnh hiện trạng".', 'ANH_SAI_LOAI');
  }
  if (anh.some((a) => a.assetId !== null)) {
    throw loi422('Có ảnh đã gắn vào thiết bị khác.', 'ANH_DA_DUNG');
  }

  const ghiChu =
    'TẠO NHANH khi lập yêu cầu — cần bổ sung nguồn gốc, giá trị và serial sau.' +
    (duLieu.vendorCode ? ` Mã hãng: ${duLieu.vendorCode}.` : '') +
    (duLieu.note ? `\n${duLieu.note}` : '');

  for (let lan = 0; lan < 5; lan += 1) {
    const cuoi = await prisma.asset.findFirst({
      where: { code: { startsWith: 'LTL-TN-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const soTiepTheo = cuoi ? Number(cuoi.code.slice('LTL-TN-'.length)) + 1 : 1;
    const ma = `LTL-TN-${String(Number.isFinite(soTiepTheo) ? soTiepTheo : 1).padStart(4, '0')}`;

    try {
      const thietBi = await tao(
        {
          code: ma,
          name: duLieu.name,
          categoryId: duLieu.categoryId,
          origin: 'KHAC',
          purpose: duLieu.purpose,
          // Nhiều hơn một cái thì phải quản theo số lượng — `tao()` chặn
          // DON_VI mà soLuongNhap > 1, nên suy ở đây cho khỏi vướng.
          trackingType: duLieu.soLuongNhap > 1 ? 'SO_LUONG' : 'DON_VI',
          condition: 'TOT',
          nhapVeLocationId: duLieu.nhapVeLocationId,
          soLuongNhap: duLieu.soLuongNhap,
          ...(duLieu.vendorCode ? { serialNumber: duLieu.vendorCode } : {}),
          note: ghiChu,
        },
        actor,
        ctx,
      );

      await prisma.photo.updateMany({
        where: { id: { in: duLieu.anhIds } },
        data: { assetId: thietBi.id },
      });
      return thietBi;
    } catch (e) {
      // Mã vừa bị người khác lấy → tính lại số và thử tiếp.
      const trungMa =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
      const trungMaTheoService = e instanceof Error && /đã tồn tại|Mã .* đã/.test(e.message);
      if (!trungMa && !trungMaTheoService) throw e;
    }
  }
  throw loi409('Không sinh được mã thiết bị mới sau 5 lần thử. Hãy thử lại.');
}
