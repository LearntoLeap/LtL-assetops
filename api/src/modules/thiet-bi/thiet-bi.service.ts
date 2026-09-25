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
import { idMucDichHoacDauTien, idNguonGocHoacDauTien } from '../../lib/tra-ma-tai-san.js';
import { maKeTiepTheoId } from '../../lib/sinh-ma-thiet-bi.js';
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
  originNote: true,
  receivedDate: true,
  value: true,
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
  // Trả nguyên cả hàng nguồn gốc / mục đích chứ không chỉ id: giao diện cần
  // TÊN để hiện, mà tên giờ nằm trong CSDL chứ không còn là hằng số dịch sẵn.
  origin: { select: { id: true, code: true, name: true } },
  purpose: { select: { id: true, code: true, name: true } },
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
    ...(loc.purposeId ? { purposeId: loc.purposeId } : {}),
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
  const [daCo, loai, diem, nguonGoc, mucDich] = await Promise.all([
    // Gõ tay mã thì phải dò trùng; để server sinh thì bước dò nằm trong vòng
    // thử lại ở dưới, dò ở đây chỉ tốn một truy vấn thừa.
    duLieu.code
      ? prisma.asset.findUnique({
          where: { code: duLieu.code },
          select: { id: true, deletedAt: true },
        })
      : Promise.resolve(null),
    prisma.assetCategory.findUnique({ where: { id: duLieu.categoryId }, select: { id: true } }),
    // `deletedAt: null`: không nhập thiết bị mới về một điểm đã nằm trong thùng rác.
    prisma.location.findFirst({
      where: { id: duLieu.nhapVeLocationId, deletedAt: null },
      select: { id: true },
    }),
    prisma.assetOrigin.findUnique({ where: { id: duLieu.originId }, select: { id: true } }),
    prisma.assetPurpose.findUnique({ where: { id: duLieu.purposeId }, select: { id: true } }),
  ]);
  // Thiết bị ở THÙNG RÁC vẫn giữ mã của nó trong khoá duy nhất, nên báo trùng mà
  // người dùng tìm khắp danh sách không thấy đâu. Nói rõ nó ở đâu và làm gì tiếp.
  if (daCo?.deletedAt) {
    throw loi409(
      `Mã ${duLieu.code} đang thuộc một thiết bị trong THÙNG RÁC. Vào Thiết bị → Thùng rác để khôi phục, hoặc xoá vĩnh viễn rồi mới tạo lại mã này.`,
      { truong: 'code', maLoi: 'MA_O_THUNG_RAC', thietBiId: daCo.id },
    );
  }
  if (daCo) throw loi409(`Mã thiết bị ${duLieu.code} đã tồn tại.`, { truong: 'code' });
  if (!loai) throw loi400('Loại tài sản không tồn tại.', 'LOAI_KHONG_TON_TAI');

  if (!diem) throw loi400('Điểm nhập về không tồn tại hoặc đã bị xoá.', 'DIEM_KHONG_TON_TAI');
  // Kiểm tường minh thay vì để khoá ngoại tự đổ: lỗi khoá ngoại của Prisma là
  // một dòng tiếng Anh về ràng buộc, người dùng đọc không hiểu mình sai ô nào.
  // Hay gặp nhất là nguồn gốc vừa bị ADMIN xoá trong lúc form đang mở.
  if (!nguonGoc) throw loi400('Nguồn gốc không tồn tại (có thể vừa bị xoá). Hãy tải lại trang và chọn lại.', 'NGUON_GOC_KHONG_TON_TAI');
  if (!mucDich) throw loi400('Mục đích sử dụng không tồn tại (có thể vừa bị xoá). Hãy tải lại trang và chọn lại.', 'MUC_DICH_KHONG_TON_TAI');

  if (duLieu.productLineId) {
    const dong = await prisma.productLine.findUnique({
      where: { id: duLieu.productLineId },
      select: { id: true },
    });
    if (!dong) throw loi400('Dòng giải pháp không tồn tại.', 'DONG_KHONG_TON_TAI');
  }

  const ngayNhap = duLieu.receivedDate ? doiNgay(duLieu.receivedDate) : new Date();

  /**
   * Sinh mã rồi ghi, thử lại nếu vướng khoá duy nhất.
   *
   * Hai người cùng bấm Lưu trong một giây thì cả hai đọc ra cùng một số kế
   * tiếp, người sau đâm vào lỗi trùng mã. Không khoá bảng vì khoá bảng làm
   * nghẽn cả việc nhập hàng loạt; cứ thử lại — lần thứ hai đọc được mã người
   * kia vừa ghi nên ra số mới.
   */
  const soLanThu = duLieu.code ? 1 : 5;
  for (let lan = 0; lan < soLanThu; lan += 1) {
    let ma = duLieu.code;
    if (!ma) {
      const sinh = await maKeTiepTheoId(
        duLieu.originId,
        duLieu.categoryId,
        duLieu.productLineId || null,
      );
      if (!sinh) throw loi400('Không sinh được mã thiết bị.', 'KHONG_SINH_DUOC_MA');
      ma = sinh.ma;
    }
    try {
      return await ghiThietBi(ma);
    } catch (e) {
      const trungMa =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' &&
        !duLieu.code &&
        lan < soLanThu - 1;
      if (!trungMa) throw e;
    }
  }
  throw loi409('Không sinh được mã thiết bị chưa trùng. Hãy thử lại.', {
    maLoi: 'MA_TRUNG_LIEN_TUC',
  });

  async function ghiThietBi(ma: string): Promise<ReturnType<typeof donDong>> {
  return prisma.$transaction(async (tx) => {
    const thietBi = await tx.asset.create({
      data: {
        code: ma,
        name: duLieu.name,
        categoryId: duLieu.categoryId,
        productLineId: duLieu.productLineId || null,
        serialNumber: duLieu.serialNumber || null,
        originId: duLieu.originId,
        originNote: duLieu.originNote || null,
        receivedDate: ngayNhap,
        value: duLieu.value ?? null,
        purposeId: duLieu.purposeId,
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
  if (duLieu.originId) {
    const ng = await prisma.assetOrigin.findUnique({
      where: { id: duLieu.originId },
      select: { id: true },
    });
    if (!ng) throw loi400('Nguồn gốc không tồn tại (có thể vừa bị xoá). Hãy tải lại trang và chọn lại.', 'NGUON_GOC_KHONG_TON_TAI');
  }
  if (duLieu.purposeId) {
    const md = await prisma.assetPurpose.findUnique({
      where: { id: duLieu.purposeId },
      select: { id: true },
    });
    if (!md) throw loi400('Mục đích sử dụng không tồn tại (có thể vừa bị xoá). Hãy tải lại trang và chọn lại.', 'MUC_DICH_KHONG_TON_TAI');
  }

  const sau = await prisma.asset.update({
    where: { id },
    data: {
      ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
      ...(duLieu.categoryId === undefined ? {} : { categoryId: duLieu.categoryId }),
      ...(duLieu.productLineId === undefined ? {} : { productLineId: duLieu.productLineId || null }),
      ...(duLieu.serialNumber === undefined ? {} : { serialNumber: duLieu.serialNumber || null }),
      ...(duLieu.originId === undefined ? {} : { originId: duLieu.originId }),
      ...(duLieu.originNote === undefined ? {} : { originNote: duLieu.originNote || null }),
      ...(duLieu.receivedDate === undefined
        ? {}
        : { receivedDate: duLieu.receivedDate ? doiNgay(duLieu.receivedDate) : null }),
      ...(duLieu.value === undefined ? {} : { value: duLieu.value }),
      ...(duLieu.purposeId === undefined ? {} : { purposeId: duLieu.purposeId }),
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
      origin: truoc.origin.code,
      value: truoc.value === null ? null : Number(truoc.value),
      purpose: truoc.purpose.code,
      isActive: truoc.isActive,
    },
    afterValue: {
      name: sau.name,
      categoryId: sau.category.id,
      productLineId: sau.productLine?.id ?? null,
      serialNumber: sau.serialNumber,
      origin: sau.origin.code,
      value: sau.value === null ? null : Number(sau.value),
      purpose: sau.purpose.code,
      isActive: sau.isActive,
    },
    ...ctx,
  });

  return donDong(sau);
}

/**
 * XOÁ MỀM một thiết bị — LUÔN cho xoá, ở bất kỳ tình trạng và trạng thái phân bổ nào.
 *
 * Trước đây hàm này xoá hẳn và chặn khi thiết bị đã phát sinh nghiệp vụ, nên
 * thiết bị đang cho mượn hay đã phân bổ về trường thì không xoá được — nhập sai
 * một mã là mắc luôn ở đó. Giờ đổi thành xoá mềm:
 *
 *   - bản ghi thiết bị, nhật ký di chuyển, ảnh, chứng từ đều GIỮ NGUYÊN;
 *   - thiết bị biến khỏi mọi danh sách, mọi báo cáo, và không còn tính vào tồn
 *     kho (phép lọc nằm ở `dieuKienTaiSan` và ở `lib/ton-kho.ts`);
 *   - khôi phục lại được nguyên trạng nếu xoá nhầm.
 *
 * Đánh đổi phải biết: MÃ thiết bị vẫn bị giữ trong khoá duy nhất khi còn ở thùng
 * rác, nên tạo lại đúng mã đó sẽ báo trùng — `tao()` nói rõ mã đang ở thùng rác
 * để người dùng chọn khôi phục hay xoá vĩnh viễn.
 */
export async function xoa(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      deletedAt: true,
      allocationStatus: true,
      condition: true,
    },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');
  if (truoc.deletedAt) throw loi409('Thiết bị này đã ở trong thùng rác.');

  // Đếm nghiệp vụ KHÔNG để chặn nữa, chỉ để ghi vào nhật ký: sau này xem lại
  // biết lúc xoá thiết bị đang dính những gì.
  const [soMovement, yeuCau, bbbg, kiemKe] = await Promise.all([
    prisma.movement.count({ where: { assetId: id, type: { not: 'NHAP_BAN_DAU' } } }),
    prisma.requestItem.count({ where: { assetId: id } }),
    prisma.handoverNoteItem.count({ where: { assetId: id } }),
    prisma.inventoryCountItem.count({ where: { assetId: id } }),
  ]);

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'asset.soft_delete',
        entityType: 'asset',
        entityId: id,
        beforeValue: {
          code: truoc.code,
          name: truoc.name,
          allocationStatus: truoc.allocationStatus,
          condition: truoc.condition,
          nghiepVu: { diChuyen: soMovement, yeuCau, bienBan: bbbg, kiemKe },
        },
        note: 'Chuyển vào thùng rác — khôi phục được.',
        ...ctx,
      },
      tx,
    );
    await tx.asset.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actor.id },
    });
  });
}

