/**
 * KIỂM KÊ — luồng F.
 *
 * Trình tự: ADMIN mở đợt kiểm kê theo địa điểm → hệ thống CHỐT số liệu hệ thống
 * tại thời điểm mở (chụp lại vào `system_quantity`, là chứng cứ bất biến) →
 * người kiểm quét từng mã, nhập thực đếm + ảnh → xem báo cáo chênh lệch →
 * ADMIN chốt và điều chỉnh.
 *
 * Chênh lệch KHÔNG lưu thành cột: luôn tính bằng `thucDem − heThong` khi đọc,
 * đúng tinh thần nguyên tắc bất biến #5.
 *
 * Điều chỉnh lúc chốt được ghi thành movement `DIEU_CHINH_KIEM_KE`, nên tồn kho
 * sau điều chỉnh vẫn suy ra từ bảng movements chứ không bị sửa tay.
 */
import type { AssetCondition, Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { loi400, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { tonTheoDiaDiem } from '../../lib/ton-kho.js';
import { phamViCua } from '../../lib/pham-vi.js';
import { phatChoNguoiDuyet, phatChoTatCa, SU_KIEN } from '../../realtime.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type { DuLieuChot, DuLieuGhiDem, DuLieuLocKiemKe, DuLieuTaoKiemKe } from './kiem-ke.schema.js';

const CHON_MUC = {
  id: true,
  systemQuantity: true,
  systemCondition: true,
  countedQuantity: true,
  countedCondition: true,
  countedAt: true,
  adjustedAt: true,
  note: true,
  countedBy: { select: { id: true, fullName: true } },
  asset: {
    select: {
      id: true,
      code: true,
      name: true,
      trackingType: true,
      category: { select: { name: true } },
    },
  },
  photos: { select: { id: true, kind: true } },
} satisfies Prisma.InventoryCountItemSelect;

const CHON_KIEM_KE = {
  id: true,
  code: true,
  name: true,
  status: true,
  startedAt: true,
  closedAt: true,
  note: true,
  createdAt: true,
  location: { select: { id: true, code: true, name: true, type: true } },
  createdBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
  items: { select: CHON_MUC, orderBy: { asset: { code: 'asc' } } },
} satisfies Prisma.InventoryCountSelect;

export type KiemKeDayDu = Prisma.InventoryCountGetPayload<{ select: typeof CHON_KIEM_KE }>;
type MucKiemKe = Prisma.InventoryCountItemGetPayload<{ select: typeof CHON_MUC }>;

export interface DongBaoCao {
  id: string;
  code: string;
  name: string;
  loai: string;
  heThong: number;
  thucDem: number | null;
  /** Tính khi đọc, không lưu cột. */
  chenhLech: number | null;
  tinhTrangHeThong: AssetCondition;
  tinhTrangThucTe: AssetCondition | null;
  doiTinhTrang: boolean;
  daDem: boolean;
  soAnh: number;
  note: string | null;
  nguoiDem: string | null;
}

export function dungDongBaoCao(m: MucKiemKe): DongBaoCao {
  const daDem = m.countedQuantity !== null;
  return {
    id: m.id,
    code: m.asset.code,
    name: m.asset.name,
    loai: m.asset.category.name,
    heThong: m.systemQuantity,
    thucDem: m.countedQuantity,
    chenhLech: daDem ? (m.countedQuantity ?? 0) - m.systemQuantity : null,
    tinhTrangHeThong: m.systemCondition,
    tinhTrangThucTe: m.countedCondition,
    doiTinhTrang: m.countedCondition !== null && m.countedCondition !== m.systemCondition,
    daDem,
    soAnh: m.photos.length,
    note: m.note,
    nguoiDem: m.countedBy?.fullName ?? null,
  };
}

export interface TongHopBaoCao {
  tongDong: number;
  daDem: number;
  chuaDem: number;
  soChenhLech: number;
  thieu: number;
  thua: number;
  doiTinhTrang: number;
}

export function tongHop(dong: readonly DongBaoCao[]): TongHopBaoCao {
  const daDem = dong.filter((d) => d.daDem);
  const lech = daDem.filter((d) => (d.chenhLech ?? 0) !== 0);
  return {
    tongDong: dong.length,
    daDem: daDem.length,
    chuaDem: dong.length - daDem.length,
    soChenhLech: lech.length,
    thieu: lech.filter((d) => (d.chenhLech ?? 0) < 0).reduce((s, d) => s + (d.chenhLech ?? 0), 0),
    thua: lech.filter((d) => (d.chenhLech ?? 0) > 0).reduce((s, d) => s + (d.chenhLech ?? 0), 0),
    doiTinhTrang: daDem.filter((d) => d.doiTinhTrang).length,
  };
}

function dieuKienPhamVi(nguoiDung: NguoiDungDaXacThuc): Prisma.InventoryCountWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return {};
  if (pv.diaDiem) return { locationId: { in: [...pv.diaDiem] } };
  return { createdById: nguoiDung.id };
}

export async function danhSach(
  nguoiDung: NguoiDungDaXacThuc,
  loc: DuLieuLocKiemKe,
): Promise<{ muc: KiemKeDayDu[]; tong: number; trang: number; moiTrang: number }> {
  // AND: dieuKienPhamVi đặt khoá `locationId`, nên spread một `locationId`
  // khác từ query sẽ GHI ĐÈ phạm vi — điểm trường truyền ?locationId= của
  // trường khác là xem được đợt kiểm kê của trường đó.
  const dieuKien: Prisma.InventoryCountWhereInput = {
    AND: [
      dieuKienPhamVi(nguoiDung),
      ...(loc.locationId ? [{ locationId: loc.locationId }] : []),
    ],
    ...(loc.status ? { status: loc.status } : {}),
  };
  const [muc, tong] = await Promise.all([
    prisma.inventoryCount.findMany({
      where: dieuKien,
      select: CHON_KIEM_KE,
      orderBy: { createdAt: 'desc' },
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.inventoryCount.count({ where: dieuKien }),
  ]);
  return { muc, tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

export async function xemMot(nguoiDung: NguoiDungDaXacThuc, id: string): Promise<KiemKeDayDu> {
  const phieu = await prisma.inventoryCount.findFirst({
    where: { id, ...dieuKienPhamVi(nguoiDung) },
    select: CHON_KIEM_KE,
  });
  if (!phieu) throw loi404('Không tìm thấy phiếu kiểm kê, hoặc phiếu ngoài phạm vi của bạn.');
  return phieu;
}

/**
 * Mở đợt kiểm kê: chụp lại số liệu hệ thống tại thời điểm này.
 *
 * Chỉ đưa vào phiếu những thiết bị ĐANG THỰC SỰ Ở địa điểm đó: bỏ qua thiết bị
 * đang trong tay người giữ hoặc đang trên đường vận chuyển — người kiểm không
 * phải đi tìm một cái laptop đang nằm ở nhà ai đó.
 */
export async function tao(
  duLieu: DuLieuTaoKiemKe,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KiemKeDayDu> {
  const diaDiem = await prisma.location.findUnique({
    where: { id: duLieu.locationId },
    select: { id: true, name: true },
  });
  if (!diaDiem) throw loi400('Địa điểm kiểm kê không tồn tại.', 'DIA_DIEM_KHONG_TON_TAI');

  const dangMo = await prisma.inventoryCount.findFirst({
    where: { locationId: diaDiem.id, status: { in: ['BAN_NHAP', 'DANG_KIEM', 'CHO_CHOT'] } },
    select: { id: true, code: true },
  });
  if (dangMo) {
    throw loi409(`Địa điểm này đang có đợt kiểm kê ${dangMo.code} chưa chốt.`, {
      kiemKeId: dangMo.id,
    });
  }

  // Tồn suy ra từ movements — đây chính là "số liệu hệ thống" đem đi đối chiếu.
  const ton = await tonTheoDiaDiem(diaDiem.id);
  const idTaiSan = ton.map((t) => t.assetId);
  if (idTaiSan.length === 0) {
    throw loi422(`Địa điểm "${diaDiem.name}" chưa có thiết bị nào để kiểm kê.`, 'KHONG_CO_THIET_BI');
  }

  const taiSan = await prisma.asset.findMany({
    where: {
      id: { in: idTaiSan },
      isActive: true,
      holderUserId: null,
      allocationStatus: { not: 'DANG_VAN_CHUYEN' },
    },
    select: { id: true, condition: true },
  });
  const tinhTrang = new Map(taiSan.map((t) => [t.id, t.condition]));
  const dong = ton.filter((t) => tinhTrang.has(t.assetId));

  if (dong.length === 0) {
    throw loi422(
      `Địa điểm "${diaDiem.name}" không có thiết bị nào đủ điều kiện kiểm kê (đều đang có người giữ hoặc đang vận chuyển).`,
      'KHONG_CO_THIET_BI',
    );
  }

  return prisma.$transaction(async (tx) => {
    const code = await capSoChungTu(tx, TIEN_TO.KIEM_KE);
    const phieu = await tx.inventoryCount.create({
      data: {
        code,
        name: duLieu.name,
        locationId: diaDiem.id,
        status: 'DANG_KIEM',
        startedAt: new Date(),
        createdById: actor.id,
        note: duLieu.note ?? null,
        items: {
          create: dong.map((t) => ({
            assetId: t.assetId,
            systemQuantity: t.ton,
            systemCondition: tinhTrang.get(t.assetId) ?? 'TOT',
          })),
        },
      },
      select: CHON_KIEM_KE,
    });

    await ghiAudit(
      {
        actor,
        action: 'inventory_count.create',
        entityType: 'inventory_count',
        entityId: phieu.id,
        afterValue: { code, diaDiem: diaDiem.name, soDong: dong.length },
        ...ctx,
      },
      tx,
    );
    return phieu;
  });
}

/** Ghi thực đếm cho một dòng (người kiểm quét mã rồi nhập). */
export async function ghiDem(
  kiemKeId: string,
  itemId: string,
  duLieu: DuLieuGhiDem,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KiemKeDayDu> {
  const phieu = await prisma.inventoryCount.findUnique({
    where: { id: kiemKeId },
    select: { id: true, code: true, status: true },
  });
  if (!phieu) throw loi404('Không tìm thấy phiếu kiểm kê.');
  if (phieu.status !== 'DANG_KIEM' && phieu.status !== 'CHO_CHOT') {
    throw loi409('Phiếu đã chốt hoặc đã huỷ nên không ghi thêm kết quả đếm được.');
  }

  const muc = await prisma.inventoryCountItem.findFirst({
    where: { id: itemId, inventoryCountId: kiemKeId },
    select: { id: true, systemQuantity: true, systemCondition: true, asset: { select: { code: true } } },
  });
  if (!muc) throw loi404('Dòng kiểm kê không thuộc phiếu này.');

  await prisma.$transaction(async (tx) => {
    await tx.inventoryCountItem.update({
      where: { id: itemId },
      data: {
        countedQuantity: duLieu.countedQuantity,
        countedCondition: duLieu.countedCondition,
        countedById: actor.id,
        countedAt: new Date(),
        note: duLieu.note ?? null,
      },
    });
    if (duLieu.anhIds && duLieu.anhIds.length > 0) {
      await tx.photo.updateMany({
        where: { id: { in: duLieu.anhIds } },
        data: { countItemId: itemId },
      });
    }
    await ghiAudit(
      {
        actor,
        action: 'inventory_count.ghi_dem',
        entityType: 'inventory_count_item',
        entityId: itemId,
        beforeValue: { heThong: muc.systemQuantity, tinhTrangHeThong: muc.systemCondition },
        afterValue: {
          thucDem: duLieu.countedQuantity,
          tinhTrangThucTe: duLieu.countedCondition,
          chenhLech: duLieu.countedQuantity - muc.systemQuantity,
        },
        ...(duLieu.anhIds ? { photoIds: duLieu.anhIds } : {}),
        note: `Kiểm kê ${phieu.code} — mã ${muc.asset.code}.`,
        ...ctx,
      },
      tx,
    );
  });

  return prisma.inventoryCount.findUniqueOrThrow({ where: { id: kiemKeId }, select: CHON_KIEM_KE });
}

export async function guiChot(
  id: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KiemKeDayDu> {
  const phieu = await prisma.inventoryCount.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, items: { select: { countedQuantity: true } } },
  });
  if (!phieu) throw loi404('Không tìm thấy phiếu kiểm kê.');
  if (phieu.status !== 'DANG_KIEM') throw loi409('Chỉ gửi chốt được phiếu đang kiểm.');

  const chuaDem = phieu.items.filter((m) => m.countedQuantity === null).length;
  if (chuaDem > 0) {
    throw loi422(`Còn ${chuaDem} dòng chưa nhập thực đếm.`, 'CHUA_DEM_HET', { chuaDem });
  }

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.inventoryCount.update({
      where: { id },
      data: { status: 'CHO_CHOT' },
      select: CHON_KIEM_KE,
    });
    await ghiAudit(
      {
        actor,
        action: 'inventory_count.submit',
        entityType: 'inventory_count',
        entityId: id,
        beforeValue: { status: 'DANG_KIEM' },
        afterValue: { status: 'CHO_CHOT' },
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  phatChoNguoiDuyet(SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: `Phiếu kiểm kê ${sau.code} chờ chốt.`,
  });
  return sau;
}

/**
 * ADMIN chốt phiếu. Mỗi dòng chênh lệch sinh một movement `DIEU_CHINH_KIEM_KE`:
 * thiếu thì hàng "ra khỏi hệ thống" (to = null), thừa thì "vào từ ngoài"
 * (from = null). Tồn kho sau chốt vẫn hoàn toàn suy ra từ movements.
 */
export async function chot(
  id: string,
  duLieu: DuLieuChot,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<{ phieu: KiemKeDayDu; soDieuChinh: number; soDoiTinhTrang: number }> {
  const phieu = await prisma.inventoryCount.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      status: true,
      locationId: true,
      location: { select: { name: true } },
      items: { select: CHON_MUC },
    },
  });
  if (!phieu) throw loi404('Không tìm thấy phiếu kiểm kê.');
  if (phieu.status !== 'CHO_CHOT' && phieu.status !== 'DANG_KIEM') {
    throw loi409('Phiếu đã chốt hoặc đã huỷ.');
  }
  const chuaDem = phieu.items.filter((m) => m.countedQuantity === null).length;
  if (chuaDem > 0) {
    throw loi422(`Còn ${chuaDem} dòng chưa nhập thực đếm.`, 'CHUA_DEM_HET', { chuaDem });
  }

  const dong = phieu.items.map(dungDongBaoCao);
  const lech = dong.filter((d) => (d.chenhLech ?? 0) !== 0);
  const doiTT = dong.filter((d) => d.doiTinhTrang);
  const bayGio = new Date();

  const sau = await prisma.$transaction(async (tx) => {
    if (duLieu.dieuChinhTon) {
      for (const m of phieu.items) {
        const d = dungDongBaoCao(m);
        const chenh = d.chenhLech ?? 0;

        if (chenh !== 0) {
          // Thiếu: hàng rời hệ thống. Thừa: hàng vào hệ thống. Luôn dương ở `quantity`.
          await tx.movement.create({
            data: {
              assetId: m.asset.id,
              type: 'DIEU_CHINH_KIEM_KE',
              fromLocationId: chenh < 0 ? phieu.locationId : null,
              toLocationId: chenh < 0 ? null : phieu.locationId,
              quantity: Math.abs(chenh),
              conditionBefore: m.systemCondition,
              conditionAfter: m.countedCondition ?? m.systemCondition,
              performedById: actor.id,
              performedAt: bayGio,
              note: `Điều chỉnh theo phiếu kiểm kê ${phieu.code}: hệ thống ${d.heThong}, thực đếm ${d.thucDem}.`,
            },
          });
        }

        if (d.doiTinhTrang && m.countedCondition) {
          await tx.asset.update({
            where: { id: m.asset.id },
            data: { condition: m.countedCondition },
          });
        }

        if (chenh !== 0 || d.doiTinhTrang) {
          await tx.inventoryCountItem.update({
            where: { id: m.id },
            data: { adjustedAt: bayGio },
          });
          await ghiAudit(
            {
              actor,
              action: 'inventory_count.dieu_chinh',
              entityType: 'asset',
              entityId: m.asset.id,
              beforeValue: { ton: d.heThong, tinhTrang: m.systemCondition },
              afterValue: { ton: d.thucDem, tinhTrang: m.countedCondition },
              note: `Chốt kiểm kê ${phieu.code} — mã ${d.code} tại ${phieu.location.name}.`,
              ...ctx,
            },
            tx,
          );
        }
      }
    }

    if (lech.length > 0) {
      await tx.alert.create({
        data: {
          type: 'CHENH_LECH_KIEM_KE',
          severity: lech.length > 5 ? 'CAO' : 'TRUNG_BINH',
          title: `Chênh lệch kiểm kê ${phieu.code}`,
          message:
            `${phieu.location.name}: ${lech.length} mã chênh lệch ` +
            `(${lech.map((d) => `${d.code} ${d.heThong}→${d.thucDem}`).slice(0, 10).join(', ')}).`,
          entityType: 'inventory_count',
          entityId: phieu.id,
        },
      });
    }

    const capNhat = await tx.inventoryCount.update({
      where: { id },
      data: { status: 'DA_CHOT', closedAt: bayGio, closedById: actor.id },
      select: CHON_KIEM_KE,
    });

    await ghiAudit(
      {
        actor,
        action: 'inventory_count.close',
        entityType: 'inventory_count',
        entityId: id,
        beforeValue: { status: phieu.status },
        afterValue: {
          status: 'DA_CHOT',
          soDong: dong.length,
          soChenhLech: lech.length,
          soDoiTinhTrang: doiTT.length,
          dieuChinhTon: duLieu.dieuChinhTon,
        },
        note: duLieu.note ?? null,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  if (lech.length > 0) {
    phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
      id: sau.id,
      code: sau.code,
      thongDiep: `Kiểm kê ${sau.code} có ${lech.length} mã chênh lệch.`,
    });
  }
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });

  return { phieu: sau, soDieuChinh: lech.length, soDoiTinhTrang: doiTT.length };
}

export async function huy(
  id: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KiemKeDayDu> {
  const phieu = await prisma.inventoryCount.findUnique({
    where: { id },
    select: { id: true, code: true, status: true },
  });
  if (!phieu) throw loi404('Không tìm thấy phiếu kiểm kê.');
  if (phieu.status === 'DA_CHOT') throw loi409('Phiếu đã chốt thì không huỷ được.');

  return prisma.$transaction(async (tx) => {
    const capNhat = await tx.inventoryCount.update({
      where: { id },
      data: { status: 'HUY', closedAt: new Date(), closedById: actor.id },
      select: CHON_KIEM_KE,
    });
    await ghiAudit(
      {
        actor,
        action: 'inventory_count.cancel',
        entityType: 'inventory_count',
        entityId: id,
        beforeValue: { status: phieu.status },
        afterValue: { status: 'HUY' },
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });
}
