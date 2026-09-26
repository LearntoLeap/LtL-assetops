/**
 * NGHIỆP VỤ YÊU CẦU — trái tim của hệ thống.
 *
 * Ba chốt chặn không ai đi vòng được, vì đều nằm ở service phía server:
 *   1. Thiết bị chỉ rời kho khi yêu cầu ở trạng thái ĐÃ DUYỆT (nguyên tắc #2).
 *   2. Hoàn tất xuất/nhập kho BẮT BUỘC có ảnh chụp thực tế (nguyên tắc #3).
 *   3. Mã quét được phải KHỚP mã thiết bị trong yêu cầu — chặn cầm nhầm thiết bị.
 *
 * Mọi lần đổi vị trí/tình trạng đều ghi movement + audit trong CÙNG transaction
 * với việc cập nhật hình chiếu trạng thái trên bảng assets, nên tồn kho suy ra
 * từ movements không bao giờ lệch với trạng thái hiển thị.
 */
import type { AssetCondition, Prisma, RequestType } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { loi400, loi403, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { dieuKienYeuCau, phamViCua } from '../../lib/pham-vi.js';
import { tonTaiDiaDiem } from '../../lib/ton-kho.js';
import {
  phatChoDiaDiem,
  phatChoKho,
  phatChoNguoiDung,
  phatChoNguoiDuyet,
  phatChoTatCa,
  SU_KIEN,
} from '../../realtime.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type {
  DuLieuLocYeuCau,
  DuLieuNhapKho,
  DuLieuSuaYeuCau,
  DuLieuTaoYeuCau,
  DuLieuXuatKho,
} from './yeu-cau.schema.js';
import { lapBBBGTuDong } from '../bbbg/bbbg.service.js';
import { chayTungCai, type KetQuaHangLoatChung } from '../../lib/hang-loat.js';

