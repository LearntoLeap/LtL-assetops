/**
 * BIÊN BẢN BÀN GIAO (BBBG) — luồng C.
 *
 * Điểm quan trọng nhất: **xác nhận biên bản mới là lúc thiết bị đổi vị trí sở
 * hữu**. Lúc xuất kho (giai đoạn 4), phân bổ/luân chuyển chỉ đánh dấu "Đang vận
 * chuyển" và CHƯA ghi movement. Đến khi bên nhận bấm xác nhận trên app, hàm
 * `xacNhan` mới ghi movement, đổi vị trí và đóng yêu cầu.
 *
 * Các dòng thiết bị trên biên bản lưu BẢN CHỤP (mã, tên, tình trạng) tại thời
 * điểm lập: biên bản là chứng từ, đổi tên thiết bị sau này không được làm thay
 * đổi nội dung đã ký.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Prisma, RequestType, TrackingType } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { LoiHttp, loi400, loi403, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { docCaiDat, type CaiDatChung } from '../../lib/cai-dat.js';
import { duongDanTuyetDoi, thuMucGoc } from '../../lib/luu-anh.js';
import { xoaFileTaiLieu } from '../../lib/luu-tai-lieu.js';
import { log, moTaLoi } from '../../lib/ghi-log.js';
import { taoFileBBBG, tenFileBBBG, type DongInBBBG, type DuLieuInBBBG } from './bbbg.docx.js';
import { mauCuaLoai, vViecCuThe } from './mau-bbbg.js';
import { phamViCua } from '../../lib/pham-vi.js';
import { phatChoDiaDiem, phatChoNguoiDuyet, phatChoNguoiDung, phatChoTatCa, SU_KIEN } from '../../realtime.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type { DuLieuLocBBBG, DuLieuSuaBBBG, DuLieuTaoBBBG } from './bbbg.schema.js';

const CHON_BBBG = {
  id: true,
  code: true,
  status: true,
  templateType: true,
  subtitle: true,
  basis: true,
  giverName: true,
  giverTitle: true,
  giverOrg: true,
  giverAddress: true,
  giverTaxCode: true,
  giverPhone: true,
  receiverOrg: true,
  receiverName: true,
  receiverTitle: true,
  receiverPhone: true,
  receiverAddress: true,
  issuedDate: true,
  handoverPlace: true,
  inspection: true,
  obligations: true,
  copies: true,
  commitment: true,
  note: true,
  rejectionNote: true,
  confirmedAt: true,
  fileName: true,
  fileSize: true,
  fileGeneratedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  confirmedBy: { select: { id: true, fullName: true } },
  receiverLocation: { select: { id: true, code: true, name: true, type: true } },
  request: {
    select: { id: true, code: true, type: true, status: true, reason: true, expectedReturnAt: true },
  },
  items: {
    select: {
      id: true,
      assetCodeSnapshot: true,
      assetNameSnapshot: true,
      quantity: true,
      unit: true,
      conditionSnapshot: true,
      groupLabel: true,
      note: true,
      sortOrder: true,
      asset: { select: { id: true, currentLocationId: true } },
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.HandoverNoteSelect;

export type BBBGDayDu = Prisma.HandoverNoteGetPayload<{ select: typeof CHON_BBBG }>;

function doiNgay(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw loi400(`Ngày không hợp lệ: ${iso}`, 'NGAY_KHONG_HOP_LE');
  return d;
}

/** Điều kiện lọc theo phạm vi: điểm trường chỉ thấy biên bản gửi cho mình. */
function dieuKienPhamVi(nguoiDung: NguoiDungDaXacThuc): Prisma.HandoverNoteWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return {};
  if (pv.diaDiem) {
    return {
      OR: [
        { receiverLocationId: { in: [...pv.diaDiem] } },
        { createdById: nguoiDung.id },
      ],
    };
  }
  return { createdById: nguoiDung.id };
}