/** Danh sách thiết bị trong THÙNG RÁC, mới xoá lên trước. */
export async function thungRac(gioiHan = 200) {
  const muc = await prisma.asset.findMany({
    where: { deletedAt: { not: null } },
    select: {
      ...CHON_DONG,
      deletedAt: true,
      deletedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { deletedAt: 'desc' },
    take: gioiHan,
  });
  return { muc: muc.map((t) => ({ ...donDong(t), deletedAt: t.deletedAt, deletedBy: t.deletedBy })), tong: muc.length };
}

/** Khôi phục một thiết bị từ thùng rác về đúng nguyên trạng trước khi xoá. */
export async function khoiPhuc(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi) {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');
  const lucXoa = truoc.deletedAt;
  if (!lucXoa) throw loi409('Thiết bị này không ở trong thùng rác.');

  const sau = await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'asset.restore',
        entityType: 'asset',
        entityId: id,
        beforeValue: { code: truoc.code, deletedAt: lucXoa.toISOString() },
        note: 'Khôi phục từ thùng rác.',
        ...ctx,
      },
      tx,
    );
    return tx.asset.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
      select: CHON_DONG,
    });
  });
  return donDong(sau);
}

/**
 * XOÁ VĨNH VIỄN khỏi thùng rác — không khôi phục lại được.
 *
 * Cần có vì mã thiết bị là khoá duy nhất: thiết bị còn nằm ở thùng rác thì mã của
 * nó vẫn bị giữ, không tạo lại được đúng mã đó. Khi nạp bộ dữ liệu thật mà trùng
 * mã cũ thì phải dọn hẳn.
 *
 * Chỉ nhận thiết bị ĐÃ ở thùng rác — bắt buộc đi qua hai bước (xoá mềm rồi mới
 * xoá hẳn) để không có đường nào mất dữ liệu bằng một cú bấm.
 */