const CHON_YEU_CAU = {
  id: true,
  code: true,
  type: true,
  status: true,
  reason: true,
  destinationNote: true,
  expectedReturnAt: true,
  submittedAt: true,
  approvedAt: true,
  rejectionNote: true,
  issuedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true, email: true, role: true, department: true } },
  approvedBy: { select: { id: true, fullName: true } },
  fromLocation: { select: { id: true, code: true, name: true, type: true } },
  toLocation: { select: { id: true, code: true, name: true, type: true } },
  deletedAt: true,
  deletedBy: { select: { id: true, fullName: true } },
  /**
   * BIÊN BẢN ĐÃ LẬP cho phiếu này — để giao diện dẫn thẳng sang, khỏi phải sang
   * mục Biên bản dò lại theo số phiếu. Bỏ biên bản bị từ chối và biên bản đã
   * xoá: dẫn tới một tờ giấy không còn hiệu lực thì tệ hơn là không dẫn.
   */
  handoverNotes: {
    where: { deletedAt: null, status: { not: 'TU_CHOI' } },
    select: { id: true, code: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  items: {
    select: {
      id: true,
      quantity: true,
      note: true,
      asset: {
        select: {
          id: true,
          code: true,
          name: true,
          trackingType: true,
          condition: true,
          allocationStatus: true,
          currentLocation: { select: { id: true, name: true } },
          // `yeuCauQuetMa` quyết định dòng này phải quét mã hay khai tên + số lượng.
          category: { select: { id: true, name: true, yeuCauQuetMa: true } },
        },
      },
    },
  },
} satisfies Prisma.RequestSelect;

export type YeuCauDayDu = Prisma.RequestGetPayload<{ select: typeof CHON_YEU_CAU }>;

/** Loại yêu cầu đưa thiết bị RỜI kho. */
const LOAI_XUAT: ReadonlySet<RequestType> = new Set<RequestType>([
  'XUAT_KHO',
  'PHAN_BO_VE_TRUONG',
  'LUAN_CHUYEN_TRUONG',
  'CHO_MUON',
]);

/** Loại yêu cầu đưa thiết bị VỀ kho. */
const LOAI_NHAP: ReadonlySet<RequestType> = new Set<RequestType>(['NHAP_KHO', 'TRA_VE_KHO']);

/**
 * Loại phải chờ bên nhận XÁC NHẬN mới đổi vị trí sở hữu (luồng C).
 * Lúc xuất chỉ đánh dấu "Đang vận chuyển"; movement ghi khi bên nhận xác nhận
 * cùng biên bản bàn giao ở giai đoạn 5.
 */
const LOAI_CHO_XAC_NHAN: ReadonlySet<RequestType> = new Set<RequestType>([
  'PHAN_BO_VE_TRUONG',
  'LUAN_CHUYEN_TRUONG',
]);

export function laLoaiXuat(type: RequestType): boolean {
  return LOAI_XUAT.has(type);
}
export function laLoaiNhap(type: RequestType): boolean {
  return LOAI_NHAP.has(type);
}
export function choBenNhanXacNhan(type: RequestType): boolean {
  return LOAI_CHO_XAC_NHAN.has(type);
}

// ============================================================ đọc

export async function danhSach(
  nguoiDung: NguoiDungDaXacThuc,
  loc: DuLieuLocYeuCau,
): Promise<{ muc: YeuCauDayDu[]; tong: number; trang: number; moiTrang: number }> {
  // AND chứ KHÔNG spread. dieuKienYeuCau trả về { OR: [...] } cho vai trò
  // TRUONG, và điều kiện tìm kiếm bên dưới cũng dùng `OR` — spread thì OR của
  // tìm kiếm GHI ĐÈ OR của phạm vi, tức chỉ cần gõ một từ khoá là điểm trường
  // thấy yêu cầu của mọi trường. Đo thật trước khi sửa: trường thấy 6 phiếu
  // khi có từ khoá (bằng admin) so với 2 phiếu khi không có.
  const dieuKien: Prisma.RequestWhereInput = {
    AND: [
      dieuKienYeuCau(nguoiDung),
      ...(loc.tuKhoa
        ? [
            {
              OR: [
                { code: { contains: loc.tuKhoa } },
                { reason: { contains: loc.tuKhoa } },
                { items: { some: { asset: { code: { contains: loc.tuKhoa } } } } },
              ],
            },
          ]
        : []),
    ],
    ...(loc.type ? { type: loc.type } : {}),
    ...(loc.status ? { status: loc.status } : {}),
    ...(loc.cuaToi === 'true' ? { createdById: nguoiDung.id } : {}),
  };

  const [muc, tong] = await Promise.all([
    prisma.request.findMany({
      where: dieuKien,
      select: CHON_YEU_CAU,
      orderBy: { createdAt: 'desc' },
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.request.count({ where: dieuKien }),
  ]);
  return { muc, tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

export async function xemMot(nguoiDung: NguoiDungDaXacThuc, id: string): Promise<YeuCauDayDu> {
  const yeuCau = await prisma.request.findFirst({
    where: { id, ...dieuKienYeuCau(nguoiDung) },
    select: CHON_YEU_CAU,
  });
  if (!yeuCau) throw loi404('Không tìm thấy yêu cầu, hoặc yêu cầu ngoài phạm vi của bạn.');
  return yeuCau;
}

// ============================================================ tạo / sửa / gửi duyệt

/** Đổi danh sách MÃ thiết bị thành id, báo rõ mã nào không tồn tại hoặc trùng. */
async function doiMaThanhTaiSan(
  muc: DuLieuTaoYeuCau['muc'],
): Promise<Array<{ assetId: string; code: string; quantity: number; note: string | null }>> {
  const ma = muc.map((m) => m.code);
  const daGap = new Set<string>();
  for (const m of ma) {
    if (daGap.has(m)) throw loi400(`Mã ${m} xuất hiện nhiều lần trong cùng một yêu cầu.`, 'MA_TRUNG');
    daGap.add(m);
  }

  const taiSan = await prisma.asset.findMany({
    // Thiết bị đã xoá thì không lập yêu cầu cho nó được — coi như không tồn tại,
    // và thông điệp "không tìm thấy mã" bên dưới nói đúng điều đó.
    where: { code: { in: ma }, deletedAt: null },
    select: { id: true, code: true, isActive: true, trackingType: true },
  });
  const bang = new Map(taiSan.map((t) => [t.code, t]));

  const thieu = ma.filter((m) => !bang.has(m));
  if (thieu.length > 0) {
    throw loi400(`Không có thiết bị với mã: ${thieu.join(', ')}.`, 'MA_KHONG_TON_TAI', {
      ma: thieu,
    });
  }
  const ngung = taiSan.filter((t) => !t.isActive).map((t) => t.code);
  if (ngung.length > 0) {
    throw loi400(`Thiết bị đã ngừng theo dõi: ${ngung.join(', ')}.`, 'THIET_BI_NGUNG_THEO_DOI');
  }

  return muc.map((m) => {
    const t = bang.get(m.code);
    if (!t) throw loi400(`Không có thiết bị với mã ${m.code}.`, 'MA_KHONG_TON_TAI');
    if (t.trackingType === 'DON_VI' && m.quantity !== 1) {
      throw loi400(
        `Thiết bị ${m.code} quản lý theo từng đơn vị nên số lượng phải bằng 1.`,
        'SO_LUONG_SAI',
      );
    }
    return { assetId: t.id, code: m.code, quantity: m.quantity, note: m.note ?? null };
  });
}

export async function tao(
  duLieu: DuLieuTaoYeuCau,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const dong = await doiMaThanhTaiSan(duLieu.muc);

  const yeuCau = await prisma.$transaction(async (tx) => {
    const code = await capSoChungTu(tx, TIEN_TO.YEU_CAU);
    const taoMoi = await tx.request.create({
      data: {
        code,
        type: duLieu.type,
        status: 'BAN_NHAP',
        createdById: actor.id,
        reason: duLieu.reason,
        fromLocationId: duLieu.fromLocationId ?? null,
        toLocationId: duLieu.toLocationId ?? null,
        destinationNote: duLieu.destinationNote ?? null,
        expectedReturnAt: duLieu.expectedReturnAt ? new Date(duLieu.expectedReturnAt) : null,
        items: {
          create: dong.map((d) => ({ assetId: d.assetId, quantity: d.quantity, note: d.note })),
        },
      },
      select: CHON_YEU_CAU,
    });

    await ghiAudit(
      {
        actor,
        action: 'request.create',
        entityType: 'request',
        entityId: taoMoi.id,
        afterValue: { code, type: duLieu.type, soDong: dong.length, ma: dong.map((d) => d.code) },
        ...ctx,
      },
      tx,
    );
    return taoMoi;
  });

  return yeuCau;
}

/** Chỉ sửa được bản nháp, và chỉ người tạo (hoặc ADMIN) mới sửa. */
export async function sua(
  id: string,
  duLieu: DuLieuSuaYeuCau,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const truoc = await prisma.request.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, createdById: true },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  if (truoc.status !== 'BAN_NHAP') {
    throw loi409('Chỉ sửa được yêu cầu còn ở trạng thái Nháp.');
  }
  if (truoc.createdById !== actor.id && actor.role !== 'ADMIN') {
    throw loi403('Chỉ người tạo yêu cầu (hoặc quản trị viên) mới sửa được.');
  }

  const dong = duLieu.muc ? await doiMaThanhTaiSan(duLieu.muc) : null;

  return prisma.$transaction(async (tx) => {
    if (dong) {
      await tx.requestItem.deleteMany({ where: { requestId: id } });
      await tx.requestItem.createMany({
        data: dong.map((d) => ({
          requestId: id,
          assetId: d.assetId,
          quantity: d.quantity,
          note: d.note,
        })),
      });
    }
    const sau = await tx.request.update({
      where: { id },
      data: {
        ...(duLieu.reason === undefined ? {} : { reason: duLieu.reason }),
        ...(duLieu.fromLocationId === undefined ? {} : { fromLocationId: duLieu.fromLocationId }),
        ...(duLieu.toLocationId === undefined ? {} : { toLocationId: duLieu.toLocationId }),
        ...(duLieu.destinationNote === undefined
          ? {}
          : { destinationNote: duLieu.destinationNote }),
        ...(duLieu.expectedReturnAt === undefined
          ? {}
          : {
              expectedReturnAt: duLieu.expectedReturnAt
                ? new Date(duLieu.expectedReturnAt)
                : null,
            }),
      },
      select: CHON_YEU_CAU,
    });
    await ghiAudit(
      {
        actor,
        action: 'request.update',
        entityType: 'request',
        entityId: id,
        afterValue: { code: truoc.code, ...(dong ? { soDong: dong.length } : {}) },
        ...ctx,
      },
      tx,
    );
    return sau;
  });
}

export async function guiDuyet(
  id: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const truoc = await prisma.request.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      createdById: true,
      toLocationId: true,
      _count: { select: { items: true } },
    },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  if (truoc.status !== 'BAN_NHAP') {
    throw loi409(`Yêu cầu đang ở trạng thái khác Nháp nên không gửi duyệt lại được.`);
  }
  if (truoc.createdById !== actor.id && actor.role !== 'ADMIN') {
    throw loi403('Chỉ người tạo yêu cầu mới gửi duyệt được.');
  }
  if (truoc._count.items === 0) {
    throw loi422('Yêu cầu chưa có thiết bị nào.', 'YEU_CAU_RONG');
  }
  // Bắt thiếu nơi đến ngay lúc gửi duyệt, đừng để người duyệt bấm xong rồi kho
  // mới phát hiện không xuất được.
  kiemNoiDen(truoc.type, truoc.toLocationId);

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.request.update({
      where: { id },
      data: { status: 'CHO_DUYET', submittedAt: new Date() },
      select: CHON_YEU_CAU,
    });
    await ghiAudit(
      {
        actor,
        action: 'request.submit',
        entityType: 'request',
        entityId: id,
        beforeValue: { status: 'BAN_NHAP' },
        afterValue: { status: 'CHO_DUYET' },
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  phatChoNguoiDuyet(SU_KIEN.YEU_CAU_MOI, {
    id: sau.id,
    code: sau.code,
    type: sau.type,
    status: sau.status,
    thongDiep: `Yêu cầu ${sau.code} đang chờ duyệt.`,
  });
  return sau;
}

// ============================================================ duyệt / từ chối

/**
 * Loại yêu cầu bắt buộc phải có NƠI ĐẾN trong danh mục điểm lưu trữ.
 * Cho mượn nội bộ (người giữ là nhân sự) thì không cần, nên không nằm ở đây.
 */
const CAN_NOI_DEN: ReadonlySet<RequestType> = new Set<RequestType>([
  'XUAT_KHO',
  'PHAN_BO_VE_TRUONG',
  'LUAN_CHUYEN_TRUONG',
]);

function kiemNoiDen(type: RequestType, toLocationId: string | null): void {
  if (CAN_NOI_DEN.has(type) && !toLocationId) {
    throw loi422(
      'Loại yêu cầu này bắt buộc phải chọn nơi đến trong danh mục điểm lưu trữ.',
      'THIEU_NOI_DEN',
    );
  }
}

export async function duyet(
  id: string,
  ghiChu: string | undefined,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const truoc = await prisma.request.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      createdById: true,
      toLocationId: true,
    },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  if (truoc.status !== 'CHO_DUYET') {
    throw loi409('Chỉ duyệt được yêu cầu đang ở trạng thái Chờ duyệt.');
  }
  // Phân định trách nhiệm: không ai tự duyệt yêu cầu của chính mình.
  if (truoc.createdById === actor.id) {
    throw loi403(
      'Không được tự duyệt yêu cầu của chính mình. Nhờ một người có quyền duyệt khác xử lý.',
    );
  }
  kiemNoiDen(truoc.type, truoc.toLocationId);

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.request.update({
      where: { id },
      data: { status: 'DA_DUYET', approvedById: actor.id, approvedAt: new Date() },
      select: CHON_YEU_CAU,
    });
    await ghiAudit(
      {
        actor,
        action: 'request.approve',
        entityType: 'request',
        entityId: id,
        beforeValue: { status: 'CHO_DUYET' },
        afterValue: { status: 'DA_DUYET' },
        note: ghiChu ?? null,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  phatChoNguoiDung(truoc.createdById, SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: `Yêu cầu ${sau.code} đã được duyệt.`,
  });
  phatChoKho(SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    type: sau.type,
    status: sau.status,
    thongDiep: `Yêu cầu ${sau.code} đã duyệt, chờ xuất kho.`,
  });
  return sau;
}

export async function tuChoi(
  id: string,
  rejectionNote: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const truoc = await prisma.request.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, createdById: true },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  if (truoc.status !== 'CHO_DUYET') {
    throw loi409('Chỉ từ chối được yêu cầu đang ở trạng thái Chờ duyệt.');
  }
  if (truoc.createdById === actor.id) {
    throw loi403('Không được tự xử lý yêu cầu của chính mình.');
  }

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.request.update({
      where: { id },
      data: {
        status: 'TU_CHOI',
        approvedById: actor.id,
        approvedAt: new Date(),
        rejectionNote,
      },
      select: CHON_YEU_CAU,
    });
    await ghiAudit(
      {
        actor,
        action: 'request.reject',
        entityType: 'request',
        entityId: id,
        beforeValue: { status: 'CHO_DUYET' },
        afterValue: { status: 'TU_CHOI' },
        note: rejectionNote,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  phatChoNguoiDung(truoc.createdById, SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: `Yêu cầu ${sau.code} bị từ chối.`,
  });
  return sau;
}

// ============================================================ xuất / nhập kho

interface DongDaSoat {
  requestItemId: string;
  assetId: string;
  code: string;
  soLuong: number;
  anhIds: string[];
  /** Tên người ở kho tự khai — null với dòng phải quét mã. */
  tenDaKhai: string | null;
  ghiChu: string | null;
  currentLocationId: string | null;
  condition: AssetCondition;
}

/**
 * Soát chung cho cả xuất và nhập kho:
 *   - yêu cầu phải ở đúng trạng thái;
 *   - mọi dòng thiết bị trong yêu cầu đều phải được xử lý, không thừa không thiếu;
 *   - MÃ QUÉT phải khớp mã thiết bị;
 *   - ẢNH phải có thật, đúng loại, và chưa gắn vào lần xuất/nhập nào khác.
 */
async function soatDongThucHien(
  yeuCau: YeuCauDayDu,
  muc: ReadonlyArray<{
    assetId: string;
    maDaQuet?: string | undefined;
    tenDaKhai?: string | undefined;
    anhIds: string[];
    quantity?: number | undefined;
    ghiChu?: string | null | undefined;
  }>,
  loaiAnh: 'ANH_XUAT' | 'ANH_NHAN',
): Promise<DongDaSoat[]> {
  const theoAsset = new Map(yeuCau.items.map((i) => [i.asset.id, i]));
  // Thông điệp phải nói đúng chiều: lúc nhận hàng về mà báo "mang ra" thì người
  // đọc tưởng mình đang ở sai màn hình.
  const chieu = loaiAnh === 'ANH_XUAT' ? 'mang ra' : 'nhận về';

  const thua = muc.filter((m) => !theoAsset.has(m.assetId)).map((m) => m.assetId);
  if (thua.length > 0) {
    throw loi422(
      'Có dòng thiết bị không thuộc yêu cầu này.',
      'DONG_KHONG_THUOC_YEU_CAU',
      { assetId: thua },
    );
  }
  const daXuLy = new Set(muc.map((m) => m.assetId));
  const thieu = yeuCau.items.filter((i) => !daXuLy.has(i.asset.id)).map((i) => i.asset.code);
  if (thieu.length > 0) {
    throw loi422(
      `Còn ${thieu.length} thiết bị trong yêu cầu chưa được xử lý: ${thieu.join(', ')}.`,
      'CHUA_XU_LY_HET',
      { ma: thieu },
    );
  }

  // --- Nhận dạng thiết bị: QUÉT MÃ hoặc KHAI TÊN + SỐ LƯỢNG, tuỳ loại tài sản
  //
  // Chỉ loại bật `yeuCauQuetMa` (robot) mới đòi quét đúng mã — đó là loại có nhãn
  // dán trên từng cái. Thùng 200 quyển vở hay túi phụ kiện thì không có nhãn nào
  // để quét, nên thay bằng khai TÊN thiết bị mang ra và SỐ LƯỢNG; ảnh vẫn bắt
  // buộc ở cả hai chiều (kiểm ngay bên dưới) nên vẫn có bằng chứng để đối chiếu.
  const lechMa: Array<{ maDaQuet: string; maDung: string }> = [];
  const thieuKhai: string[] = [];
  const thieuSoLuong: string[] = [];
  for (const m of muc) {
    const dong = theoAsset.get(m.assetId);
    if (!dong) continue;
    if (dong.asset.category.yeuCauQuetMa) {
      const quet = (m.maDaQuet ?? '').trim().toUpperCase();
      if (quet !== dong.asset.code) {
        lechMa.push({ maDaQuet: quet || '(chưa quét)', maDung: dong.asset.code });
      }
    } else {
      if ((m.tenDaKhai ?? '').trim().length < 2) thieuKhai.push(dong.asset.code);
      // Loại không quét mã thì SỐ LƯỢNG phải khai rõ, không lấy ngầm theo yêu cầu:
      // người ở kho phải tự xác nhận đã mang ra đúng bao nhiêu cái.
      if (m.quantity === undefined) thieuSoLuong.push(dong.asset.code);
    }
  }
  if (lechMa.length > 0) {
    throw loi422(
      `Mã quét được không khớp thiết bị trong yêu cầu: ${lechMa
        .map((l) => `quét "${l.maDaQuet}" nhưng yêu cầu là "${l.maDung}"`)
        .join('; ')}.`,
      'MA_KHONG_KHOP',
      { lech: lechMa },
    );
  }
  if (thieuKhai.length > 0) {
    throw loi422(
      `Chưa khai TÊN thiết bị ${chieu} cho: ${thieuKhai.join(', ')}. Loại này không quét mã nên phải ghi tên.`,
      'THIEU_TEN_KHAI',
      { ma: thieuKhai },
    );
  }
  if (thieuSoLuong.length > 0) {
    throw loi422(
      `Chưa khai SỐ LƯỢNG ${chieu} cho: ${thieuSoLuong.join(', ')}.`,
      'THIEU_SO_LUONG',
      { ma: thieuSoLuong },
    );
  }

  // --- Ảnh: nguyên tắc bất biến #3, thiếu ảnh là KHÔNG cho hoàn tất
  const moiAnhId = muc.flatMap((m) => m.anhIds);
  const thieuAnh = muc
    .filter((m) => m.anhIds.length === 0)
    .map((m) => theoAsset.get(m.assetId)?.asset.code ?? m.assetId);
  if (thieuAnh.length > 0) {
    throw loi422(
      `Chưa có ảnh chụp thực tế cho: ${thieuAnh.join(', ')}. Phải chụp ảnh mới hoàn tất được.`,
      'THIEU_ANH',
      { ma: thieuAnh },
    );
  }

  const anh = await prisma.photo.findMany({
    where: { id: { in: moiAnhId } },
    select: { id: true, kind: true, movementId: true },
  });
  const bangAnh = new Map(anh.map((a) => [a.id, a]));

  const anhLa = moiAnhId.filter((a) => !bangAnh.has(a));
  if (anhLa.length > 0) {
    throw loi422('Có ảnh không tồn tại trong hệ thống.', 'ANH_KHONG_TON_TAI', { anhIds: anhLa });
  }
  const anhSaiLoai = anh.filter((a) => a.kind !== loaiAnh).map((a) => a.id);
  if (anhSaiLoai.length > 0) {
    throw loi422(
      `Ảnh phải được tải lên với loại ${loaiAnh === 'ANH_XUAT' ? 'ảnh lúc xuất' : 'ảnh lúc nhận'}.`,
      'ANH_SAI_LOAI',
      { anhIds: anhSaiLoai },
    );
  }
  const anhDaDung = anh.filter((a) => a.movementId !== null).map((a) => a.id);
  if (anhDaDung.length > 0) {
    throw loi422(
      'Có ảnh đã được dùng cho một lần xuất/nhập kho khác. Mỗi lần phải chụp ảnh mới.',
      'ANH_DA_DUNG',
      { anhIds: anhDaDung },
    );
  }

  return muc.map((m) => {
    const dong = theoAsset.get(m.assetId);
    if (!dong) throw loi422('Dòng thiết bị không hợp lệ.', 'DONG_KHONG_HOP_LE');
    if (dong.asset.trackingType === 'DON_VI' && (m.quantity ?? 1) !== 1) {
      throw loi422(
        `Thiết bị ${dong.asset.code} quản lý theo từng đơn vị nên số lượng phải bằng 1.`,
        'SO_LUONG_SAI',
      );
    }
    const soLuong = m.quantity ?? dong.quantity;
    // KHÔNG ĐƯỢC MANG RA NHIỀU HƠN SỐ ĐÃ DUYỆT.
    //
    // Thiếu phép kiểm này thì con số người ở kho gõ vào đi thẳng vào movement, mà
    // tồn kho suy ra từ movements (nguyên tắc bất biến #5) — nên gõ sai một số là
    // sai tồn kho, không có chỗ nào chặn. Đã dựng lại thật trước khi thêm: yêu cầu
    // duyệt 2 đơn vị, khai 5000 → API trả 200 và tồn kho LTL-AP-0003 tại kho văn
    // phòng tụt xuống −4920, tức âm, tức không thể có thật.
    if (soLuong > dong.quantity) {
      throw loi422(
        `Thiết bị ${dong.asset.code}: khai ${chieu} ${soLuong} nhưng yêu cầu chỉ được duyệt ${dong.quantity}. Muốn lấy thêm thì lập yêu cầu mới.`,
        'VUOT_SO_DA_DUYET',
        { ma: dong.asset.code, khai: soLuong, daDuyet: dong.quantity },
      );
    }
    return {
      requestItemId: dong.id,
      assetId: dong.asset.id,
      code: dong.asset.code,
      soLuong,
      anhIds: m.anhIds,
      // Dòng phải quét mã thì mã đã là bằng chứng nhận dạng, không cần khai tên.
      tenDaKhai: dong.asset.category.yeuCauQuetMa ? null : (m.tenDaKhai ?? '').trim() || null,
      ghiChu: m.ghiChu ?? null,
      currentLocationId: dong.asset.currentLocation?.id ?? null,
      condition: dong.asset.condition,
    };
  });
}

/** Trạng thái phân bổ sau khi thiết bị rời kho, suy từ loại yêu cầu và loại nơi đến. */
function trangThaiSauXuat(
  type: RequestType,
  loaiNoiDen: string | null,
): 'TAI_KHO' | 'DA_PHAN_BO' | 'DANG_VAN_CHUYEN' | 'CHO_MUON' | 'DANG_PHUC_VU_SU_KIEN' {
  if (choBenNhanXacNhan(type)) return 'DANG_VAN_CHUYEN';
  if (type === 'CHO_MUON') return 'CHO_MUON';
  switch (loaiNoiDen) {
    case 'DIEM_TRUONG':
      return 'DA_PHAN_BO';
    case 'DOI_TAC_MUON':
      return 'CHO_MUON';
    case 'KHO_SU_KIEN':
      return 'DANG_PHUC_VU_SU_KIEN';
    default:
      return 'TAI_KHO';
  }
}

export async function xuatKho(
  id: string,
  duLieu: DuLieuXuatKho,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const yeuCau = await prisma.request.findUnique({ where: { id }, select: CHON_YEU_CAU });
  if (!yeuCau) throw loi404('Không tìm thấy yêu cầu.');

  if (!laLoaiXuat(yeuCau.type)) {
    throw loi409('Loại yêu cầu này không phải xuất kho.');
  }
  // Nguyên tắc bất biến #2: chưa duyệt thì không thứ gì rời kho.
  if (yeuCau.status !== 'DA_DUYET') {
    throw loi422(
      `Yêu cầu chưa được duyệt (đang ở trạng thái "${yeuCau.status}") nên không xuất kho được.`,
      'CHUA_DUOC_DUYET',
    );
  }
  kiemNoiDen(yeuCau.type, yeuCau.toLocation?.id ?? null);

  const dong = await soatDongThucHien(yeuCau, duLieu.muc, 'ANH_XUAT');
  const choXacNhan = choBenNhanXacNhan(yeuCau.type);
  const noiDenId = yeuCau.toLocation?.id ?? null;
  const trangThaiMoi = trangThaiSauXuat(yeuCau.type, yeuCau.toLocation?.type ?? null);
  /**
   * Cho NHÂN SỰ mượn (không có điểm đến trong danh mục): thiết bị vẫn là của
   * công ty nhưng ĐÃ RỜI mạng lưới điểm lưu trữ — nó nằm trong tay một người.
   * Vì vậy vẫn ghi movement với `to_location_id = NULL` để tồn kho ở kho giảm
   * đúng, và gắn `holder_user_id` để biết đang ở chỗ ai. Lúc trả, movement
   * NULL → kho sẽ khôi phục tồn.
   */
  const muonNoiBo = yeuCau.type === 'CHO_MUON' && noiDenId === null;
  const bayGio = new Date();

  const sau = await prisma.$transaction(async (tx) => {
    // KHÔNG ĐƯỢC XUẤT NHIỀU HƠN SỐ ĐANG CÓ Ở KHO.
    //
    // Kiểm TRONG transaction để hai lượt xuất chạy song song không cùng đọc một
    // con số tồn rồi cùng cho qua. Trước khi có phép kiểm này, tồn kho suy ra từ
    // movements có thể xuống ÂM — đã dựng lại thật: xuất 5000 từ một kho chỉ có
    // 80 đơn vị, API trả 200, tồn còn −4920. Tồn âm nghĩa là sổ sách nói kho đang
    // nợ hàng cho chính mình, mọi báo cáo từ đó trở đi đều sai.
    // Tồn tại nguồn ĐỌC TRƯỚC KHI ghi movement. Vòng dưới cần lại con số này để
    // biết lấy xong nguồn còn gì không; đọc lại ở đó thì movement vừa ghi đã trừ
    // rồi, trừ thêm một lần nữa là sai gấp đôi.
    const tonNguonTruoc = new Map<string, number>();
    for (const d of dong) {
      if (!d.currentLocationId) continue;
      const dangCo = await tonTaiDiaDiem(d.assetId, d.currentLocationId, tx);
      tonNguonTruoc.set(d.assetId, dangCo);
      if (d.soLuong > dangCo) {
        throw loi422(
          `Thiết bị ${d.code}: khai mang ra ${d.soLuong} nhưng kho chỉ còn ${dangCo}. Kiểm lại số lượng hoặc kiểm kê trước khi xuất.`,
          'KHONG_DU_TON',
          { ma: d.code, khai: d.soLuong, conLai: dangCo },
        );
      }
    }

    for (const d of dong) {
      let movementId: string | null = null;

      // Loại phải chờ bên nhận xác nhận thì CHƯA ghi movement: hàng còn trên
      // đường, quyền sở hữu chưa đổi (luồng C). Mọi trường hợp khác — kể cả cho
      // nhân sự mượn — đều ghi movement để tồn kho suy ra đúng.
      if (!choXacNhan) {
        const movement = await tx.movement.create({
          data: {
            assetId: d.assetId,
            type: yeuCau.type === 'CHO_MUON' ? 'CHO_MUON' : 'XUAT_KHO',
            fromLocationId: d.currentLocationId,
            toLocationId: noiDenId,
            requestId: yeuCau.id,
            quantity: d.soLuong,
            conditionBefore: d.condition,
            conditionAfter: d.condition,
            declaredName: d.tenDaKhai,
            performedById: actor.id,
            performedAt: bayGio,
            note: d.ghiChu,
          },
          select: { id: true },
        });
        movementId = movement.id;
      }

      // Gắn ảnh vào đúng movement / yêu cầu — ảnh là bằng chứng của lần này.
      await tx.photo.updateMany({
        where: { id: { in: d.anhIds } },
        data: { movementId, requestId: yeuCau.id, assetId: d.assetId },
      });

      // SỐ THỰC SỰ MANG RA. Với loại chờ xác nhận thì đây là chỗ DUY NHẤT ghi
      // lại con số đó — chưa có movement nào để suy ra.
      await tx.requestItem.update({
        where: { id: d.requestItemId },
        data: { issuedQuantity: d.soLuong },
      });

      /*
       * CHỈ DỜI VỊ TRÍ KHI NGUỒN ĐÃ HẾT SẠCH.
       *
       * `current_location_id` ghi được đúng MỘT nơi, mà hàng lẻ (sách, cờ,
       * standee) nằm rải nhiều nơi cùng lúc. Lấy 30 trong 100 quyển mà dời cả
       * dòng sang trường thì 70 quyển còn nằm trong kho biến mất khỏi mọi danh
       * sách lọc theo vị trí: kho vẫn còn hàng mà máy bảo không có, và người ở
       * kho không lập nổi yêu cầu cho chính số hàng đang cầm trên tay.
       *
       * Tồn thật vẫn suy từ `movements` (nguyên tắc bất biến #5) nên không mất
       * số; cột này chỉ là "đang chủ yếu nằm đâu" để lọc nhanh. Tài sản quản lý
       * theo đơn vị luôn đi trọn vẹn nên nhánh này không đổi gì với chúng.
       */
      const conLaiONguon =
        d.currentLocationId === null ? 0 : (tonNguonTruoc.get(d.assetId) ?? 0) - d.soLuong;
      const dayHetKhoiNguon = conLaiONguon <= 0;

      await tx.asset.update({
        where: { id: d.assetId },
        data: {
          // Còn hàng ở nguồn thì thiết bị vẫn "tại kho" — không thể vừa ở kho
          // vừa mang trạng thái đã phân bổ đi nơi khác.
          ...(dayHetKhoiNguon ? { allocationStatus: trangThaiMoi } : {}),
          // Chờ bên nhận xác nhận thì vị trí giữ nguyên; còn lại chuyển theo nơi
          // đến (null = đang trong tay người giữ, không ở điểm lưu trữ nào).
          ...(choXacNhan || !dayHetKhoiNguon ? {} : { currentLocationId: noiDenId }),
          ...(muonNoiBo && dayHetKhoiNguon ? { holderUserId: yeuCau.createdBy.id } : {}),
          ...(yeuCau.expectedReturnAt ? { dueReturnAt: yeuCau.expectedReturnAt } : {}),
        },
      });

      await ghiAudit(
        {
          actor,
          action: 'asset.xuat_kho',
          entityType: 'asset',
          entityId: d.assetId,
          beforeValue: {
            currentLocationId: d.currentLocationId,
            allocationStatus: yeuCau.items.find((i) => i.asset.id === d.assetId)?.asset
              .allocationStatus,
          },
          afterValue: {
            currentLocationId:
              choXacNhan || !dayHetKhoiNguon ? d.currentLocationId : noiDenId,
            nguoiGiu: muonNoiBo && dayHetKhoiNguon ? yeuCau.createdBy.email : null,
            allocationStatus: dayHetKhoiNguon
              ? trangThaiMoi
              : yeuCau.items.find((i) => i.asset.id === d.assetId)?.asset.allocationStatus,
            conLaiONguon: Math.max(0, conLaiONguon),
            movementId,
            soLuong: d.soLuong,
          },
          photoIds: d.anhIds,
          note: `Xuất kho theo yêu cầu ${yeuCau.code} — mã ${d.code}.`,
          ...ctx,
        },
        tx,
      );
    }

    const capNhat = await tx.request.update({
      where: { id },
      data: {
        status: choXacNhan ? 'DA_XUAT' : 'DA_HOAN_TAT',
        issuedAt: bayGio,
        ...(choXacNhan ? {} : { completedAt: bayGio }),
      },
      select: CHON_YEU_CAU,
    });

    await ghiAudit(
      {
        actor,
        action: 'request.xuat_kho',
        entityType: 'request',
        entityId: id,
        beforeValue: { status: 'DA_DUYET' },
        afterValue: { status: capNhat.status, soDong: dong.length },
        photoIds: dong.flatMap((d) => d.anhIds),
        note: duLieu.ghiChu ?? null,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  // MỌI LẦN XUẤT KHO ĐỀU CÓ BIÊN BẢN LƯU LẠI. Gọi ngoài transaction và không
  // cho lỗi của nó làm hỏng lần xuất kho vừa ghi xong (xem `lapBBBGTuDong`).
  await lapBBBGTuDong(id, actor, ctx);

  phatChoNguoiDung(yeuCau.createdBy.id, SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: choXacNhan
      ? `Yêu cầu ${sau.code} đã xuất, đang chờ bên nhận xác nhận.`
      : `Yêu cầu ${sau.code} đã hoàn tất.`,
  });
  if (choXacNhan && noiDenId) {
    phatChoDiaDiem(noiDenId, SU_KIEN.YEU_CAU_DOI, {
      id: sau.id,
      code: sau.code,
      status: sau.status,
      thongDiep: `Có lô thiết bị đang chuyển tới, chờ bạn xác nhận.`,
    });
  }
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  return sau;
}

export async function nhapKho(
  id: string,
  duLieu: DuLieuNhapKho,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const yeuCau = await prisma.request.findUnique({ where: { id }, select: CHON_YEU_CAU });
  if (!yeuCau) throw loi404('Không tìm thấy yêu cầu.');
  if (!laLoaiNhap(yeuCau.type)) {
    throw loi409('Loại yêu cầu này không phải nhập kho / trả về kho.');
  }
  if (yeuCau.status !== 'DA_DUYET') {
    throw loi422(
      `Yêu cầu chưa được duyệt (đang ở trạng thái "${yeuCau.status}") nên không nhập kho được.`,
      'CHUA_DUOC_DUYET',
    );
  }

  const kho = await prisma.location.findFirst({
    // `deletedAt: null`: không nhập hàng về một điểm đã nằm trong thùng rác —
    // nhập được thì thiết bị nằm ở một nơi không còn hiện ở đâu cả.
    where: { id: duLieu.veLocationId, deletedAt: null },
    select: { id: true, name: true, type: true },
  });
  if (!kho) throw loi400('Kho nhận hàng về không tồn tại hoặc đã bị xoá.', 'KHO_KHONG_TON_TAI');

  const dong = await soatDongThucHien(yeuCau, duLieu.muc, 'ANH_NHAN');
  const tinhTrangTheoAsset = new Map(duLieu.muc.map((m) => [m.assetId, m.tinhTrang]));
  const bayGio = new Date();
  const canhBao: Array<{ code: string; truoc: AssetCondition; sau: AssetCondition }> = [];

  const sau = await prisma.$transaction(async (tx) => {
    for (const d of dong) {
      const tinhTrangMoi = tinhTrangTheoAsset.get(d.assetId) ?? d.condition;

      const movement = await tx.movement.create({
        data: {
          assetId: d.assetId,
          type: yeuCau.type === 'TRA_VE_KHO' ? 'TRA_VE_KHO' : 'NHAP_KHO',
          fromLocationId: d.currentLocationId,
          toLocationId: kho.id,
          requestId: yeuCau.id,
          quantity: d.soLuong,
          conditionBefore: d.condition,
          conditionAfter: tinhTrangMoi,
          declaredName: d.tenDaKhai,
          performedById: actor.id,
          performedAt: bayGio,
          note: d.ghiChu,
        },
        select: { id: true },
      });

      await tx.photo.updateMany({
        where: { id: { in: d.anhIds } },
        data: { movementId: movement.id, requestId: yeuCau.id, assetId: d.assetId },
      });

      await tx.asset.update({
        where: { id: d.assetId },
        data: {
          currentLocationId: kho.id,
          allocationStatus: 'TAI_KHO',
          condition: tinhTrangMoi,
          holderUserId: null,
          dueReturnAt: null,
        },
      });

      // Luồng B: tình trạng khi trả khác lúc xuất thì tự sinh cảnh báo cho quản trị.
      if (tinhTrangMoi !== d.condition) {
        canhBao.push({ code: d.code, truoc: d.condition, sau: tinhTrangMoi });
        await tx.alert.create({
          data: {
            type: 'TINH_TRANG_THAY_DOI',
            severity:
              tinhTrangMoi === 'HONG' || tinhTrangMoi === 'MAT' ? 'CAO' : 'TRUNG_BINH',
            title: `Tình trạng thay đổi khi trả: ${d.code}`,
            message:
              `Thiết bị ${d.code} lúc xuất là "${d.condition}", khi nhận về là "${tinhTrangMoi}" ` +
              `(yêu cầu ${yeuCau.code}, người nhận ${actor.email}).`,
            assetId: d.assetId,
            requestId: yeuCau.id,
          },
        });
      }

      await ghiAudit(
        {
          actor,
          action: 'asset.nhap_kho',
          entityType: 'asset',
          entityId: d.assetId,
          beforeValue: { currentLocationId: d.currentLocationId, condition: d.condition },
          afterValue: {
            currentLocationId: kho.id,
            condition: tinhTrangMoi,
            allocationStatus: 'TAI_KHO',
            movementId: movement.id,
            soLuong: d.soLuong,
          },
          photoIds: d.anhIds,
          note: `Nhập kho theo yêu cầu ${yeuCau.code} — mã ${d.code}.`,
          ...ctx,
        },
        tx,
      );
    }

    const capNhat = await tx.request.update({
      where: { id },
      data: { status: 'DA_HOAN_TAT', issuedAt: bayGio, completedAt: bayGio },
      select: CHON_YEU_CAU,
    });
    await ghiAudit(
      {
        actor,
        action: 'request.nhap_kho',
        entityType: 'request',
        entityId: id,
        beforeValue: { status: 'DA_DUYET' },
        afterValue: { status: 'DA_HOAN_TAT', soDong: dong.length, veKho: kho.name },
        photoIds: dong.flatMap((d) => d.anhIds),
        note: duLieu.ghiChu ?? null,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  // Nhập kho cũng là một lần bàn giao — cũng phải có biên bản lưu lại.
  await lapBBBGTuDong(id, actor, ctx);

  phatChoNguoiDung(yeuCau.createdBy.id, SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: `Yêu cầu ${sau.code} đã hoàn tất nhập kho.`,
  });
  if (canhBao.length > 0) {
    phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
      id: sau.id,
      code: sau.code,
      thongDiep: `${canhBao.length} thiết bị đổi tình trạng khi trả về kho.`,
    });
  }
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  return sau;
}

/** Xoá bản nháp. Yêu cầu đã gửi duyệt thì giữ lại làm lịch sử. */
export async function xoaNhap(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.request.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, createdById: true },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  if (truoc.status !== 'BAN_NHAP') {
    throw loi409('Chỉ xoá được yêu cầu còn ở trạng thái Nháp; yêu cầu đã gửi duyệt phải giữ lại.');
  }
  if (truoc.createdById !== actor.id && actor.role !== 'ADMIN') {
    throw loi403('Chỉ người tạo yêu cầu (hoặc quản trị viên) mới xoá được bản nháp.');
  }

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'request.delete_draft',
        entityType: 'request',
        entityId: id,
        beforeValue: { code: truoc.code, status: truoc.status },
        ...ctx,
      },
      tx,
    );
    await tx.requestItem.deleteMany({ where: { requestId: id } });
    await tx.request.delete({ where: { id } });
  });
}

/** Dùng cho màn hình kho: phạm vi vai trò có cho người này xuất/nhập kho không. */
export function batBuocQuyenThucHien(nguoiDung: NguoiDungDaXacThuc): void {
  if (!phamViCua(nguoiDung).toanBoKho) {
    throw loi403('Chỉ tài khoản kho và quản trị mới thực hiện xuất/nhập kho.');
  }
}

// ===========================================================================
// XOÁ MỀM — CHỈ ADMIN
// ===========================================================================

/**
 * Xoá mềm một yêu cầu ở BẤT KỲ trạng thái nào.
 *
 * Khác `xoaNhap` (ai tạo cũng xoá được bản nháp của mình, xoá hẳn khỏi CSDL):
 * đây là quyền của ADMIN để dọn phiếu lập sai, lập trùng, hoặc phiếu thử.
 *
 * ĐIỀU PHẢI NHỚ: xoá phiếu KHÔNG hoàn tác việc đã xảy ra. Hàng đã ra khỏi kho
 * thì vẫn ở ngoài kho, vì tồn kho suy từ `movements` chứ không từ phiếu
 * (nguyên tắc bất biến #5). Muốn hàng quay về thì phải lập phiếu nhập kho, chứ
 * không phải xoá phiếu cũ đi — nên hàm này cố ý KHÔNG đụng vào movements.
 */
export async function xoaMem(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.request.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, type: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  if (truoc.deletedAt) throw loi409('Yêu cầu này đã nằm trong thùng rác.');

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actor.id },
    });
    await ghiAudit(
      {
        actor,
        action: 'request.soft_delete',
        entityType: 'request',
        entityId: id,
        beforeValue: { code: truoc.code, status: truoc.status, type: truoc.type },
        afterValue: { deletedAt: new Date().toISOString() },
        note: 'Xoá mềm; nhật ký di chuyển và tồn kho giữ nguyên.',
        ...ctx,
      },
      tx,
    );
  });
}

