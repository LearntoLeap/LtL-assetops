/**
 * BIÊN BẢN BÀN GIAO (BBBG) — luồng C.
 *
 * Điểm quan trọng nhất: **xác nhận biên bản mới là lúc thiết bị đổi vị trí sở
 * hữu**. Lúc xuất kho (giai đoạn 4), phân bổ/luân chuyển chỉ đánh dấu "Đang vận
 * chuyển" và CHƯA ghi movement. Đến khi Quản trị / Vận hành xác nhận bàn giao
 * (thay bên nhận — bên nhận không bấm gì), `xacNhanBanGiao` mới ghi movement,
 * đổi vị trí và đóng yêu cầu.
 *
 * Các dòng thiết bị trên biên bản lưu BẢN CHỤP (mã, tên, tình trạng) tại thời
 * điểm lập: biên bản là chứng từ, đổi tên thiết bị sau này không được làm thay
 * đổi nội dung đã ký.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Prisma, type HandoverStatus, type RequestType, type TrackingType } from '@prisma/client';
import { prisma, type PrismaTx } from '../../prisma.js';
import { LoiHttp, loi400, loi403, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { docCaiDat, type CaiDatChung } from '../../lib/cai-dat.js';
import { duongDanTuyetDoi, thuMucGoc } from '../../lib/luu-anh.js';
import { xoaFileTaiLieu } from '../../lib/luu-tai-lieu.js';
import { log, moTaLoi } from '../../lib/ghi-log.js';
import { chayTungCai, type KetQuaHangLoatChung } from '../../lib/hang-loat.js';
import { taoFileBBBG, tenFileBBBG, type DongInBBBG, type DuLieuInBBBG } from './bbbg.docx.js';
import { mauCuaLoai, vViecCuThe } from './mau-bbbg.js';
import { dieuKienYeuCau, phamViCua } from '../../lib/pham-vi.js';
import { hangDangTrenDuong, tonTaiDiaDiem } from '../../lib/ton-kho.js';
import { traTrangThaiSauHuyBanGiao } from '../../lib/huy-ban-giao.js';
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
  deletedAt: true,
  deletedBy: { select: { id: true, fullName: true } },
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  confirmedBy: { select: { id: true, fullName: true } },
  receiverLocation: { select: { id: true, code: true, name: true, type: true } },
  request: {
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      reason: true,
      expectedReturnAt: true,
      createdById: true,
    },
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
export function dieuKienPhamVi(nguoiDung: NguoiDungDaXacThuc): Prisma.HandoverNoteWhereInput {
  const pv = phamViCua(nguoiDung);
  // `deletedAt: null` ở CẢ BA nhánh — xem chú thích ở `dieuKienYeuCau`.
  if (pv.toanBoKho) return { deletedAt: null };
  if (pv.diaDiem) {
    return {
      deletedAt: null,
      OR: [
        { receiverLocationId: { in: [...pv.diaDiem] } },
        { createdById: nguoiDung.id },
        // Trường GỬI của một lần luân chuyển cũng phải thấy biên bản mình ký
        // giao — trước đây mở ra là 404 vì biên bản chỉ ghi điểm nhận.
        { request: { fromLocationId: { in: [...pv.diaDiem] } } },
        { request: { toLocationId: { in: [...pv.diaDiem] } } },
        { request: { createdById: nguoiDung.id } },
      ],
    };
  }
  /*
   * NHÂN SỰ PHÒNG BAN — không gắn điểm lưu trữ nào.
   *
   * Trước đây chỉ thấy biên bản DO CHÍNH MÌNH LẬP, mà vai trò này lại không có
   * quyền lập biên bản: kết quả là mượn một con robot, hệ thống tự sinh biên
   * bản bàn giao, mà người mượn không xem nổi, không in nổi tờ giấy mình phải
   * ký. Đo thật: tài khoản nhân sự thấy đúng 0 biên bản, mở thẳng đường dẫn thì
   * 404.
   *
   * Giờ thấy biên bản của chính việc mình làm: mình lập, mình đứng tên yêu cầu,
   * hoặc trên biên bản có thiết bị mình đang giữ. Vẫn KHÔNG thấy biên bản của
   * người khác — phạm vi chỉ mở đúng phần thuộc về mình.
   */
  return {
    deletedAt: null,
    OR: [
      { createdById: nguoiDung.id },
      { request: { createdById: nguoiDung.id } },
      { items: { some: { asset: { holderUserId: nguoiDung.id } } } },
    ],
  };
}