export async function xoaVinhVien(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');
  if (!truoc.deletedAt) {
    throw loi409(
      'Chỉ xoá vĩnh viễn được thiết bị đang ở thùng rác. Hãy xoá thiết bị trước, rồi vào thùng rác xoá hẳn.',
    );
  }

  // Lấy đường dẫn ảnh TRƯỚC khi xoá: sau đó bản ghi ảnh đã cascade mất, không
  // còn chỗ nào tìm lại file trên đĩa.
  const anhCanDonDia = await prisma.photo.findMany({
    where: { assetId: id },
    select: { filePath: true },
  });

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'asset.hard_delete',
        entityType: 'asset',
        entityId: id,
        beforeValue: { code: truoc.code, name: truoc.name },
        note: 'Xoá vĩnh viễn khỏi thùng rác — không khôi phục được.',
        ...ctx,
      },
      tx,
    );
    // Các bảng dưới đây khai khoá ngoài RESTRICT nên phải xoá tay theo thứ tự,
    // không cascade được như ảnh.
    await tx.inventoryCountItem.deleteMany({ where: { assetId: id } });
    await tx.handoverNoteItem.deleteMany({ where: { assetId: id } });
    await tx.requestItem.deleteMany({ where: { assetId: id } });
    await tx.movement.deleteMany({ where: { assetId: id } });
    await tx.asset.delete({ where: { id } });
  });

  for (const a of anhCanDonDia) await xoaFileAnh(a.filePath);
}