export async function khoiPhuc(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<YeuCauDayDu> {
  const truoc = await prisma.request.findUnique({
    where: { id },
    select: { id: true, code: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  if (!truoc.deletedAt) throw loi409('Yêu cầu này không nằm trong thùng rác.');

  return prisma.$transaction(async (tx) => {
    const sau = await tx.request.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
      select: CHON_YEU_CAU,
    });
    await ghiAudit(
      {
        actor,
        action: 'request.restore',
        entityType: 'request',
        entityId: id,
        afterValue: { code: truoc.code },
        ...ctx,
      },
      tx,
    );
    return sau;
  });
}

/** Danh sách yêu cầu trong thùng rác (ADMIN). */
export async function thungRac(loc: {
  trang: number;
  moiTrang: number;
}): Promise<{ muc: YeuCauDayDu[]; tong: number; trang: number; moiTrang: number }> {
  const dieuKien: Prisma.RequestWhereInput = { deletedAt: { not: null } };
  const [muc, tong] = await Promise.all([
    prisma.request.findMany({
      where: dieuKien,
      select: CHON_YEU_CAU,
      orderBy: { deletedAt: 'desc' },
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.request.count({ where: dieuKien }),
  ]);
  return { muc, tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

/**
 * XOÁ HẲN khỏi CSDL. Chỉ xoá được phiếu đang nằm trong thùng rác.
 *
 * Trình tự ở đây là phần an toàn, không phải thủ tục cho có:
 *
 *  1. GỠ ẢNH RA KHỎI PHIẾU TRƯỚC. `photos.request_id` khai ON DELETE CASCADE,
 *     nên xoá phiếu là xoá luôn ảnh — kể cả những ảnh đang là bằng chứng gắn
 *     vào một bút toán di chuyển vẫn còn sống. Gỡ `request_id` về NULL thì ảnh
 *     ở lại với bút toán của nó.
 *  2. GỠ BIÊN BẢN RA KHỎI PHIẾU. Khai SET NULL sẵn rồi nhưng gỡ tường minh cho
 *     rõ ý: biên bản đã ký là chứng từ độc lập, không chết theo phiếu.
 *  3. Movements để NGUYÊN (FK đã là SET NULL). Hàng đã đi là đã đi; xoá bút
 *     toán là làm tồn kho sai vĩnh viễn, không có cách nào dựng lại.
 */
export async function xoaVinhVien(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.request.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  if (!truoc.deletedAt) {
    throw loi409('Chỉ xoá hẳn được yêu cầu đang nằm trong thùng rác. Hãy xoá mềm trước.');
  }

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'request.purge',
        entityType: 'request',
        entityId: id,
        beforeValue: { code: truoc.code, status: truoc.status },
        note: 'Xoá hẳn khỏi CSDL; ảnh và bút toán di chuyển được giữ lại.',
        ...ctx,
      },
      tx,
    );
    await tx.photo.updateMany({ where: { requestId: id }, data: { requestId: null } });
    await tx.handoverNote.updateMany({ where: { requestId: id }, data: { requestId: null } });
    await tx.requestItem.deleteMany({ where: { requestId: id } });
    await tx.request.delete({ where: { id } });
  });
}

/** Tra mã phiếu của cả lô một lượt — để báo lỗi gọi tên phiếu, không đọc id. */
async function maCuaLo(ids: readonly string[]): Promise<Map<string, string>> {
  const hang = await prisma.request.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, code: true },
  });
  return new Map(hang.map((h) => [h.id, h.code]));
}

/** Xoá mềm NHIỀU phiếu đã chọn (ADMIN). */
export async function xoaMemNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoatChung> {
  return chayTungCai(ids, maCuaLo, (id) => xoaMem(id, actor, ctx));
}

export async function khoiPhucNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoatChung> {
  return chayTungCai(ids, maCuaLo, (id) => khoiPhuc(id, actor, ctx));
}

export async function xoaVinhVienNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoatChung> {
  return chayTungCai(ids, maCuaLo, (id) => xoaVinhVien(id, actor, ctx));
}