export async function danhSach(
  nguoiDung: NguoiDungDaXacThuc,
  loc: DuLieuLocBBBG,
): Promise<{ muc: BBBGDayDu[]; tong: number; trang: number; moiTrang: number }> {
  /*
   * Phạm vi và tìm kiếm ghép bằng AND — KHÔNG spread. Phạm vi của trường / nhân
   * sự là một khối OR; spread thêm `OR` của ô tìm kiếm thì khối sau GHI ĐÈ khối
   * trước, tài khoản trường gõ một chữ là thấy biên bản của mọi đơn vị (đã đo:
   * 119 → 210 biên bản). Cùng lỗi đã sửa ở danh sách yêu cầu.
   */
  const dieuKien: Prisma.HandoverNoteWhereInput = {
    AND: [
      dieuKienPhamVi(nguoiDung),
      ...(loc.tuKhoa
        ? [
            {
              OR: [
                { code: { contains: loc.tuKhoa } },
                { receiverOrg: { contains: loc.tuKhoa } },
                { receiverName: { contains: loc.tuKhoa } },
                { items: { some: { assetCodeSnapshot: { contains: loc.tuKhoa } } } },
              ],
            },
          ]
        : []),
    ],
    ...(loc.status ? { status: loc.status } : {}),
    ...(loc.templateType ? { templateType: loc.templateType } : {}),
    ...(loc.receiverLocationId ? { receiverLocationId: loc.receiverLocationId } : {}),
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

/**
 * Biên bản CHƯA GỬI bên nhận: còn sửa được, còn gửi xác nhận được.
 * Gồm bản nháp lập tay, bản hệ thống tự lập và bản tự lập đã được sửa.
 */
const TRANG_THAI_CHUA_GUI: ReadonlySet<string> = new Set(['BAN_NHAP', 'TU_LAP', 'DA_CHINH_SUA']);

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
  note: true,
  createdBy: { select: { id: true, fullName: true, phone: true } },
  items: {
    select: {
      quantity: true,
      issuedQuantity: true,
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
    // SỐ THỰC MANG RA, không phải số xin. Kho được mang ra ít hơn số trên phiếu;
    // biên bản ghi số xin thì giấy và kho nói hai con số khác nhau.
    quantity: m.issuedQuantity ?? m.quantity,
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

  const benNhanNgoai = {
    org: yeuCau.toLocation?.name ?? yeuCau.destinationNote ?? '…………………………',
    name: yeuCau.toLocation?.contactName ?? '…………………………',
    title: null as string | null,
    address: yeuCau.toLocation?.address ?? null,
    taxCode: null as string | null,
    phone: yeuCau.toLocation?.contactPhone ?? null,
  };
  // Luân chuyển trường ↔ trường: TRƯỜNG GỬI giao, TRƯỜNG NHẬN nhận.
  const giao = mau.haiBenNgoai ? ben : mau.benGiaoLaLtL ? ltl : ben;
  const nhan = mau.haiBenNgoai ? benNhanNgoai : mau.benGiaoLaLtL ? ben : ltl;
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

  // Không còn bước duyệt: phiếu lập xong là in được biên bản mang đi ký. Biên
  // bản lập sớm vẫn chưa gửi bên nhận xác nhận được cho tới khi hàng thật sự
  // xuất kho (xem `guiXacNhan`). Chỉ phiếu đã bị từ chối là không lập được.
  if (yeuCau.status === 'TU_CHOI') {
    throw loi422(
      `Yêu cầu ${yeuCau.code} đã bị từ chối nên không lập biên bản bàn giao.`,
      'YEU_CAU_BI_TU_CHOI',
    );
  }
  return yeuCau;
}

/** Lập biên bản từ một yêu cầu — chụp lại mã/tên/tình trạng thiết bị lúc lập. */
export async function tao(
  duLieu: DuLieuTaoBBBG,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
  /** Nội bộ: biên bản hệ thống tự điền thì mang trạng thái TU_LAP. */
  trangThaiDau: 'BAN_NHAP' | 'TU_LAP' = 'BAN_NHAP',
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
    const khoaYc = await tx.$queryRaw<Array<{ status: string; deleted_at: Date | null }>>(
      Prisma.sql`SELECT status, deleted_at FROM requests WHERE id = ${yeuCau.id} FOR UPDATE`,
    );
    // Đọc lại SAU KHI KHOÁ: phiếu có thể vừa bị huỷ / xoá ngay sau xuất kho —
    // lập biên bản lúc đó là để lại một biên bản "Tự lập" mở trên phiếu đã huỷ.
    if (!khoaYc[0] || khoaYc[0].deleted_at) throw loi404('Không tìm thấy yêu cầu.');
    if (khoaYc[0].status === 'TU_CHOI') {
      throw loi422('Yêu cầu đã bị từ chối / huỷ nên không lập biên bản.', 'YEU_CAU_BI_TU_CHOI');
    }

    const daCo = await tx.handoverNote.findFirst({
      where: { requestId: yeuCau.id, status: { not: 'TU_CHOI' }, deletedAt: null },
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
        status: trangThaiDau,
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
          status: trangThaiDau,
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
    where: { requestId, status: { not: 'TU_CHOI' }, deletedAt: null },
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
        // Ghi chú của phiếu (vd mượn thêm từ kho khác) in ở mục "Ghi chú khác".
        ...(yeuCau.note ? { note: yeuCau.note } : {}),
      } as DuLieuTaoBBBG,
      actor,
      ctx,
      // Hệ thống tự điền toàn bộ nội dung → TỰ LẬP. Ai sửa thì chuyển "Đã chỉnh sửa".
      'TU_LAP',
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
 * Biên bản lập SỚM (bấm "Xuất biên bản" trước khi xuất kho) ghi số xin trên
 * phiếu. Xuất xong, nếu biên bản còn chưa gửi đi, sửa lại cho khớp SỐ THỰC MANG
 * RA — giấy và kho không được nói hai con số khác nhau. Trả về có đổi gì không.
 */
async function capNhatSoThucXuat(bbbgId: string, requestId: string): Promise<boolean> {
  const bb = await prisma.handoverNote.findUnique({
    where: { id: bbbgId },
    select: { status: true, items: { select: { id: true, assetId: true, quantity: true } } },
  });
  if (!bb || !TRANG_THAI_CHUA_GUI.has(bb.status)) return false;
  const dongYeuCau = await prisma.requestItem.findMany({
    where: { requestId },
    select: { assetId: true, issuedQuantity: true },
  });
  const thucXuat = new Map(dongYeuCau.map((d) => [d.assetId, d.issuedQuantity]));
  let doi = false;
  for (const m of bb.items) {
    const so = m.assetId ? thucXuat.get(m.assetId) : null;
    if (so !== null && so !== undefined && so !== m.quantity) {
      await prisma.handoverNoteItem.update({ where: { id: m.id }, data: { quantity: so } });
      doi = true;
    }
  }
  return doi;
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
    const doiSo = moi ? false : await capNhatSoThucXuat(bbbg.id, requestId);
    if (moi || doiSo) await sinhFile(bbbg.id, actor, ctx);

    /*
     * KHÔNG gửi cho bên nhận xác nhận nữa. Phân bổ / luân chuyển giờ do Quản trị
     * hoặc Vận hành xác nhận bàn giao ở trang yêu cầu (`xacNhanTheoYeuCau`);
     * biên bản giữ "Tự lập" để in mang theo, xác nhận xong thì thành "Đã xác nhận".
     */
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
  // Dung sai 5 giây: chính lần sinh file cũng đẩy `updatedAt` lên vài mili giây
  // sau `fileGeneratedAt`, so thẳng thì lần tải nào cũng sinh lại file.
  if (!bbbg.fileName || !cu || cu.getTime() + 5000 < bbbg.updatedAt.getTime()) {
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

/** Biên bản có nằm trong phạm vi xem của người dùng không (dùng cho quyền sửa của trường). */
export async function bienBanTrongPhamVi(
  bbbgId: string,
  nguoiDung: NguoiDungDaXacThuc,
): Promise<boolean> {
  const bb = await prisma.handoverNote.findFirst({
    where: { AND: [{ id: bbbgId }, dieuKienPhamVi(nguoiDung)] },
    select: { id: true },
  });
  return Boolean(bb);
}

/** Phiếu yêu cầu có nằm trong phạm vi của người dùng không. */
export async function yeuCauTrongPhamVi(
  requestId: string,
  nguoiDung: NguoiDungDaXacThuc,
): Promise<boolean> {
  const yc = await prisma.request.findFirst({
    where: { AND: [{ id: requestId }, dieuKienYeuCau(nguoiDung)] },
    select: { id: true },
  });
  return Boolean(yc);
}

/** Người dùng có phải người lập phiếu gắn với biên bản này không (phiếu còn sống). */
export async function laNguoiLapPhieuCuaBBBG(bbbgId: string, userId: string): Promise<boolean> {
  const bb = await prisma.handoverNote.findUnique({
    where: { id: bbbgId },
    select: { deletedAt: true, request: { select: { createdById: true, deletedAt: true } } },
  });
  return Boolean(
    bb && !bb.deletedAt && bb.request && !bb.request.deletedAt && bb.request.createdById === userId,
  );
}

/** Người dùng có phải người lập phiếu yêu cầu này không. */
export async function laNguoiLapYeuCau(requestId: string, userId: string): Promise<boolean> {
  const yc = await prisma.request.findUnique({
    where: { id: requestId },
    select: { createdById: true, deletedAt: true },
  });
  return Boolean(yc && !yc.deletedAt && yc.createdById === userId);
}

/**
 * Khoá PHIẾU rồi tới BIÊN BẢN (cùng thứ tự với xác nhận / huỷ bàn giao) và đọc
 * lại trạng thái: biên bản phải vẫn "chưa gửi" và chưa xoá. Không khoá thì một
 * lần sửa / gửi chạy song song với xác nhận ghi đè trạng thái, mở lại biên bản
 * đã xác nhận hoặc đã huỷ — đã dựng lại thật.
 */
async function khoaBienBanChuaGui(tx: PrismaTx, id: string): Promise<string> {
  const bb = await tx.handoverNote.findUnique({ where: { id }, select: { requestId: true } });
  if (bb?.requestId) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM requests WHERE id = ${bb.requestId} FOR UPDATE`);
  }
  const khoa = await tx.$queryRaw<Array<{ status: string; deleted_at: Date | null }>>(
    Prisma.sql`SELECT status, deleted_at FROM handover_notes WHERE id = ${id} FOR UPDATE`,
  );
  const dong = khoa[0];
  if (!dong || dong.deleted_at || !TRANG_THAI_CHUA_GUI.has(dong.status)) {
    throw loi409('Biên bản này vừa được xác nhận, huỷ hoặc xoá — tải lại trang để xem.', {
      maLoi: 'DA_XU_LY',
    });
  }
  return dong.status;
}

export async function sua(
  id: string,
  duLieu: DuLieuSuaBBBG,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const truoc = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, createdById: true, deletedAt: true },
  });
  if (!truoc || truoc.deletedAt) throw loi404('Không tìm thấy biên bản.');
  // Biên bản đã gửi đi là chứng từ — không sửa nội dung nữa.
  if (!TRANG_THAI_CHUA_GUI.has(truoc.status)) {
    throw loi409('Biên bản đã gửi bên nhận nên không sửa được nữa.');
  }
  const sau = await prisma.$transaction(async (tx) => {
    const trangThaiHienTai = await khoaBienBanChuaGui(tx, id);
    // Bản TỰ LẬP mà có người sửa thì đổi trạng thái — nhìn danh sách là biết tờ
    // nào giữ nguyên nội dung máy điền, tờ nào đã có người chỉnh.
    const trangThaiSau = (trangThaiHienTai === 'TU_LAP' ? 'DA_CHINH_SUA' : trangThaiHienTai) as HandoverStatus;
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
        status: trangThaiSau,
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
        beforeValue: { status: trangThaiHienTai },
        afterValue: { code: truoc.code, status: trangThaiSau },
        ...ctx,
      },
      tx,
    );
    return sau;
  });

  // Sửa xong thì dựng lại file Word ngay, để bản mềm lưu trong mục Biên bản
  // luôn khớp nội dung đang hiện. Lỗi sinh file không làm hỏng việc sửa.
  try {
    return await sinhFile(id, actor, ctx);
  } catch (loi) {
    log.warn('Sửa biên bản xong nhưng chưa dựng lại được file Word', { id, ...moTaLoi(loi) });
    return sau;
  }
}

/**
 * (Cách CŨ, giữ cho tương thích) Đưa biên bản sang "chờ xác nhận". Giao diện không
 * còn nút này — Quản trị / Vận hành xác nhận thẳng, bên nhận không xác nhận nữa.
 */
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
      request: { select: { id: true, code: true, status: true } },
    },
  });
  if (!truoc) throw loi404('Không tìm thấy biên bản.');
  if (!TRANG_THAI_CHUA_GUI.has(truoc.status)) {
    throw loi409('Biên bản này đã gửi bên nhận rồi.');
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
    await khoaBienBanChuaGui(tx, id);
    if (truoc.request) {
      const yc = await tx.request.findUnique({
        where: { id: truoc.request.id },
        select: { status: true },
      });
      if (yc?.status !== 'DA_XUAT' && yc?.status !== 'DA_HOAN_TAT') {
        throw loi409('Phiếu của biên bản này vừa đổi trạng thái — tải lại trang.', { maLoi: 'DA_XU_LY' });
      }
    }
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
        beforeValue: { status: truoc.status },
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
 * NGƯỜI XÁC NHẬN BÀN GIAO: Quản trị hệ thống và Vận hành thiết bị.
 *
 * Trước đây bên nhận (tài khoản trường) phải tự bấm xác nhận biên bản thì hàng
 * mới được tính là đã về. Nhiều nơi nhận không có tài khoản (kho đối tác, điểm
 * ngoài), hoặc có mà không ai bấm — phiếu nằm "Chờ bên nhận xác nhận" mãi, số ở
 * trường không bao giờ cộng. Chủ doanh nghiệp yêu cầu bỏ bước đó: quản trị /
 * vận hành làm TRUNG GIAN, xác nhận ngay ở trang yêu cầu, số lượng đổi luôn.
 */
const VAI_TRO_XAC_NHAN: ReadonlySet<string> = new Set(['ADMIN', 'VAN_HANH']);

function batBuocNguoiXacNhan(nguoiDung: NguoiDungDaXacThuc): void {
  if (!VAI_TRO_XAC_NHAN.has(nguoiDung.role)) {
    throw loi403(
      'Chỉ Quản trị hệ thống hoặc Vận hành thiết bị mới xác nhận / huỷ bàn giao. Bên nhận không cần bấm gì.',
    );
  }
}

const LOAI_LUONG_C: ReadonlySet<string> = new Set(['PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG']);
/** Biên bản còn "mở" — chưa xác nhận, chưa bị huỷ. */
const TRANG_THAI_BBBG_MO: ReadonlySet<string> = new Set([...TRANG_THAI_CHUA_GUI, 'CHO_XAC_NHAN']);
const DS_BBBG_MO = [...TRANG_THAI_BBBG_MO] as HandoverStatus[];
const DS_BBBG_CHUA_GUI = [...TRANG_THAI_CHUA_GUI] as HandoverStatus[];

/**
 * XÁC NHẬN BÀN GIAO — một chỗ duy nhất cho cả trang biên bản lẫn trang yêu cầu.
 *
 *   - Phân bổ về trường / luân chuyển trường (phiếu "Đã xuất"): ghi bút toán từ
 *     nơi gửi sang nơi nhận đúng số thực xuất, phiếu → Đã hoàn tất, biên bản →
 *     Đã xác nhận. Tổng quan đổi số ngay (phát KHO_DOI).
 *   - Loại khác: hàng đã đổi chỗ lúc xuất / nhập kho, chỉ còn biên bản cũ kẹt ở
 *     "Chờ bên nhận xác nhận" — đóng biên bản, không ghi thêm bút toán nào.
 *
 * Khoá dòng phiếu và dòng biên bản rồi đọc lại trạng thái: hai người bấm cùng
 * lúc không ghi hai lần bút toán.
 */
async function xacNhanBanGiao(
  chon: { bbbgId: string } | { requestId: string },
  ghiChu: string | undefined,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<{ bbbgId: string | null; requestId: string | null }> {
  batBuocNguoiXacNhan(nguoiDung);

  let bbbg: { id: string; code: string; status: string; receiverLocationId: string | null; requestId: string | null } | null = null;
  let requestId: string | null;
  if ('bbbgId' in chon) {
    bbbg = await prisma.handoverNote.findFirst({
      where: { id: chon.bbbgId, deletedAt: null },
      select: { id: true, code: true, status: true, receiverLocationId: true, requestId: true },
    });
    if (!bbbg) throw loi404('Không tìm thấy biên bản.');
    requestId = bbbg.requestId;
  } else {
    requestId = chon.requestId;
    bbbg = await prisma.handoverNote.findFirst({
      where: { requestId, deletedAt: null, status: { in: DS_BBBG_MO } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, status: true, receiverLocationId: true, requestId: true },
    });
  }

  const yc = requestId
    ? await prisma.request.findFirst({
        where: { id: requestId, deletedAt: null },
        select: {
          id: true,
          code: true,
          type: true,
          status: true,
          toLocationId: true,
          fromLocationId: true,
          expectedReturnAt: true,
          createdById: true,
        },
      })
    : null;
  if ('requestId' in chon && !yc) throw loi404('Không tìm thấy yêu cầu.');

  /*
   * Phiếu luồng C đã hoàn tất mà vẫn còn biên bản "chờ xác nhận" (biên bản cũ,
   * hoặc khôi phục từ thùng rác): hàng đã được ghi — chỉ đóng biên bản, KHÔNG ghi
   * bút toán lần nữa.
   */
  const chiDongBienBan =
    Boolean(yc && LOAI_LUONG_C.has(yc.type) && yc.status === 'DA_HOAN_TAT') &&
    bbbg?.status === 'CHO_XAC_NHAN';
  const laLuongC = Boolean(yc && LOAI_LUONG_C.has(yc.type)) && !chiDongBienBan;
  if (laLuongC) {
    if (yc?.status === 'DA_HOAN_TAT') {
      throw loi409(`Phiếu ${yc.code} đã được xác nhận bàn giao rồi.`, { maLoi: 'DA_XAC_NHAN' });
    }
    if (yc?.status !== 'DA_XUAT') {
      throw loi409(
        `Phiếu ${yc?.code ?? ''} chưa xuất kho (hoặc đã huỷ) nên chưa có gì để xác nhận bàn giao.`,
        { maLoi: 'CHUA_XUAT_KHO' },
      );
    }
    if (bbbg && !TRANG_THAI_BBBG_MO.has(bbbg.status)) {
      throw loi409(`Biên bản ${bbbg.code} đã đóng — không xác nhận thêm.`, { maLoi: 'BIEN_BAN_DA_DONG' });
    }
  } else if (!bbbg || bbbg.status !== 'CHO_XAC_NHAN') {
    throw loi409(
      'Không có gì cần xác nhận: loại phiếu này đã đổi số lượng ngay lúc xuất / nhập kho.',
      { maLoi: 'KHONG_CAN_XAC_NHAN' },
    );
  }

  // Nơi nhận: điểm đến trên PHIẾU (trường nhận) — biên bản chỉ là bản in của nó.
  const noiNhan = yc?.toLocationId ?? bbbg?.receiverLocationId ?? null;
  if (laLuongC && !noiNhan) {
    throw loi422(
      'Phiếu chưa có điểm nhận trong danh mục nên không xác định được thiết bị chuyển về đâu.',
      'THIEU_DIEM_NHAN',
    );
  }
  const bayGio = new Date();
  const maBB = bbbg?.code ?? null;

  await prisma.$transaction(async (tx) => {
    if (yc) {
      const khoaYc = await tx.$queryRaw<Array<{ status: string; deleted_at: Date | null }>>(
        Prisma.sql`SELECT status, deleted_at FROM requests WHERE id = ${yc.id} FOR UPDATE`,
      );
      if (laLuongC && (khoaYc[0]?.status !== 'DA_XUAT' || khoaYc[0]?.deleted_at)) {
        throw loi409('Phiếu này vừa được xử lý xong — không xác nhận thêm lần nữa.', {
          maLoi: 'DA_XU_LY',
        });
      }
    }
    if (bbbg) {
      const khoaBb = await tx.$queryRaw<Array<{ status: string; deleted_at: Date | null }>>(
        Prisma.sql`SELECT status, deleted_at FROM handover_notes WHERE id = ${bbbg.id} FOR UPDATE`,
      );
      if (!TRANG_THAI_BBBG_MO.has(khoaBb[0]?.status ?? '') || khoaBb[0]?.deleted_at) {
        throw loi409('Biên bản này vừa được xử lý xong — không xác nhận thêm lần nữa.', {
          maLoi: 'DA_XU_LY',
        });
      }
    }

    if (laLuongC && yc) {
      const dong = await tx.requestItem.findMany({
        where: { requestId: yc.id },
        select: {
          quantity: true,
          issuedQuantity: true,
          asset: {
            select: { id: true, code: true, trackingType: true, currentLocationId: true, condition: true },
          },
        },
      });
      for (const m of dong) {
        /*
         * TRỪ ĐÚNG NƠI ĐI, ĐÚNG SỐ THỰC MANG RA: nơi đi đã ghi lúc xuất, số lượng
         * là số kho thực mang ra (không phải số xin trên phiếu).
         */
        const tuDau = yc.fromLocationId ?? m.asset.currentLocationId;
        const soLuong = m.issuedQuantity ?? m.quantity;
        if (soLuong <= 0) continue;
        if (tuDau) {
          // Tồn ở nơi đi phải còn đủ cho lô này sau khi chừa các lô khác đang
          // trên đường từ cùng nơi đó (chính lô này cũng nằm trong số đang đi).
          const ton = await tonTaiDiaDiem(m.asset.id, tuDau, tx);
          const dangDi = ((await hangDangTrenDuong([m.asset.id], tx)).get(m.asset.id) ?? [])
            .filter((x) => x.locationId === tuDau)
            .reduce((a, x) => a + x.soLuong, 0);
          const loKhac = dangDi - soLuong;
          if (ton - loKhac < soLuong) {
            throw loi422(
              `Thiết bị ${m.asset.code}: nơi gửi chỉ còn ${Math.max(0, ton - loKhac)} nhưng phiếu bàn giao ${soLuong}. Kiểm lại với kho trước khi xác nhận.`,
              'KHONG_DU_TON',
              { ma: m.asset.code },
            );
          }
        }

        const movement = await tx.movement.create({
          data: {
            assetId: m.asset.id,
            type: yc.type === 'LUAN_CHUYEN_TRUONG' ? 'LUAN_CHUYEN' : 'PHAN_BO',
            fromLocationId: tuDau,
            toLocationId: noiNhan,
            requestId: yc.id,
            quantity: soLuong,
            conditionBefore: m.asset.condition,
            conditionAfter: m.asset.condition,
            performedById: nguoiDung.id,
            performedAt: bayGio,
            note: `Quản lý xác nhận bàn giao phiếu ${yc.code}${maBB ? ` (biên bản ${maBB})` : ''}.`,
          },
          select: { id: true },
        });

        /*
         * Chỉ dời vị trí khi nơi gửi đã HẾT món này. Dời cả dòng hàng lẻ sang
         * trường sau một lần giao một phần là lỗi gốc khiến các lần xuất sau
         * trừ vào trường thay vì trừ kho.
         */
        const conONoiDi =
          m.asset.trackingType === 'DON_VI' || !tuDau ? 0 : await tonTaiDiaDiem(m.asset.id, tuDau, tx);
        const doiViTri = conONoiDi <= 0;
        await tx.asset.update({
          where: { id: m.asset.id },
          data: {
            ...(doiViTri ? { currentLocationId: noiNhan, allocationStatus: 'DA_PHAN_BO' } : {}),
            ...(yc.expectedReturnAt ? { dueReturnAt: yc.expectedReturnAt } : {}),
          },
        });

        await ghiAudit(
          {
            actor: nguoiDung,
            action: 'asset.xac_nhan_ban_giao',
            entityType: 'asset',
            entityId: m.asset.id,
            beforeValue: { currentLocationId: m.asset.currentLocationId },
            afterValue: {
              tuDau,
              currentLocationId: doiViTri ? noiNhan : m.asset.currentLocationId,
              ...(doiViTri ? { allocationStatus: 'DA_PHAN_BO' } : {}),
              soLuong,
              movementId: movement.id,
            },
            note: `Quản lý xác nhận bàn giao phiếu ${yc.code} — mã ${m.asset.code}.`,
            ...ctx,
          },
          tx,
        );
      }

      await tx.request.update({
        where: { id: yc.id },
        data: {
          status: 'DA_HOAN_TAT',
          completedAt: bayGio,
          // Ghi người xác nhận vào ô "người duyệt" của phiếu — trang chi tiết
          // hiện ra ai đã chốt bàn giao.
          approvedById: nguoiDung.id,
          approvedAt: bayGio,
        },
      });
      await ghiAudit(
        {
          actor: nguoiDung,
          action: 'request.confirm_handover',
          entityType: 'request',
          entityId: yc.id,
          beforeValue: { status: 'DA_XUAT' },
          afterValue: { status: 'DA_HOAN_TAT', noiNhan, soDong: dong.length },
          note: ghiChu ?? null,
          ...ctx,
        },
        tx,
      );
    }

    if (bbbg) {
      await tx.handoverNote.update({
        where: { id: bbbg.id },
        data: { status: 'DA_XAC_NHAN', confirmedById: nguoiDung.id, confirmedAt: bayGio },
      });
      await ghiAudit(
        {
          actor: nguoiDung,
          action: 'handover.confirm',
          entityType: 'handover_note',
          entityId: bbbg.id,
          beforeValue: { status: bbbg.status },
          afterValue: { status: 'DA_XAC_NHAN', doiViTri: laLuongC },
          note: ghiChu ?? 'Quản lý xác nhận thay bên nhận.',
          ...ctx,
        },
        tx,
      );
    }
  });

  // Phiếu chưa có biên bản (lập tự động lỗi, hoặc ai đó xoá) — lập ngay rồi đánh
  // dấu đã xác nhận, để giấy tờ khớp với sổ.
  let bbbgId = bbbg?.id ?? null;
  if (laLuongC && yc && !bbbg) {
    await lapBBBGTuDong(yc.id, nguoiDung, ctx);
    const moi = await prisma.handoverNote.findFirst({
      where: { requestId: yc.id, deletedAt: null, status: { in: DS_BBBG_CHUA_GUI } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (moi) {
      await prisma.handoverNote.update({
        where: { id: moi.id },
        data: { status: 'DA_XAC_NHAN', confirmedById: nguoiDung.id, confirmedAt: bayGio },
      });
      bbbgId = moi.id;
    }
  }

  const thongDiep = yc
    ? `Phiếu ${yc.code} đã được xác nhận bàn giao.`
    : `Biên bản ${maBB ?? ''} đã được xác nhận.`;
  phatChoNguoiDuyet(SU_KIEN.YEU_CAU_DOI, { id: yc?.id ?? bbbgId ?? '', thongDiep });
  if (yc) {
    phatChoNguoiDung(yc.createdById, SU_KIEN.YEU_CAU_DOI, { id: yc.id, code: yc.code, thongDiep });
  }
  if (laLuongC && noiNhan) phatChoDiaDiem(noiNhan, SU_KIEN.YEU_CAU_DOI, { id: yc?.id ?? '', thongDiep });
  phatChoTatCa(SU_KIEN.KHO_DOI, { thongDiep: 'Tồn kho vừa thay đổi.' });
  return { bbbgId, requestId: yc?.id ?? null };
}

/** Xác nhận từ trang BIÊN BẢN. */
export async function xacNhan(
  id: string,
  ghiChu: string | undefined,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  await xacNhanBanGiao({ bbbgId: id }, ghiChu, nguoiDung, ctx);
  const sau = await prisma.handoverNote.findUnique({ where: { id }, select: CHON_BBBG });
  if (!sau) throw loi404('Không tìm thấy biên bản.');
  return sau;
}

/** Xác nhận từ trang YÊU CẦU — đường chính của quản trị / vận hành. */
export async function xacNhanTheoYeuCau(
  requestId: string,
  ghiChu: string | undefined,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<void> {
  await xacNhanBanGiao({ requestId }, ghiChu, nguoiDung, ctx);
}

export async function tuChoi(
  id: string,
  rejectionNote: string,
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
      createdById: true,
      deletedAt: true,
      request: { select: { id: true, code: true, type: true, status: true, deletedAt: true } },
    },
  });
  // Biên bản trong thùng rác không được dùng để huỷ một phiếu đang sống.
  if (!bbbg || bbbg.deletedAt) throw loi404('Không tìm thấy biên bản.');
  // Không còn bên nhận xác nhận / từ chối: quản trị / vận hành là trung gian.
  batBuocNguoiXacNhan(nguoiDung);
  /*
   * Chỉ huỷ được khi hàng ĐANG TRÊN ĐƯỜNG (phân bổ / luân chuyển đã xuất, chưa
   * xác nhận) — huỷ là hàng tính lại ở nơi gửi. Phiếu đã ghi xong tồn kho (xuất
   * kho thường, cho mượn, đã hoàn tất…) thì huỷ biên bản không đổi được gì: dùng
   * "Xác nhận" để đóng biên bản cũ, muốn đưa hàng về thì lập phiếu nhập kho.
   */
  const dangTrenDuong =
    TRANG_THAI_BBBG_MO.has(bbbg.status) &&
    bbbg.request?.status === 'DA_XUAT' &&
    !bbbg.request.deletedAt &&
    LOAI_LUONG_C.has(bbbg.request.type);
  const bienBanLe = !bbbg.request && bbbg.status === 'CHO_XAC_NHAN';
  if (!dangTrenDuong && !bienBanLe) {
    throw loi409(
      'Chỉ huỷ được bàn giao đang trên đường (phân bổ / luân chuyển chưa xác nhận). Biên bản của phiếu đã ghi xong tồn kho thì bấm "Xác nhận" để đóng.',
      { maLoi: 'KHONG_HUY_DUOC' },
    );
  }

  const sau = await prisma.$transaction(async (tx) => {
    // Khoá PHIẾU trước rồi mới tới BIÊN BẢN — cùng thứ tự với xác nhận bàn giao,
    // để xác nhận và huỷ bấm cùng lúc không khoá chéo nhau.
    if (bbbg.request) {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM requests WHERE id = ${bbbg.request.id} FOR UPDATE`);
    }
    const khoa = await tx.$queryRaw<Array<{ status: string; deleted_at: Date | null }>>(
      Prisma.sql`SELECT status, deleted_at FROM handover_notes WHERE id = ${id} FOR UPDATE`,
    );
    if (khoa[0]?.status !== bbbg.status || khoa[0]?.deleted_at) {
      throw loi409('Biên bản này vừa được xử lý xong.', { maLoi: 'DA_XU_LY' });
    }
    const capNhat = await tx.handoverNote.update({
      where: { id },
      data: { status: 'TU_CHOI', rejectionNote, confirmedById: nguoiDung.id, confirmedAt: new Date() },
      select: CHON_BBBG,
    });
    /*
     * HUỶ BÀN GIAO phân bổ / luân chuyển: hàng chưa từng được ghi rời nơi gửi
     * (chỉ ghi lúc xác nhận), nên huỷ phiếu là đủ để số "đang chuyển" trả về
     * nơi gửi. Không huỷ thì phiếu kẹt ở "Đã xuất" mãi, hàng bị tính là đang
     * trên đường không bao giờ tới.
     */
    const yc = bbbg.request;
    if (yc && !yc.deletedAt && yc.status === 'DA_XUAT') {
      const huy = await tx.request.updateMany({
        where: { id: yc.id, status: 'DA_XUAT' },
        data: {
          status: 'TU_CHOI',
          rejectionNote: `Huỷ bàn giao (biên bản ${capNhat.code}): ${rejectionNote}`.slice(0, 2000),
        },
      });
      if (huy.count === 1) {
        await traTrangThaiSauHuyBanGiao(tx, yc.id);
        await ghiAudit(
          {
            actor: nguoiDung,
            action: 'request.cancel_by_handover_reject',
            entityType: 'request',
            entityId: yc.id,
            beforeValue: { status: 'DA_XUAT' },
            afterValue: { status: 'TU_CHOI' },
            note: `Huỷ bàn giao theo biên bản ${capNhat.code} — hàng tính lại ở nơi gửi.`,
            ...ctx,
          },
          tx,
        );
      }
    }
    await tx.alert.create({
      data: {
        type: 'CHENH_LECH_KIEM_KE',
        severity: 'TRUNG_BINH',
        title: `Huỷ bàn giao biên bản ${capNhat.code}`.slice(0, 191),
        message: `${nguoiDung.email} huỷ bàn giao tới ${capNhat.receiverOrg}: ${rejectionNote}`,
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
        beforeValue: { status: bbbg.status },
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
    thongDiep: `Biên bản ${sau.code} đã bị huỷ bàn giao.`,
  });
  // Phiếu vừa tự huỷ thì số "đang chuyển" đổi — các trang tổng quan nạp lại.
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  phatChoNguoiDung(bbbg.createdById, SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: `Biên bản ${sau.code} bị từ chối.`,
  });
  return sau;
}

// ===========================================================================
// XOÁ MỀM — CHỈ ADMIN
// ===========================================================================

/**
 * Xoá mềm một biên bản.
 *
 * XOÁ BIÊN BẢN KHÔNG HOÀN TÁC VIỆC BÀN GIAO. Với loại phân bổ / luân chuyển,
 * chính cú bấm xác nhận của bên nhận đã ghi bút toán di chuyển và đổi vị trí
 * thiết bị (luồng C). Xoá tờ biên bản đi thì thiết bị vẫn ở chỗ mới, tồn kho
 * vẫn như đã ghi — vì tồn suy từ `movements` chứ không từ biên bản.
 *
 * Muốn đưa thiết bị về chỗ cũ thì phải lập yêu cầu trả về kho, không phải xoá
 * chứng từ. Hàm này cố ý KHÔNG đụng vào movements; chỗ gọi phải nói rõ điều đó
 * với người bấm nút.
 */
export async function xoaMem(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy biên bản.');
  if (truoc.deletedAt) throw loi409('Biên bản này đã nằm trong thùng rác.');

  await prisma.$transaction(async (tx) => {
    await tx.handoverNote.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actor.id },
    });
    await ghiAudit(
      {
        actor,
        action: 'handover.soft_delete',
        entityType: 'handover_note',
        entityId: id,
        beforeValue: { code: truoc.code, status: truoc.status },
        note:
          truoc.status === 'DA_XAC_NHAN'
            ? 'Xoá mềm biên bản ĐÃ XÁC NHẬN; vị trí thiết bị và tồn kho giữ nguyên.'
            : 'Xoá mềm.',
        ...ctx,
      },
      tx,
    );
  });
}

export async function khoiPhuc(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<BBBGDayDu> {
  const truoc = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy biên bản.');
  if (!truoc.deletedAt) throw loi409('Biên bản này không nằm trong thùng rác.');

  return prisma.$transaction(async (tx) => {
    const sau = await tx.handoverNote.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
      select: CHON_BBBG,
    });
    await ghiAudit(
      {
        actor,
        action: 'handover.restore',
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

/** Danh sách biên bản trong thùng rác (ADMIN). */
export async function thungRac(loc: {
  trang: number;
  moiTrang: number;
}): Promise<{ muc: BBBGDayDu[]; tong: number; trang: number; moiTrang: number }> {
  const dieuKien: Prisma.HandoverNoteWhereInput = { deletedAt: { not: null } };
  const [muc, tong] = await Promise.all([
    prisma.handoverNote.findMany({
      where: dieuKien,
      select: CHON_BBBG,
      orderBy: { deletedAt: 'desc' },
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.handoverNote.count({ where: dieuKien }),
  ]);
  return { muc, tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

/** XOÁ HẲN khỏi CSDL, kèm xoá file mềm .docx trên ổ đĩa. */
export async function xoaVinhVien(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, deletedAt: true, filePath: true },
  });
  if (!truoc) throw loi404('Không tìm thấy biên bản.');
  if (!truoc.deletedAt) {
    throw loi409('Chỉ xoá hẳn được biên bản đang nằm trong thùng rác. Hãy xoá mềm trước.');
  }

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'handover.purge',
        entityType: 'handover_note',
        entityId: id,
        beforeValue: { code: truoc.code, status: truoc.status },
        note: 'Xoá hẳn khỏi CSDL; bút toán di chuyển và vị trí thiết bị giữ nguyên.',
        ...ctx,
      },
      tx,
    );
    // Các dòng thiết bị của biên bản khai ON DELETE CASCADE nên tự đi theo.
    await tx.handoverNote.delete({ where: { id } });
  });

  // Xoá file sau khi bản ghi đã biến mất — làm ngược lại thì lỗi xoá bản ghi sẽ
  // để lại một biên bản trỏ vào file không còn tồn tại.
  if (truoc.filePath) await xoaFileTaiLieu(truoc.filePath);
}

/** Tra số biên bản của cả lô một lượt — để báo lỗi gọi tên, không đọc id. */
async function soCuaLo(ids: readonly string[]): Promise<Map<string, string>> {
  const hang = await prisma.handoverNote.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, code: true },
  });
  return new Map(hang.map((h) => [h.id, h.code]));
}

/** Xoá mềm NHIỀU biên bản đã chọn (ADMIN). */
export async function xoaMemNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoatChung> {
  return chayTungCai(ids, soCuaLo, (id) => xoaMem(id, actor, ctx));
}

export async function khoiPhucNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoatChung> {
  return chayTungCai(ids, soCuaLo, (id) => khoiPhuc(id, actor, ctx));
}

export async function xoaVinhVienNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoatChung> {
  return chayTungCai(ids, soCuaLo, (id) => xoaVinhVien(id, actor, ctx));
}