/** Một dòng bị bỏ qua trong thao tác hàng loạt, kèm lý do để hiện lại cho người dùng. */
export interface DongBoQua {
  id: string;
  ma: string | null;
  lyDo: string;
}

export interface KetQuaHangLoat {
  soThanhCong: number;
  boQua: DongBoQua[];
}

/**
 * Chạy một thao tác cho từng id, KHÔNG gộp vào một transaction.
 *
 * Cố ý để mỗi thiết bị là một giao dịch riêng: gộp cả lô thì một thiết bị lỗi là
 * cuốn theo 32 cái đã làm đúng, mà thao tác hàng loạt thì người dùng muốn "làm
 * được cái nào thì làm" rồi xem lại phần bỏ sót. Hàm trả về đúng danh sách bỏ
 * qua kèm lý do để giao diện hiện nguyên văn.
 */
async function chayTungCai(
  ids: readonly string[],
  viec: (id: string) => Promise<unknown>,
): Promise<KetQuaHangLoat> {
  const boQua: DongBoQua[] = [];
  let soThanhCong = 0;
  // Lấy mã trước để thông điệp lỗi gọi tên thiết bị chứ không phải id cuid.
  const ma = new Map(
    (
      await prisma.asset.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, code: true },
      })
    ).map((t) => [t.id, t.code]),
  );

  for (const id of ids) {
    try {
      await viec(id);
      soThanhCong += 1;
    } catch (loi) {
      boQua.push({
        id,
        ma: ma.get(id) ?? null,
        lyDo: loi instanceof Error ? loi.message : 'Lỗi không rõ.',
      });
    }
  }
  return { soThanhCong, boQua };
}

/** Xoá mềm NHIỀU thiết bị đã chọn. */
export async function xoaNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoat> {
  return chayTungCai(ids, (id) => xoa(id, actor, ctx));
}

/** Khôi phục NHIỀU thiết bị từ thùng rác. */
export async function khoiPhucNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoat> {
  return chayTungCai(ids, (id) => khoiPhuc(id, actor, ctx));
}

/** Xoá VĨNH VIỄN nhiều thiết bị khỏi thùng rác — không khôi phục lại được. */
export async function xoaVinhVienNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoat> {
  return chayTungCai(ids, (id) => xoaVinhVien(id, actor, ctx));
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

  // Tra một lần trước vòng lặp sinh mã, đừng gọi lại ở mỗi lần thử.
  const idKhac = await idNguonGocHoacDauTien('KHAC');
  const idMucDich = duLieu.purposeId ?? (await idMucDichHoacDauTien('XHH'));

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
          originId: idKhac,
          purposeId: idMucDich,
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