export async function danhSach(
  nguoiDung: NguoiDungDaXacThuc,
  loc: DuLieuLocBBBG,
): Promise<{ muc: BBBGDayDu[]; tong: number; trang: number; moiTrang: number }> {
  const dieuKien: Prisma.HandoverNoteWhereInput = {
    ...dieuKienPhamVi(nguoiDung),
    ...(loc.status ? { status: loc.status } : {}),
    ...(loc.templateType ? { templateType: loc.templateType } : {}),
    ...(loc.receiverLocationId ? { receiverLocationId: loc.receiverLocationId } : {}),
    ...(loc.tuKhoa
      ? {
          OR: [
            { code: { contains: loc.tuKhoa } },
            { receiverOrg: { contains: loc.tuKhoa } },
            { receiverName: { contains: loc.tuKhoa } },
            { items: { some: { assetCodeSnapshot: { contains: loc.tuKhoa } } } },
          ],
        }
      : {}),
  };

  const [muc, tong] = await Promise.all([
    prisma.handoverNote.findMany({
      where: dieuKien,
      select: CHON_BBBG,
      orderBy: { createdAt: 'desc' },
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.handoverNote.count({ where: dieuKien }),
  ]);
  return { muc, tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

export async function xemMot(nguoiDung: NguoiDungDaXacThuc, id: string): Promise<BBBGDayDu> {
  const bbbg = await prisma.handoverNote.findFirst({
    where: { id, ...dieuKienPhamVi(nguoiDung) },
    select: CHON_BBBG,
  });
  if (!bbbg) throw loi404('Không tìm thấy biên bản, hoặc biên bản ngoài phạm vi của bạn.');
  return bbbg;
}

// ===========================================================================
// LẬP BIÊN BẢN TỪ YÊU CẦU
// ===========================================================================

/** Yêu cầu kèm mọi thứ cần để điền sẵn biên bản. */
const CHON_YEU_CAU_DE_LAP = {
  id: true,
  code: true,
  type: true,
  status: true,
  reason: true,
  expectedReturnAt: true,
  fromLocationId: true,
  fromLocation: {
    select: { id: true, name: true, address: true, contactName: true, contactPhone: true },
  },
  toLocationId: true,
  toLocation: {
    select: { id: true, name: true, address: true, contactName: true, contactPhone: true },
  },
  destinationNote: true,
  createdBy: { select: { id: true, fullName: true, phone: true } },
  items: {
    select: {
      quantity: true,
      note: true,
      asset: {
        select: {
          id: true,
          code: true,
          name: true,
          condition: true,
          trackingType: true,
          category: { select: { id: true, name: true, sortOrder: true } },
        },
      },
    },
  },
} satisfies Prisma.RequestSelect;

type YeuCauDeLap = Prisma.RequestGetPayload<{ select: typeof CHON_YEU_CAU_DE_LAP }>;

/** Đơn vị tính mặc định: đếm theo số lượng là "Chiếc", theo từng bộ là "Bộ". */
function donViMacDinh(kieu: TrackingType): string {
  return kieu === 'SO_LUONG' ? 'Chiếc' : 'Bộ';
}

const CHU_NHOM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Dựng các dòng thiết bị cho biên bản, có gộp nhóm theo LOẠI SẢN PHẨM giống mẫu
 * Word của LtL ("A. THIẾT BỊ AI – ROBOTICS", "B. THIẾT BỊ HỖ TRỢ HỌC TẬP").
 *
 * Chỉ gắn nhãn nhóm khi có TỪ HAI loại trở lên — một loại thì dòng nhóm chỉ là
 * một dòng thừa trên giấy.
 */
function dongTuYeuCau(yeuCau: YeuCauDeLap): Array<{
  assetId: string;
  assetCodeSnapshot: string;
  assetNameSnapshot: string;
  quantity: number;
  unit: string;
  conditionSnapshot: YeuCauDeLap['items'][number]['asset']['condition'];
  groupLabel: string | null;
  note: string | null;
  sortOrder: number;
}> {
  const theoLoai = new Map<string, { ten: string; thuTu: number }>();
  for (const m of yeuCau.items) {
    if (!theoLoai.has(m.asset.category.id)) {
      theoLoai.set(m.asset.category.id, {
        ten: m.asset.category.name,
        thuTu: m.asset.category.sortOrder,
      });
    }
  }
  const thuTuLoai = [...theoLoai.entries()].sort(
    (a, b) => a[1].thuTu - b[1].thuTu || a[1].ten.localeCompare(b[1].ten, 'vi'),
  );
  const nhanNhom = new Map<string, string | null>();
  thuTuLoai.forEach(([id, loai], i) => {
    nhanNhom.set(id, thuTuLoai.length > 1 ? `${CHU_NHOM[i] ?? '*'}. ${loai.ten.toUpperCase()}` : null);
  });

  const xep = [...yeuCau.items].sort((a, b) => {
    const ta = thuTuLoai.findIndex(([id]) => id === a.asset.category.id);
    const tb = thuTuLoai.findIndex(([id]) => id === b.asset.category.id);
    return ta - tb || a.asset.name.localeCompare(b.asset.name, 'vi');
  });

  return xep.map((m, i) => ({
    assetId: m.asset.id,
    assetCodeSnapshot: m.asset.code,
    assetNameSnapshot: m.asset.name,
    quantity: m.quantity,
    unit: donViMacDinh(m.asset.trackingType),
    conditionSnapshot: m.asset.condition,
    groupLabel: nhanNhom.get(m.asset.category.id) ?? null,
    note: m.note,
    sortOrder: i,
  }));
}

/**
 * ĐIỀN SẴN hai bên từ cài đặt và từ chính yêu cầu.
 *
 * Bên nào là LtL thì lấy theo trang Cài đặt; bên còn lại lấy theo điểm lưu trữ
 * (tên, địa chỉ, người phụ trách, điện thoại) đã khai trong danh mục. Nhờ vậy
 * bấm "Xuất biên bản" là ra file đủ thông tin, không phải gõ lại gì.
 */
function dienSanHaiBen(
  yeuCau: YeuCauDeLap,
  caiDat: CaiDatChung,
  loaiMau: RequestType,
): {
  giverOrg: string;
  giverName: string;
  giverTitle: string | null;
  giverAddress: string | null;
  giverTaxCode: string | null;
  giverPhone: string | null;
  receiverOrg: string;
  receiverName: string;
  receiverTitle: string | null;
  receiverPhone: string | null;
  receiverAddress: string | null;
} {
  const mau = mauCuaLoai(loaiMau);
  const ltl = {
    org: caiDat.congTyTen,
    name: caiDat.daiDienTen || '…………………………',
    title: caiDat.daiDienChucVu || null,
    address: caiDat.congTyDiaChi || null,
    taxCode: caiDat.congTyMaSoThue || null,
    phone: caiDat.congTyDienThoai || null,
  };
  /*
   * Bên còn lại (không phải LtL).
   *
   * Mẫu LtL GIAO thì đối tác là ĐIỂM ĐẾN; mẫu LtL NHẬN (nhập kho, trả về kho,
   * luân chuyển) thì đối tác là ĐIỂM ĐI. KHÔNG được lùi về điểm đến ở nhóm sau:
   * điểm đến lúc đó chính là kho của LtL, lùi về là in ra biên bản "LtL bàn
   * giao cho LtL". Thiếu điểm đi thì lấy ghi chú nơi đến, rồi đến người lập —
   * đúng với trường hợp nhân sự mượn thiết bị mang trả.
   */
  const doiTac = mau.benGiaoLaLtL ? yeuCau.toLocation : yeuCau.fromLocation;
  const ben = {
    org: doiTac?.name ?? yeuCau.destinationNote ?? yeuCau.createdBy.fullName,
    name: doiTac?.contactName ?? yeuCau.createdBy.fullName,
    title: null as string | null,
    address: doiTac?.address ?? null,
    taxCode: null as string | null,
    phone: doiTac?.contactPhone ?? yeuCau.createdBy.phone ?? null,
  };

  const giao = mau.benGiaoLaLtL ? ltl : ben;
  const nhan = mau.benGiaoLaLtL ? ben : ltl;
  return {
    giverOrg: giao.org,
    giverName: giao.name,
    giverTitle: giao.title,
    giverAddress: giao.address,
    giverTaxCode: giao.taxCode,
    giverPhone: giao.phone,
    receiverOrg: nhan.org,
    receiverName: nhan.name,
    receiverTitle: nhan.title,
    receiverPhone: nhan.phone,
    receiverAddress: nhan.address,
  };
}

async function docYeuCauDeLap(requestId: string): Promise<YeuCauDeLap> {
  const yeuCau = await prisma.request.findUnique({
    where: { id: requestId },
    select: CHON_YEU_CAU_DE_LAP,
  });
  if (!yeuCau) throw loi404('Không tìm thấy yêu cầu để lập biên bản.');
  if (yeuCau.items.length === 0) throw loi422('Yêu cầu chưa có thiết bị nào.', 'YEU_CAU_RONG');

  // Nội dung biên bản chỉ chốt được khi yêu cầu đã duyệt. Lập ở trạng thái
  // DA_DUYET là để in sẵn mang đi ký lúc giao hàng — vẫn là bản nháp, chưa gửi
  // cho bên nhận xác nhận được (xem `guiXacNhan`).
  if (yeuCau.status !== 'DA_DUYET' && yeuCau.status !== 'DA_XUAT' && yeuCau.status !== 'DA_HOAN_TAT') {
    throw loi422(
      `Yêu cầu đang ở trạng thái "${yeuCau.status}" — phải được duyệt mới lập được biên bản bàn giao.`,
      'CHUA_DUYET',
    );
  }
  return yeuCau;
}

/** Lập biên bản từ một yêu cầu — chụp lại mã/tên/tình trạng thiết bị lúc lập. */
export async function tao(
  duLieu: DuLieuTaoBBBG,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const yeuCau = await docYeuCauDeLap(duLieu.requestId);
  const caiDat = await docCaiDat();
  const loaiMau = duLieu.templateType ?? yeuCau.type;
  const mau = mauCuaLoai(loaiMau);

  return prisma.$transaction(async (tx) => {
    /*
     * KHOÁ DÒNG YÊU CẦU rồi mới kiểm "đã có biên bản chưa".
     *
     * Kiểm ngoài transaction thì hai lượt gọi cùng lúc — bấm nút hai lần trên
     * mạng chậm, hoặc bấm đúng lúc hook tự lập sau xuất kho chạy — cùng thấy
     * "chưa có", cùng cấp số, và một lần bàn giao đẻ ra hai biên bản mang hai
     * số khác nhau. Chứng từ trùng như thế không sửa được bằng cách xoá bớt:
     * số đã cấp là đã vào sổ.
     *
     * Không đặt UNIQUE lên request_id được, vì biên bản bị bên nhận TỪ CHỐI
     * thì phải lập lại được cho cùng yêu cầu đó.
     */
    await tx.$queryRaw`SELECT id FROM requests WHERE id = ${yeuCau.id} FOR UPDATE`;

    const daCo = await tx.handoverNote.findFirst({
      where: { requestId: yeuCau.id, status: { not: 'TU_CHOI' } },
      select: { id: true, code: true },
    });
    if (daCo) {
      throw loi409(`Yêu cầu này đã có biên bản ${daCo.code}.`, { bbbgId: daCo.id });
    }

    const code = await capSoChungTu(tx, TIEN_TO.BBBG);
    const bbbg = await tx.handoverNote.create({
      data: {
        code,
        requestId: yeuCau.id,
        status: 'BAN_NHAP',
        templateType: loaiMau,
        subtitle: duLieu.subtitle ?? vViecCuThe(mau, duLieu.giverOrg, duLieu.receiverOrg),
        basis: duLieu.basis ?? caiDat.canCu,
        giverName: duLieu.giverName,
        giverTitle: duLieu.giverTitle ?? null,
        giverOrg: duLieu.giverOrg,
        giverAddress: duLieu.giverAddress ?? null,
        giverTaxCode: duLieu.giverTaxCode ?? null,
        giverPhone: duLieu.giverPhone ?? null,
        receiverLocationId: yeuCau.toLocationId,
        receiverOrg: duLieu.receiverOrg,
        receiverName: duLieu.receiverName,
        receiverTitle: duLieu.receiverTitle ?? null,
        receiverPhone: duLieu.receiverPhone ?? null,
        receiverAddress: duLieu.receiverAddress ?? null,
        issuedDate: duLieu.issuedDate ? doiNgay(duLieu.issuedDate) : new Date(),
        handoverPlace: duLieu.handoverPlace ?? null,
        inspection: duLieu.inspection ?? mau.ketQuaKiemTra.join('\n'),
        obligations: duLieu.obligations ?? mau.trachNhiem.join('\n'),
        copies: duLieu.copies ?? caiDat.soBan,
        commitment: duLieu.commitment ?? mau.camKet,
        note: duLieu.note ?? null,
        createdById: actor.id,
        items: { create: dongTuYeuCau(yeuCau) },
      },
      select: CHON_BBBG,
    });

    await ghiAudit(
      {
        actor,
        action: 'handover.create',
        entityType: 'handover_note',
        entityId: bbbg.id,
        afterValue: {
          code,
          requestCode: yeuCau.code,
          templateType: loaiMau,
          soDong: yeuCau.items.length,
          receiverOrg: duLieu.receiverOrg,
        },
        ...ctx,
      },
      tx,
    );
    return bbbg;
  });
}

/**
 * XUẤT BIÊN BẢN NGAY TỪ YÊU CẦU — không phải mở trang Biên bản rồi chọn lại.
 *
 * Gọi được nhiều lần: đã có biên bản còn hiệu lực thì trả lại đúng biên bản đó
 * chứ không cấp thêm số mới. Nhờ vậy nút "Xuất biên bản" bấm mấy lần cũng an
 * toàn, và hook tự động sau xuất/nhập kho không sinh ra biên bản trùng.
 */
export async function taoTuYeuCau(
  requestId: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
  loaiMau?: RequestType,
): Promise<{ bbbg: BBBGDayDu; moi: boolean }> {
  const daCo = await prisma.handoverNote.findFirst({
    where: { requestId, status: { not: 'TU_CHOI' } },
    select: CHON_BBBG,
    orderBy: { createdAt: 'desc' },
  });
  if (daCo) return { bbbg: daCo, moi: false };

  const yeuCau = await docYeuCauDeLap(requestId);
  const caiDat = await docCaiDat();
  const loai = loaiMau ?? yeuCau.type;
  const hai = dienSanHaiBen(yeuCau, caiDat, loai);

  // Hai lượt gọi song song: lượt thua sẽ nhận 409 từ `tao()` (đã khoá dòng yêu
  // cầu), ở đây đổi lại thành "trả về biên bản đã có" cho đúng nghĩa idempotent.
  let bbbg: BBBGDayDu;
  try {
    bbbg = await tao(
      {
        requestId,
        templateType: loai,
        ...hai,
        ...(hai.giverTitle === null ? {} : { giverTitle: hai.giverTitle }),
        ...(hai.giverAddress === null ? {} : { giverAddress: hai.giverAddress }),
        ...(hai.giverTaxCode === null ? {} : { giverTaxCode: hai.giverTaxCode }),
        ...(hai.giverPhone === null ? {} : { giverPhone: hai.giverPhone }),
        ...(hai.receiverTitle === null ? {} : { receiverTitle: hai.receiverTitle }),
        ...(hai.receiverPhone === null ? {} : { receiverPhone: hai.receiverPhone }),
        ...(hai.receiverAddress === null ? {} : { receiverAddress: hai.receiverAddress }),
        ...(hai.receiverAddress ? { handoverPlace: hai.receiverAddress } : {}),
      } as DuLieuTaoBBBG,
      actor,
      ctx,
    );
  } catch (loi) {
    const daCoId =
      loi instanceof LoiHttp && loi.maHttp === 409 ? loi.chiTiet?.['bbbgId'] : undefined;
    if (typeof daCoId !== 'string') throw loi;
    const cu = await prisma.handoverNote.findUnique({ where: { id: daCoId }, select: CHON_BBBG });
    if (!cu) throw loi;
    return { bbbg: cu, moi: false };
  }
  return { bbbg, moi: true };
}

/**
 * Tự lập biên bản sau mỗi lần xuất / nhập kho, để lần luân chuyển nào cũng có
 * chứng từ lưu lại.
 *
 * KHÔNG được làm hỏng việc xuất/nhập kho: gọi NGOÀI transaction và nuốt mọi lỗi
 * (chỉ ghi log). Hàng đã ra khỏi kho rồi thì không thể vì lỗi sinh file mà quay
 * ngược lại được; thiếu biên bản thì lập tay sau, mất tồn kho thì không sửa nổi.
 */
export async function lapBBBGTuDong(
  requestId: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<void> {
  try {
    const { bbbg, moi } = await taoTuYeuCau(requestId, actor, ctx);
    if (moi) await sinhFile(bbbg.id, actor, ctx);
  } catch (loi) {
    log.warn('Không tự lập được biên bản bàn giao sau xuất/nhập kho', {
      requestId,
      ...moTaLoi(loi),
    });
  }
}

// ===========================================================================
// FILE MỀM (.docx)
// ===========================================================================

/** Đổi bản ghi trong CSDL thành dữ liệu để dựng file Word. */
function duLieuIn(bbbg: BBBGDayDu): DuLieuInBBBG {
  const muc: DongInBBBG[] = bbbg.items.map((m) => ({
    ma: m.assetCodeSnapshot,
    ten: m.assetNameSnapshot,
    donVi: m.unit,
    soLuong: m.quantity,
    tinhTrang: m.conditionSnapshot,
    ghiChu: m.note,
    nhom: m.groupLabel,
  }));
  return {
    code: bbbg.code,
    templateType: bbbg.templateType,
    subtitle: bbbg.subtitle,
    basis: bbbg.basis,
    issuedDate: bbbg.issuedDate,
    handoverPlace: bbbg.handoverPlace,
    inspection: bbbg.inspection,
    obligations: bbbg.obligations,
    commitment: bbbg.commitment,
    note: bbbg.note,
    copies: bbbg.copies,
    benGiao: {
      org: bbbg.giverOrg,
      name: bbbg.giverName,
      title: bbbg.giverTitle,
      address: bbbg.giverAddress,
      taxCode: bbbg.giverTaxCode,
      phone: bbbg.giverPhone,
    },
    benNhan: {
      org: bbbg.receiverOrg,
      name: bbbg.receiverName,
      title: bbbg.receiverTitle,
      address: bbbg.receiverAddress,
      phone: bbbg.receiverPhone,
    },
    hanTra: bbbg.request?.expectedReturnAt ?? null,
    yeuCauCode: bbbg.request?.code ?? null,
    muc,
  };
}

export const KIEU_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Sinh (hoặc sinh lại) file Word và lưu vào ổ đĩa, gắn vào biên bản.
 *
 * File cũ bị xoá khỏi đĩa sau khi bản ghi đã trỏ sang file mới — làm theo thứ
 * tự đó để không bao giờ có lúc bản ghi trỏ vào một file đã biến mất.
 */
export async function sinhFile(
  id: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const bbbg = await prisma.handoverNote.findUnique({ where: { id }, select: CHON_BBBG });
  if (!bbbg) throw loi404('Không tìm thấy biên bản.');

  const cu = await prisma.handoverNote.findUnique({ where: { id }, select: { filePath: true } });
  const noiDung = await taoFileBBBG(duLieuIn(bbbg));
  const fileName = tenFileBBBG(bbbg, bbbg.receiverOrg);

  const nay = new Date();
  const thuMuc = join('bbbg', String(nay.getFullYear()), String(nay.getMonth() + 1).padStart(2, '0'));
  await mkdir(join(thuMucGoc(), thuMuc), { recursive: true });
  const duongDan = join(thuMuc, `${randomBytes(12).toString('hex')}.docx`);
  await writeFile(join(thuMucGoc(), duongDan), noiDung);

  const sau = await prisma.handoverNote.update({
    where: { id },
    data: {
      filePath: duongDan,
      fileName,
      fileSize: noiDung.length,
      fileGeneratedAt: nay,
    },
    select: CHON_BBBG,
  });

  if (cu?.filePath && cu.filePath !== duongDan) await xoaFileTaiLieu(cu.filePath);

  await ghiAudit({
    actor,
    action: 'handover.export',
    entityType: 'handover_note',
    entityId: id,
    afterValue: {
      code: bbbg.code,
      fileName,
      byteSize: noiDung.length,
      checksum: createHash('sha256').update(noiDung).digest('hex').slice(0, 16),
    },
    ...ctx,
  });
  return sau;
}

/** Đường dẫn file mềm để tải về; chưa có file thì sinh trước rồi trả lại. */
export async function layFile(
  id: string,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<{ dayDu: string; fileName: string; byteSize: number }> {
  let bbbg = await xemMot(nguoiDung, id);
  // Sinh lại khi chưa có file, hoặc khi biên bản đã sửa sau lần xuất gần nhất —
  // file tải về luôn khớp với nội dung đang lưu, dù sửa bằng đường nào.
  const cu = bbbg.fileGeneratedAt;
  if (!bbbg.fileName || !cu || cu.getTime() < bbbg.updatedAt.getTime()) {
    bbbg = await sinhFile(id, nguoiDung, ctx);
  }

  const ban = await prisma.handoverNote.findUnique({
    where: { id },
    select: { filePath: true, fileName: true, fileSize: true },
  });
  const dayDu = ban?.filePath ? duongDanTuyetDoi(ban.filePath) : null;
  if (!dayDu) throw loi404('Biên bản chưa có file mềm.');
  return {
    dayDu,
    fileName: ban?.fileName ?? `${bbbg.code}.docx`,
    byteSize: ban?.fileSize ?? 0,
  };
}

export async function sua(
  id: string,
  duLieu: DuLieuSuaBBBG,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const truoc = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, createdById: true },
  });
  if (!truoc) throw loi404('Không tìm thấy biên bản.');
  // Biên bản đã gửi đi là chứng từ — không sửa nội dung nữa.
  if (truoc.status !== 'BAN_NHAP') {
    throw loi409('Chỉ sửa được biên bản còn ở trạng thái Nháp.');
  }

  return prisma.$transaction(async (tx) => {
    for (const m of duLieu.muc ?? []) {
      await tx.handoverNoteItem.updateMany({
        where: { id: m.id, handoverNoteId: id },
        data: {
          ...(m.conditionSnapshot === undefined ? {} : { conditionSnapshot: m.conditionSnapshot }),
          ...(m.unit === undefined ? {} : { unit: m.unit }),
          ...(m.groupLabel === undefined ? {} : { groupLabel: m.groupLabel }),
          ...(m.note === undefined ? {} : { note: m.note }),
        },
      });
    }

    const sau = await tx.handoverNote.update({
      where: { id },
      data: {
        ...(duLieu.templateType === undefined ? {} : { templateType: duLieu.templateType }),
        ...(duLieu.subtitle === undefined ? {} : { subtitle: duLieu.subtitle }),
        ...(duLieu.basis === undefined ? {} : { basis: duLieu.basis }),
        ...(duLieu.giverName === undefined ? {} : { giverName: duLieu.giverName }),
        ...(duLieu.giverTitle === undefined ? {} : { giverTitle: duLieu.giverTitle }),
        ...(duLieu.giverOrg === undefined ? {} : { giverOrg: duLieu.giverOrg }),
        ...(duLieu.giverAddress === undefined ? {} : { giverAddress: duLieu.giverAddress }),
        ...(duLieu.giverTaxCode === undefined ? {} : { giverTaxCode: duLieu.giverTaxCode }),
        ...(duLieu.giverPhone === undefined ? {} : { giverPhone: duLieu.giverPhone }),
        ...(duLieu.receiverOrg === undefined ? {} : { receiverOrg: duLieu.receiverOrg }),
        ...(duLieu.receiverName === undefined ? {} : { receiverName: duLieu.receiverName }),
        ...(duLieu.receiverTitle === undefined ? {} : { receiverTitle: duLieu.receiverTitle }),
        ...(duLieu.receiverPhone === undefined ? {} : { receiverPhone: duLieu.receiverPhone }),
        ...(duLieu.receiverAddress === undefined ? {} : { receiverAddress: duLieu.receiverAddress }),
        ...(duLieu.issuedDate === undefined ? {} : { issuedDate: doiNgay(duLieu.issuedDate) }),
        ...(duLieu.handoverPlace === undefined ? {} : { handoverPlace: duLieu.handoverPlace }),
        ...(duLieu.inspection === undefined ? {} : { inspection: duLieu.inspection }),
        ...(duLieu.obligations === undefined ? {} : { obligations: duLieu.obligations }),
        ...(duLieu.copies === undefined ? {} : { copies: duLieu.copies }),
        ...(duLieu.commitment === undefined ? {} : { commitment: duLieu.commitment }),
        ...(duLieu.note === undefined ? {} : { note: duLieu.note }),
      },
      select: CHON_BBBG,
    });

    await ghiAudit(
      {
        actor,
        action: 'handover.update',
        entityType: 'handover_note',
        entityId: id,
        afterValue: { code: truoc.code },
        ...ctx,
      },
      tx,
    );
    return sau;
  });
}

/** Gửi cho bên nhận xác nhận: Nháp → Chờ bên nhận xác nhận. */
export async function guiXacNhan(
  id: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const truoc = await prisma.handoverNote.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      status: true,
      receiverLocationId: true,
      request: { select: { code: true, status: true } },
    },
  });
  if (!truoc) throw loi404('Không tìm thấy biên bản.');
  if (truoc.status !== 'BAN_NHAP') {
    throw loi409('Chỉ gửi xác nhận được biên bản đang ở trạng thái Nháp.');
  }
  // Lập biên bản sớm (ngay khi yêu cầu vừa duyệt) là để IN mang đi ký. Nhưng gửi
  // cho bên nhận bấm xác nhận thì phải đợi hàng thật sự xuất kho: chính cú bấm
  // xác nhận mới ghi movement và đổi vị trí thiết bị (luồng C), xác nhận trước
  // khi xuất là ghi nhận một lần bàn giao chưa hề xảy ra.
  if (truoc.request && truoc.request.status !== 'DA_XUAT' && truoc.request.status !== 'DA_HOAN_TAT') {
    throw loi422(
      `Yêu cầu ${truoc.request.code} chưa xuất kho — in biên bản mang đi ký thì được, nhưng chưa gửi bên nhận xác nhận trên hệ thống được.`,
      'CHUA_XUAT_KHO',
    );
  }

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.handoverNote.update({
      where: { id },
      data: { status: 'CHO_XAC_NHAN' },
      select: CHON_BBBG,
    });
    await ghiAudit(
      {
        actor,
        action: 'handover.submit',
        entityType: 'handover_note',
        entityId: id,
        beforeValue: { status: 'BAN_NHAP' },
        afterValue: { status: 'CHO_XAC_NHAN' },
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  if (truoc.receiverLocationId) {
    phatChoDiaDiem(truoc.receiverLocationId, SU_KIEN.YEU_CAU_DOI, {
      id: sau.id,
      code: sau.code,
      status: sau.status,
      thongDiep: `Biên bản ${sau.code} đang chờ bạn xác nhận.`,
    });
  }
  return sau;
}

/**
 * BÊN NHẬN XÁC NHẬN — đây là lúc thiết bị thật sự đổi vị trí sở hữu (luồng C).
 *
 * Chỉ tài khoản thuộc đúng điểm nhận (hoặc ADMIN/VAN_HANH) mới xác nhận được.
 */
export async function xacNhan(
  id: string,
  ghiChu: string | undefined,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const bbbg = await prisma.handoverNote.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      status: true,
      receiverLocationId: true,
      requestId: true,
      request: { select: { id: true, code: true, type: true, status: true, expectedReturnAt: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          conditionSnapshot: true,
          assetCodeSnapshot: true,
          asset: { select: { id: true, currentLocationId: true, condition: true } },
        },
      },
    },
  });
  if (!bbbg) throw loi404('Không tìm thấy biên bản.');
  if (bbbg.status !== 'CHO_XAC_NHAN') {
    throw loi409(
      `Biên bản đang ở trạng thái khác "Chờ bên nhận xác nhận" nên không xác nhận được.`,
    );
  }

  const pv = phamViCua(nguoiDung);
  const dungBenNhan =
    pv.toanBoKho ||
    (bbbg.receiverLocationId !== null && nguoiDung.locationId === bbbg.receiverLocationId);
  if (!dungBenNhan) {
    throw loi403('Chỉ tài khoản của đơn vị nhận mới xác nhận được biên bản này.');
  }
  if (!bbbg.receiverLocationId) {
    throw loi422(
      'Biên bản chưa gắn điểm nhận trong danh mục nên không xác định được thiết bị chuyển về đâu.',
      'THIEU_DIEM_NHAN',
    );
  }

  const noiNhan = bbbg.receiverLocationId;
  const bayGio = new Date();
  const loaiChoXacNhan =
    bbbg.request?.type === 'PHAN_BO_VE_TRUONG' || bbbg.request?.type === 'LUAN_CHUYEN_TRUONG';

  const sau = await prisma.$transaction(async (tx) => {
    // Movement chỉ ghi cho loại "chờ xác nhận" — các loại khác đã ghi lúc xuất kho.
    if (loaiChoXacNhan) {
      for (const m of bbbg.items) {
        const movement = await tx.movement.create({
          data: {
            assetId: m.asset.id,
            type: bbbg.request?.type === 'LUAN_CHUYEN_TRUONG' ? 'LUAN_CHUYEN' : 'PHAN_BO',
            fromLocationId: m.asset.currentLocationId,
            toLocationId: noiNhan,
            requestId: bbbg.requestId,
            quantity: m.quantity,
            conditionBefore: m.asset.condition,
            conditionAfter: m.asset.condition,
            performedById: nguoiDung.id,
            performedAt: bayGio,
            note: `Bên nhận xác nhận biên bản ${bbbg.code}.`,
          },
          select: { id: true },
        });

        await tx.asset.update({
          where: { id: m.asset.id },
          data: {
            currentLocationId: noiNhan,
            allocationStatus: 'DA_PHAN_BO',
            ...(bbbg.request?.expectedReturnAt
              ? { dueReturnAt: bbbg.request.expectedReturnAt }
              : {}),
          },
        });

        await ghiAudit(
          {
            actor: nguoiDung,
            action: 'asset.xac_nhan_ban_giao',
            entityType: 'asset',
            entityId: m.asset.id,
            beforeValue: {
              currentLocationId: m.asset.currentLocationId,
              allocationStatus: 'DANG_VAN_CHUYEN',
            },
            afterValue: {
              currentLocationId: noiNhan,
              allocationStatus: 'DA_PHAN_BO',
              movementId: movement.id,
            },
            note: `Bên nhận xác nhận biên bản ${bbbg.code} — mã ${m.assetCodeSnapshot}.`,
            ...ctx,
          },
          tx,
        );
      }

      if (bbbg.requestId) {
        await tx.request.update({
          where: { id: bbbg.requestId },
          data: { status: 'DA_HOAN_TAT', completedAt: bayGio },
        });
      }
    }

    const capNhat = await tx.handoverNote.update({
      where: { id },
      data: {
        status: 'DA_XAC_NHAN',
        confirmedById: nguoiDung.id,
        confirmedAt: bayGio,
        ...(ghiChu ? { note: ghiChu } : {}),
      },
      select: CHON_BBBG,
    });

    await ghiAudit(
      {
        actor: nguoiDung,
        action: 'handover.confirm',
        entityType: 'handover_note',
        entityId: id,
        beforeValue: { status: 'CHO_XAC_NHAN' },
        afterValue: {
          status: 'DA_XAC_NHAN',
          soDong: bbbg.items.length,
          doiViTri: loaiChoXacNhan,
        },
        note: ghiChu ?? null,
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
    thongDiep: `Biên bản ${sau.code} đã được bên nhận xác nhận.`,
  });
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  return sau;
}

export async function tuChoi(
  id: string,
  rejectionNote: string,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const bbbg = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, receiverLocationId: true, createdById: true },
  });
  if (!bbbg) throw loi404('Không tìm thấy biên bản.');
  if (bbbg.status !== 'CHO_XAC_NHAN') {
    throw loi409('Chỉ từ chối được biên bản đang chờ xác nhận.');
  }
  const pv = phamViCua(nguoiDung);
  const dungBenNhan =
    pv.toanBoKho ||
    (bbbg.receiverLocationId !== null && nguoiDung.locationId === bbbg.receiverLocationId);
  if (!dungBenNhan) {
    throw loi403('Chỉ tài khoản của đơn vị nhận mới từ chối được biên bản này.');
  }

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.handoverNote.update({
      where: { id },
      data: { status: 'TU_CHOI', rejectionNote, confirmedById: nguoiDung.id, confirmedAt: new Date() },
      select: CHON_BBBG,
    });
    await tx.alert.create({
      data: {
        type: 'CHENH_LECH_KIEM_KE',
        severity: 'CAO',
        title: `Bên nhận từ chối biên bản ${capNhat.code}`,
        message: `${capNhat.receiverOrg} từ chối nhận: ${rejectionNote}`,
        entityType: 'handover_note',
        entityId: id,
      },
    });
    await ghiAudit(
      {
        actor: nguoiDung,
        action: 'handover.reject',
        entityType: 'handover_note',
        entityId: id,
        beforeValue: { status: 'CHO_XAC_NHAN' },
        afterValue: { status: 'TU_CHOI' },
        note: rejectionNote,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
    id: sau.id,
    code: sau.code,
    thongDiep: `Biên bản ${sau.code} bị bên nhận từ chối.`,
  });
  phatChoNguoiDung(bbbg.createdById, SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: `Biên bản ${sau.code} bị từ chối.`,
  });
  return sau;
}
