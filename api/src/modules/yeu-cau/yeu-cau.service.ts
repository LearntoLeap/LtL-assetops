/**
 * NGHIỆP VỤ YÊU CẦU — trái tim của hệ thống.
 *
 * Ba chốt chặn không ai đi vòng được, vì đều nằm ở service phía server:
 *   1. Không còn bước duyệt (chủ doanh nghiệp bỏ từ 10/2026): người lập tự xuất /
 *      nhập kho phiếu của mình, quản trị được BÁO bằng cảnh báo lưu lại. Quyền
 *      và phạm vi vẫn kiểm ở đây (`kiemQuyenThucHien`).
 *   2. Hoàn tất xuất/nhập kho BẮT BUỘC có ảnh chụp thực tế (nguyên tắc #3).
 *   3. Mã quét được phải KHỚP mã thiết bị trong yêu cầu — chặn cầm nhầm thiết bị.
 *
 * Mọi lần đổi vị trí/tình trạng đều ghi movement + audit trong CÙNG transaction
 * với việc cập nhật hình chiếu trạng thái trên bảng assets, nên tồn kho suy ra
 * từ movements không bao giờ lệch với trạng thái hiển thị.
 */
import {
  Prisma,
  type AssetCondition,
  type RequestStatus,
  type RequestType,
} from '@prisma/client';
import { prisma, type PrismaTx } from '../../prisma.js';
import { traTrangThaiSauHuyBanGiao } from '../../lib/huy-ban-giao.js';
import { loi400, loi403, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { dieuKienTaiSan, dieuKienYeuCau, phamViCua } from '../../lib/pham-vi.js';
import { hangDangTrenDuong, tonCuaTaiSan, tonTaiDiaDiem } from '../../lib/ton-kho.js';
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
  note: true,
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
    // `fileName`: giao diện cần biết biên bản ĐÃ xuất file chưa, vì chỉ khi có
    // file mới ghi nhận bàn giao theo biên bản được (server cũng kiểm lại).
    select: { id: true, code: true, status: true, fileName: true },
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
 * Loại phải chờ XÁC NHẬN BÀN GIAO mới đổi vị trí sở hữu (luồng C). Lúc xuất
 * chỉ đánh dấu "Đang vận chuyển"; movement ghi khi Quản trị / Vận hành xác nhận
 * bàn giao ở trang yêu cầu (bên nhận không còn phải bấm xác nhận).
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
  actor: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  kiemPhieuCuaTruong(actor, duLieu.type, duLieu.fromLocationId ?? null);
  // Không còn bước duyệt nên lập xong là sang ngay màn hình chụp ảnh. Bắt thiếu
  // nơi đến / trường gửi NGAY LÚC LẬP — đừng để người dùng chụp ảnh từng thiết bị
  // xong mới bị chặn ở nút "Hoàn tất".
  kiemNoiDen(duLieu.type, duLieu.toLocationId ?? null);
  kiemTruongGuiNhan(duLieu.type, duLieu.fromLocationId ?? null, duLieu.toLocationId ?? null);
  await kiemDiemHopLe(duLieu.type, duLieu.fromLocationId ?? null, duLieu.toLocationId ?? null);
  const dong = await doiMaThanhTaiSan(duLieu.muc);
  await kiemHangCuaTruong(actor, dong);

  const yeuCau = await prisma.$transaction(async (tx) => {
    const code = await capSoChungTu(tx, TIEN_TO.YEU_CAU);
    const taoMoi = await tx.request.create({
      data: {
        code,
        type: duLieu.type,
        // BAN_NHAP giờ mang nghĩa "chờ xuất / nhập kho" (xem nhãn ở shared):
        // người lập còn sửa / xoá được cho tới lúc chụp ảnh hoàn tất.
        status: 'BAN_NHAP',
        submittedAt: new Date(),
        createdById: actor.id,
        reason: duLieu.reason,
        fromLocationId: duLieu.fromLocationId ?? null,
        toLocationId: duLieu.toLocationId ?? null,
        destinationNote: duLieu.destinationNote ?? null,
        note: duLieu.note ?? null,
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

  // Báo nhóm quản trị và kho NGAY khi có phiếu — quản trị nắm được việc gì sắp
  // ra / vào kho, và vẫn kịp từ chối nếu thấy không ổn (xem `tuChoi`).
  const thongTin = {
    id: yeuCau.id,
    code: yeuCau.code,
    type: yeuCau.type,
    status: yeuCau.status,
    thongDiep: `${yeuCau.createdBy.fullName} vừa lập ${yeuCau.code}, đang chờ chụp ảnh xuất / nhập kho.`,
  };
  phatChoNguoiDuyet(SU_KIEN.YEU_CAU_MOI, thongTin);
  phatChoKho(SU_KIEN.YEU_CAU_MOI, thongTin);
  // Trường đi / trường đến cũng biết ngay — tài khoản trường không ở phòng kho.
  for (const diem of new Set([yeuCau.fromLocation?.id, yeuCau.toLocation?.id])) {
    if (diem) phatChoDiaDiem(diem, SU_KIEN.YEU_CAU_MOI, thongTin);
  }
  return yeuCau;
}

/** Chỉ sửa được bản nháp, và chỉ người tạo (hoặc ADMIN) mới sửa. */
export async function sua(
  id: string,
  duLieu: DuLieuSuaYeuCau,
  actor: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const truoc = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      code: true,
      status: true,
      createdById: true,
      type: true,
      fromLocationId: true,
      toLocationId: true,
    },
  });
  if (!truoc) throw loi404('Không tìm thấy yêu cầu.');
  // Kiểm quyền TRƯỚC mọi phép soát khác: lời báo của các phép soát nói ra trạng
  // thái và điểm đi / đến của phiếu — người không có quyền không được đọc thấy.
  if (truoc.createdById !== actor.id && actor.role !== 'ADMIN') {
    throw loi403('Chỉ người tạo yêu cầu (hoặc quản trị viên) mới sửa được.');
  }
  if (truoc.status !== 'BAN_NHAP') {
    throw loi409('Chỉ sửa được phiếu chưa xuất / nhập kho.');
  }
  {
    const tu = duLieu.fromLocationId === undefined ? truoc.fromLocationId : duLieu.fromLocationId;
    const den = duLieu.toLocationId === undefined ? truoc.toLocationId : duLieu.toLocationId;
    kiemPhieuCuaTruong(actor, truoc.type, tu);
    kiemNoiDen(truoc.type, den);
    kiemTruongGuiNhan(truoc.type, tu, den);
    await kiemDiemHopLe(truoc.type, tu, den);
  }

  const dong = duLieu.muc ? await doiMaThanhTaiSan(duLieu.muc) : null;
  if (dong) await kiemHangCuaTruong(actor, dong);

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
        ...(duLieu.note === undefined ? {} : { note: duLieu.note }),
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

/**
 * TÀI KHOẢN TRƯỜNG LẬP / SỬA PHIẾU: hàng phải đi TỪ CHÍNH TRƯỜNG MÌNH.
 *
 * Trường làm được việc của kho nhưng chỉ với hàng của trường: trả hàng về kho
 * (Nhập kho), luân chuyển sang trường khác, xuất hoặc cho mượn từ trường. Phân
 * bổ về trường do Quản trị / Vận hành / Kho lập — trường là bên NHẬN, chỉ xem
 * được thiết bị của trường mình nên không chọn hàng trong kho để tự xin. Trước
 * đây trường lập được cả phiếu luân chuyển từ một trường KHÁC, và phiếu đó hiện
 * sang danh sách của trường kia.
 */
function kiemPhieuCuaTruong(
  nguoiDung: NguoiDungDaXacThuc,
  type: RequestType,
  fromLocationId: string | null,
): void {
  if (nguoiDung.role !== 'TRUONG') return;
  const truong = nguoiDung.locationId;
  if (!truong) {
    throw loi403('Tài khoản điểm trường chưa được gán trường phụ trách. Liên hệ quản trị viên.');
  }
  if (type === 'PHAN_BO_VE_TRUONG') {
    throw loi403(
      'Phân bổ về trường do Quản trị, Vận hành hoặc Kho lập — tài khoản trường là bên nhận hàng.',
    );
  }
  if (fromLocationId !== truong) {
    throw loi403(
      'Tài khoản trường chỉ lập phiếu cho hàng đi từ chính trường mình. Chọn trường mình ở ô nơi đi.',
    );
  }
}

/**
 * Tài khoản trường chỉ đưa vào phiếu HÀNG CỦA TRƯỜNG MÌNH. Không kiểm thì gõ mã
 * bất kỳ vào một phiếu nháp là đọc được thiết bị đó đang nằm ở đâu, tình trạng
 * ra sao (chi tiết phiếu trả kèm vị trí) — lách đúng chỗ tra mã đã che đi. Báo
 * lỗi KHÔNG kèm vị trí của mã ngoài trường.
 */
async function kiemHangCuaTruong(
  nguoiDung: NguoiDungDaXacThuc,
  dong: ReadonlyArray<{ assetId: string; code: string }>,
): Promise<void> {
  if (nguoiDung.role !== 'TRUONG' || dong.length === 0) return;
  const trong = await prisma.asset.findMany({
    where: { AND: [{ id: { in: dong.map((d) => d.assetId) } }, await dieuKienTaiSan(nguoiDung)] },
    select: { id: true },
  });
  const coTrong = new Set(trong.map((t) => t.id));
  const ngoai = dong.filter((d) => !coTrong.has(d.assetId)).map((d) => d.code);
  if (ngoai.length > 0) {
    throw loi403(`Mã ${ngoai.slice(0, 5).join(', ')} không phải hàng của trường bạn.`);
  }
}

function kiemNoiDen(type: RequestType, toLocationId: string | null): void {
  if (CAN_NOI_DEN.has(type) && !toLocationId) {
    throw loi422(
      'Loại yêu cầu này bắt buộc phải chọn nơi đến trong danh mục điểm lưu trữ.',
      'THIEU_NOI_DEN',
    );
  }
}

/**
 * ĐIỂM TRÊN PHIẾU PHẢI CÓ THẬT VÀ ĐÚNG LOẠI.
 *
 * Trước đây gửi một id điểm không tồn tại là lỗi khoá ngoại không ai đọc nổi
 * (HTTP 500); id của điểm trong thùng rác thì lọt qua; "phân bổ về trường" chọn
 * nhầm một kho cũng được nhận. Giờ chặn ngay lúc lập với lời báo rõ ràng.
 */
const LOAI_DIEM_THEO_YEU_CAU: Partial<
  Record<RequestType, { den?: ReadonlyArray<string>; di?: ReadonlyArray<string> }>
> = {
  PHAN_BO_VE_TRUONG: { den: ['DIEM_TRUONG'], di: ['KHO_VAN_PHONG', 'KHO_SU_KIEN'] },
  LUAN_CHUYEN_TRUONG: { den: ['DIEM_TRUONG'], di: ['DIEM_TRUONG'] },
  NHAP_KHO: { den: ['KHO_VAN_PHONG', 'KHO_SU_KIEN'] },
  TRA_VE_KHO: { den: ['KHO_VAN_PHONG', 'KHO_SU_KIEN'] },
};

async function kiemDiemHopLe(
  type: RequestType,
  fromLocationId: string | null,
  toLocationId: string | null,
): Promise<void> {
  const ids = [fromLocationId, toLocationId].filter((x): x is string => Boolean(x));
  if (ids.length === 0) return;
  const diem = await prisma.location.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, type: true, deletedAt: true, isActive: true },
  });
  const theoId = new Map(diem.map((d) => [d.id, d]));
  const quyTac = LOAI_DIEM_THEO_YEU_CAU[type];
  const kiem = (id: string | null, vaiTro: 'đi' | 'đến', cho?: ReadonlyArray<string>): void => {
    if (!id) return;
    const d = theoId.get(id);
    if (!d || d.deletedAt) {
      throw loi422(`Điểm ${vaiTro} không tồn tại hoặc đã bị xoá. Chọn lại điểm khác.`, 'DIEM_KHONG_HOP_LE');
    }
    if (!d.isActive) {
      throw loi422(`Điểm "${d.name}" đã ngừng sử dụng.`, 'DIEM_NGUNG_DUNG');
    }
    if (cho && !cho.includes(d.type)) {
      throw loi422(
        `"${d.name}" không dùng làm điểm ${vaiTro} cho loại yêu cầu này được.`,
        'DIEM_SAI_LOAI',
      );
    }
  };
  kiem(fromLocationId, 'đi', quyTac?.di);
  kiem(toLocationId, 'đến', quyTac?.den);
}

/**
 * LUÂN CHUYỂN TRƯỜNG phải có ĐỦ trường gửi và trường nhận, và là hai trường khác
 * nhau. Trước đây chỉ có ô "trường nhận", trường gửi ghi tay trong lý do, nên
 * biên bản không điền được bên giao và máy phải đoán hàng rời đi từ đâu.
 */
function kiemTruongGuiNhan(
  type: RequestType,
  fromLocationId: string | null,
  toLocationId: string | null,
): void {
  if (type !== 'LUAN_CHUYEN_TRUONG') return;
  if (!fromLocationId) {
    throw loi422('Luân chuyển trường phải chọn TRƯỜNG GỬI.', 'THIEU_TRUONG_GUI');
  }
  if (fromLocationId === toLocationId) {
    throw loi422('Trường gửi và trường nhận phải là hai trường khác nhau.', 'TRUNG_TRUONG');
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
    select: { id: true, code: true, status: true, type: true, createdById: true, deletedAt: true },
  });
  if (!truoc || truoc.deletedAt) throw loi404('Không tìm thấy yêu cầu.');
  /*
   * HUỶ BÀN GIAO phân bổ / luân chuyển đã xuất nhưng quản lý chưa xác nhận:
   * hàng chưa được ghi rời nơi gửi (chỉ ghi lúc xác nhận), nên huỷ phiếu là số
   * "đang chuyển" trả về nơi gửi — không phải sửa tồn gì thêm.
   */
  const huyBanGiao = truoc.status === 'DA_XUAT' && LOAI_CHO_XAC_NHAN.has(truoc.type);
  // Không còn bước duyệt, nhưng quản trị vẫn phải DỪNG được một phiếu chưa thực
  // hiện khi thấy không ổn — đó là lý do họ được báo ngay lúc phiếu được lập.
  if (!TRANG_THAI_CHO_THUC_HIEN.has(truoc.status) && !huyBanGiao) {
    throw loi409('Chỉ từ chối được yêu cầu chưa xuất / nhập kho, hoặc phiếu đang chờ xác nhận bàn giao.');
  }
  if (!huyBanGiao && truoc.createdById === actor.id) {
    throw loi403('Không được tự xử lý yêu cầu của chính mình — tự xoá phiếu của mình thì dùng nút Xoá.');
  }

  const sau = await prisma.$transaction(async (tx) => {
    const khoa = await tx.$queryRaw<Array<{ status: string }>>(
      Prisma.sql`SELECT status FROM requests WHERE id = ${id} FOR UPDATE`,
    );
    if (khoa[0]?.status !== truoc.status) {
      throw loi409('Phiếu này vừa được xử lý xong — tải lại trang để xem trạng thái mới.', {
        maLoi: 'DA_XU_LY',
      });
    }
    if (huyBanGiao) {
      await tx.handoverNote.updateMany({
        where: {
          requestId: id,
          deletedAt: null,
          status: { in: ['BAN_NHAP', 'TU_LAP', 'DA_CHINH_SUA', 'CHO_XAC_NHAN'] },
        },
        data: {
          status: 'TU_CHOI',
          rejectionNote: `Huỷ bàn giao: ${rejectionNote}`.slice(0, 2000),
          confirmedById: actor.id,
          confirmedAt: new Date(),
        },
      });
      await traTrangThaiSauHuyBanGiao(tx, id);
    }
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
        action: huyBanGiao ? 'request.cancel_handover' : 'request.reject',
        entityType: 'request',
        entityId: id,
        beforeValue: { status: truoc.status },
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
    thongDiep: huyBanGiao ? `Phiếu ${sau.code} đã bị huỷ bàn giao.` : `Yêu cầu ${sau.code} bị từ chối.`,
  });
  // Huỷ bàn giao làm số "đang chuyển" trả về nơi gửi — trang tổng quan nạp lại.
  if (huyBanGiao) {
    phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  }
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
  /**
   * BỎ QUA ĐÒI ẢNH — chỉ dùng cho lối "ghi nhận bàn giao theo biên bản".
   *
   * Nguyên tắc bất biến #3 đòi BẰNG CHỨNG cho mọi lần hàng đổi chỗ, và mặc định
   * bằng chứng đó là ảnh chụp tại chỗ. Lối kia thay ảnh bằng một bằng chứng khác
   * mạnh hơn: file biên bản bàn giao .docx đã xuất, có tên và chữ ký hai bên,
   * lưu lại trong hệ thống. `ghiNhanTheoBienBan` kiểm đúng điều kiện đó TRƯỚC
   * khi bật cờ này — không có file biên bản thì không đi được lối này.
   */
  boQuaAnh = false,
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
  const thieuAnh = boQuaAnh
    ? []
    : muc
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

/** Tuỳ chọn nội bộ, KHÔNG nhận từ HTTP — xem `ghiNhanTheoBienBan`. */
interface TuyChonGhiNhan {
  /** Thay ảnh chụp bằng file biên bản bàn giao đã xuất. */
  boQuaAnh?: boolean | undefined;
  /** Ghi vào nhật ký để biết lần ghi nhận này đến từ đâu. */
  nguonGhiNhan?: string | undefined;
}

/**
 * PHIẾU CHỜ THỰC HIỆN — xuất / nhập kho được ngay, không phải chờ ai duyệt.
 *
 * Chủ doanh nghiệp đã bỏ bước duyệt: lập phiếu xong là dẫn thẳng tới màn hình
 * chụp ảnh xuất / nhập kho, quản trị được báo sau. Gồm cả CHO_DUYET và DA_DUYET
 * để các phiếu lập theo quy trình cũ, đang nằm chờ, cũng làm tiếp được mà không
 * phải sửa dữ liệu.
 */
export const TRANG_THAI_CHO_THUC_HIEN: ReadonlySet<RequestStatus> = new Set<RequestStatus>([
  'BAN_NHAP',
  'CHO_DUYET',
  'DA_DUYET',
]);

/** Loại điểm là KHO của LtL — nơi hàng được nhập về và mặc định xuất đi. */
const LOAI_DIEM_KHO: ReadonlySet<string> = new Set(['KHO_VAN_PHONG', 'KHO_SU_KIEN']);

/** Giá trị đặc biệt của "Lấy từ / Nhận từ": hàng ở NGOÀI hệ thống (mua mới, người mượn trả). */
export const NGUON_NGOAI = 'NGOAI';
/** Nguồn nhập = NHÂN SỰ TRẢ LẠI hàng đã mượn (không phải hàng mới). */
export const NGUON_NHAN_SU = 'NHAN_SU';

/**
 * KHOÁ PHIẾU + THIẾT BỊ trong transaction rồi đọc lại trạng thái.
 *
 * Bỏ bước duyệt thì người lập và người ở kho có thể cùng đứng ở màn hình chụp
 * ảnh của MỘT phiếu. Trước đây trạng thái được đọc NGOÀI transaction và phép kiểm
 * tồn là SELECT không khoá, nên hai lượt bấm "Hoàn tất" gần nhau cùng lọt qua và
 * ghi hai lần bút toán — kho bị trừ gấp đôi. Khoá dòng phiếu (FOR UPDATE) thì
 * lượt sau phải đợi lượt trước xong, đọc lại thấy phiếu đã thực hiện và dừng.
 *
 * Thiết bị khoá theo thứ tự id để hai phiếu khác nhau cùng lấy một mã hàng lẻ
 * cũng xếp hàng, không cùng đọc một con số tồn rồi cùng cho qua.
 */
async function khoaPhieuVaThietBi(
  tx: PrismaTx,
  id: string,
  assetIds: readonly string[],
): Promise<void> {
  const dong = await tx.$queryRaw<Array<{ status: string; deleted_at: Date | null }>>(
    Prisma.sql`SELECT status, deleted_at FROM requests WHERE id = ${id} FOR UPDATE`,
  );
  const phieu = dong[0];
  if (!phieu || phieu.deleted_at) throw loi404('Không tìm thấy yêu cầu.');
  if (!TRANG_THAI_CHO_THUC_HIEN.has(phieu.status as RequestStatus)) {
    throw loi409(
      phieu.status === 'DA_XUAT' || phieu.status === 'DA_HOAN_TAT'
        ? 'Yêu cầu này vừa được thực hiện xong — không ghi thêm lần nữa.'
        : `Yêu cầu đang ở trạng thái "${phieu.status}" nên không thực hiện được.`,
      { maLoi: 'DA_THUC_HIEN', trangThai: phieu.status },
    );
  }
  if (assetIds.length > 0) {
    const sapXep = [...assetIds].sort();
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM assets WHERE id IN (${Prisma.join(sapXep)}) ORDER BY id FOR UPDATE`,
    );
  }
}

/** Tồn DÙNG ĐƯỢC tại một điểm = tồn sổ sách − phần đã xuất đi nhưng bên nhận chưa xác nhận. */
async function tonDungDuoc(assetId: string, locationId: string, tx: PrismaTx): Promise<number> {
  const [ton, dangDi] = await Promise.all([
    tonTaiDiaDiem(assetId, locationId, tx),
    hangDangTrenDuong([assetId], tx),
  ]);
  const di = (dangDi.get(assetId) ?? [])
    .filter((x) => x.locationId === locationId)
    .reduce((a, x) => a + x.soLuong, 0);
  return ton - di;
}

/**
 * LẤY HÀNG TỪ ĐÂU khi xuất kho.
 *
 * Trước đây luôn lấy `assets.current_location_id`. Cột đó chỉ ghi được MỘT nơi
 * mà hàng lẻ nằm rải nhiều nơi — và nó còn bị đổi sai: bên nhận xác nhận một lô
 * 30 quyển về trường là cả dòng 100 quyển bị dời vị trí sang trường. Từ đó mọi
 * lần xuất sau đều trừ vào TRƯỜNG chứ không trừ KHO, đúng điều chủ doanh nghiệp
 * thấy: "xuất kho mà số lượng tại kho không trừ đi".
 *
 * Giờ nguồn được xác định theo TỒN THẬT, dừng ở cái đầu tiên có:
 *   1. Người thực hiện chọn "Lấy từ" trên màn hình xuất kho.
 *   2. "Lấy từ" ghi trên phiếu (bắt buộc với luân chuyển trường).
 *   3. Thiết bị theo đơn vị: nơi nó đang nằm. Đang trong tay người mượn thì
 *      không xuất được — chưa về kho thì không có gì để lấy.
 *   4. Hàng lẻ: KHO duy nhất còn đủ hàng dùng được. Nhiều kho cùng đủ thì lấy
 *      kho đang ghi ở cột vị trí nếu nó đủ; không thì báo để người dùng chọn —
 *      đoán sai kho là trừ nhầm sổ của kho khác.
 */
async function nguonXuatTheoDong(
  yeuCau: YeuCauDayDu,
  dong: DongDaSoat[],
  tuLocationId: string | null,
  tx: PrismaTx,
): Promise<Map<string, string>> {
  const ra = new Map<string, string>();
  const khaiSan = tuLocationId ?? yeuCau.fromLocation?.id ?? null;
  const diemKho = await tx.location.findMany({
    where: { deletedAt: null, type: { in: [...LOAI_DIEM_KHO] as Array<'KHO_VAN_PHONG' | 'KHO_SU_KIEN'> } },
    select: { id: true, name: true },
  });
  const tenKho = new Map(diemKho.map((d) => [d.id, d.name]));

  for (const d of dong) {
    const kieu = yeuCau.items.find((i) => i.asset.id === d.assetId)?.asset.trackingType;
    if (khaiSan) {
      ra.set(d.assetId, khaiSan);
      continue;
    }
    if (kieu === 'DON_VI') {
      if (!d.currentLocationId) {
        throw loi422(
          `Thiết bị ${d.code} đang trong tay người mượn, chưa về kho — nhập kho trước rồi mới xuất được.`,
          'THIET_BI_DANG_MUON',
          { ma: d.code },
        );
      }
      ra.set(d.assetId, d.currentLocationId);
      continue;
    }
    // Hàng lẻ: tìm kho còn đủ hàng dùng được.
    const ton = await tonCuaTaiSan(d.assetId, tx);
    const dangDi = (await hangDangTrenDuong([d.assetId], tx)).get(d.assetId) ?? [];
    const conTheoKho = ton.theoDiaDiem
      .filter((t) => tenKho.has(t.locationId))
      .map((t) => ({
        locationId: t.locationId,
        con:
          t.ton -
          dangDi.filter((x) => x.locationId === t.locationId).reduce((a, x) => a + x.soLuong, 0),
      }));
    const du = conTheoKho.filter((x) => x.con >= d.soLuong);
    const chon =
      du.length === 1
        ? du[0]
        : (du.find((x) => x.locationId === d.currentLocationId) ?? undefined);
    if (chon) {
      ra.set(d.assetId, chon.locationId);
      continue;
    }
    if (du.length > 1) {
      throw loi422(
        `Thiết bị ${d.code} có đủ hàng ở ${du.length} kho (${du
          .map((x) => `${tenKho.get(x.locationId)}: ${x.con}`)
          .join(', ')}). Chọn "Lấy từ kho" để biết trừ ở kho nào.`,
        'KHONG_RO_NOI_XUAT',
        { ma: d.code, noi: du.map((x) => ({ id: x.locationId, ten: tenKho.get(x.locationId), con: x.con })) },
      );
    }
    const tong = conTheoKho.reduce((a, x) => a + Math.max(0, x.con), 0);
    throw loi422(
      tong > 0
        ? `Thiết bị ${d.code}: cần ${d.soLuong} nhưng không kho nào còn đủ (${conTheoKho
            .filter((x) => x.con > 0)
            .map((x) => `${tenKho.get(x.locationId)}: ${x.con}`)
            .join(', ')}). Giảm số lượng hoặc tách phiếu theo từng kho.`
        : `Thiết bị ${d.code}: các kho đã hết hàng dùng được.`,
      'KHONG_DU_TON',
      { ma: d.code, khai: d.soLuong },
    );
  }
  return ra;
}

/**
 * AI ĐƯỢC TỰ THỰC HIỆN PHIẾU (không còn bước duyệt).
 *
 *   - ADMIN, VAN_HANH, KHO, NHÂN SỰ PHÒNG BAN: mọi phiếu (nhân sự làm được mọi
 *     việc của kho).
 *   - Tài khoản TRƯỜNG: mọi phiếu có NƠI ĐI là chính trường mình — không cần là
 *     người lập (kho lập phiếu thu hồi về thì trường vẫn tự xuất được), nhưng
 *     hàng phải thật sự rời đi từ trường mình: trường không đứng ở kho LtL nên
 *     không chụp ảnh "xuất kho" cho kho LtL, và không nhận hộ hàng của nơi khác.
 *   - Vai trò khác (nếu sau này thêm mà quên khai phạm vi): phiếu của chính mình.
 *
 * Kiểm ở SERVER — ẩn nút ở giao diện chỉ là phụ.
 */
function kiemQuyenThucHien(
  nguoiDung: NguoiDungDaXacThuc,
  yeuCau: YeuCauDayDu,
  nguon: ReadonlyMap<string, string | null>,
  chieu: 'xuất' | 'nhập',
): void {
  if (phamViCua(nguoiDung).toanBoKho) return;
  if (nguoiDung.role === 'TRUONG') {
    const truong = nguoiDung.locationId;
    const sai =
      !truong ||
      yeuCau.fromLocation?.id !== truong ||
      [...nguon.values()].some((n) => n !== truong);
    if (sai) {
      throw loi403(
        chieu === 'xuất'
          ? 'Tài khoản trường chỉ xuất kho được phiếu có nơi đi là chính trường mình.'
          : 'Tài khoản trường chỉ nhập kho được hàng trả về từ chính trường mình.',
      );
    }
    return;
  }
  if (yeuCau.createdBy.id !== nguoiDung.id) {
    throw loi403(
      `Chỉ người lập phiếu, tài khoản kho hoặc quản trị mới ${chieu} kho cho phiếu này.`,
    );
  }
}

/**
 * BÁO QUẢN TRỊ: có người vừa tự xuất / nhập kho, không qua duyệt.
 *
 * Ghi thành một dòng CẢNH BÁO (lưu lại, đánh dấu "đã xem" được) chứ không chỉ
 * phát tín hiệu realtime — quản trị không trực tuyến lúc đó vẫn thấy khi mở máy.
 * Quản trị tự làm thì không báo chính mình.
 */
async function baoQuanTriTuThucHien(
  tx: PrismaTx,
  nguoiDung: NguoiDungDaXacThuc,
  yeuCau: YeuCauDayDu,
  chieu: 'xuất' | 'nhập',
  dong: DongDaSoat[],
): Promise<boolean> {
  if (nguoiDung.role === 'ADMIN') return false;
  const tom = dong
    .slice(0, 5)
    .map((d) => `${d.code} × ${d.soLuong}`)
    .join(', ');
  await tx.alert.create({
    data: {
      type: 'XUAT_NHAP_TRUC_TIEP',
      severity: 'THAP',
      title: `${nguoiDung.fullName} đã ${chieu} kho ${yeuCau.code}`.slice(0, 191),
      message:
        `${nguoiDung.fullName} (${nguoiDung.email}) đã ${chieu} kho theo yêu cầu ${yeuCau.code} ` +
        `— ${dong.length} dòng: ${tom}${dong.length > 5 ? ', …' : ''}. Không qua bước duyệt.`,
      requestId: yeuCau.id,
      entityType: 'request',
      entityId: yeuCau.id,
    },
  });
  return true;
}

export async function xuatKho(
  id: string,
  duLieu: DuLieuXuatKho,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
  tuyChon: TuyChonGhiNhan = {},
): Promise<YeuCauDayDu> {
  const actor = nguoiDung;
  const yeuCau = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    select: CHON_YEU_CAU,
  });
  if (!yeuCau) throw loi404('Không tìm thấy yêu cầu.');

  if (!laLoaiXuat(yeuCau.type)) {
    throw loi409('Loại yêu cầu này không phải xuất kho.');
  }
  if (!TRANG_THAI_CHO_THUC_HIEN.has(yeuCau.status)) {
    throw loi422(
      `Yêu cầu đang ở trạng thái "${yeuCau.status}" nên không xuất kho được.`,
      'KHONG_O_TRANG_THAI_THUC_HIEN',
    );
  }
  kiemNoiDen(yeuCau.type, yeuCau.toLocation?.id ?? null);
  kiemTruongGuiNhan(yeuCau.type, yeuCau.fromLocation?.id ?? null, yeuCau.toLocation?.id ?? null);

  const dong = await soatDongThucHien(yeuCau, duLieu.muc, 'ANH_XUAT', tuyChon.boQuaAnh ?? false);
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
  const truocTrangThai = yeuCau.status;
  let daBaoQuanTri = false;

  const sau = await prisma.$transaction(async (tx) => {
    await khoaPhieuVaThietBi(
      tx,
      id,
      dong.map((d) => d.assetId),
    );
    const nguon = await nguonXuatTheoDong(
      yeuCau,
      dong,
      duLieu.tuLocationId ?? null,
      tx,
    );
    kiemQuyenThucHien(nguoiDung, yeuCau, nguon, 'xuất');

    // Luồng C chưa ghi bút toán lúc xuất — quản lý xác nhận bàn giao mới ghi —
    // nên phải nhớ hàng ĐI TỪ ĐÂU vào phiếu. Một phiếu chỉ được lấy từ một nơi.
    const cacNguon = new Set(nguon.values());
    if (choXacNhan && cacNguon.size > 1) {
      throw loi422(
        'Phân bổ / luân chuyển chỉ được lấy hàng từ MỘT nơi trong một phiếu. Chọn "Lấy từ" hoặc tách phiếu.',
        'NHIEU_NGUON',
      );
    }
    /*
     * LUÂN CHUYỂN: nơi đi là TRƯỜNG GỬI ghi trên phiếu (in lên biên bản là bên
     * giao). Lấy hàng ở chỗ khác thì biên bản sai bên giao — chặn, phải sửa phiếu.
     * Phân bổ thì cho chọn kho khác lúc xuất, và nơi lấy thật được GHI LẠI vào
     * phiếu ngay dưới: kiểm tồn, "đang chuyển" và bút toán lúc xác nhận phải trừ
     * cùng một chỗ. Trước đây phiếu giữ nơi đi cũ — kiểm tồn ở kho B, lúc xác
     * nhận lại trừ ở kho A.
     */
    const nguonThat = cacNguon.size === 1 ? [...cacNguon][0] : undefined;
    if (
      choXacNhan &&
      yeuCau.type === 'LUAN_CHUYEN_TRUONG' &&
      yeuCau.fromLocation &&
      nguonThat !== yeuCau.fromLocation.id
    ) {
      throw loi422(
        `Luân chuyển phải lấy hàng từ trường gửi ghi trên phiếu (${yeuCau.fromLocation.name}). ` +
          'Muốn đổi trường gửi thì sửa phiếu trước.',
        'NGUON_KHAC_PHIEU',
      );
    }

    // KHÔNG ĐƯỢC XUẤT NHIỀU HƠN SỐ DÙNG ĐƯỢC Ở NƠI LẤY.
    //
    // "Dùng được" = tồn sổ sách − phần đã xuất đi theo luồng C mà bên nhận chưa
    // xác nhận. Trước đây chỉ trừ tồn sổ sách, nên hai phiếu phân bổ 80 cùng lấy
    // từ một kho chỉ có 80 đều lọt qua, và khi cả hai trường xác nhận thì tồn
    // kho thành −80 — con số không thể có thật.
    const conLaiSau = new Map<string, number>();
    for (const d of dong) {
      const tuDau = nguon.get(d.assetId);
      if (!tuDau) continue;
      const dungDuoc = await tonDungDuoc(d.assetId, tuDau, tx);
      if (d.soLuong > dungDuoc) {
        const ten = (await tx.location.findUnique({ where: { id: tuDau }, select: { name: true } }))?.name;
        throw loi422(
          `Thiết bị ${d.code}: khai mang ra ${d.soLuong} nhưng ${ten ?? 'nơi lấy'} chỉ còn ${Math.max(0, dungDuoc)} dùng được. Kiểm lại số lượng hoặc chọn nơi lấy khác.`,
          'KHONG_DU_TON',
          { ma: d.code, khai: d.soLuong, conLai: Math.max(0, dungDuoc) },
        );
      }
      conLaiSau.set(d.assetId, dungDuoc - d.soLuong);
    }

    for (const d of dong) {
      const tuDau = nguon.get(d.assetId) ?? null;
      let movementId: string | null = null;

      // Loại phải chờ bên nhận xác nhận thì CHƯA ghi movement: hàng còn trên
      // đường, quyền sở hữu chưa đổi (luồng C). Mọi trường hợp khác — kể cả cho
      // nhân sự mượn — đều ghi movement để tồn kho suy ra đúng.
      if (!choXacNhan) {
        const movement = await tx.movement.create({
          data: {
            assetId: d.assetId,
            type: yeuCau.type === 'CHO_MUON' ? 'CHO_MUON' : 'XUAT_KHO',
            fromLocationId: tuDau,
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
       * `current_location_id` ghi được đúng MỘT nơi, mà hàng lẻ nằm rải nhiều
       * nơi cùng lúc. Tồn thật vẫn suy từ `movements` (nguyên tắc bất biến #5)
       * và nơi lấy hàng giờ xác định theo tồn thật, nên cột này chỉ còn là "đang
       * chủ yếu nằm đâu" để lọc nhanh. Thiết bị theo đơn vị luôn đi trọn vẹn.
       */
      const dayHetKhoiNguon = (conLaiSau.get(d.assetId) ?? 0) <= 0;

      await tx.asset.update({
        where: { id: d.assetId },
        data: {
          ...(dayHetKhoiNguon ? { allocationStatus: trangThaiMoi } : {}),
          ...(choXacNhan || !dayHetKhoiNguon ? {} : { currentLocationId: noiDenId }),
          // Người mượn LUÔN được gắn, kể cả khi kho còn hàng: không gắn thì phần
          // hàng lẻ đang nằm trong tay họ biến mất khỏi phạm vi họ xem được.
          ...(muonNoiBo ? { holderUserId: yeuCau.createdBy.id } : {}),
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
            layTu: tuDau,
            currentLocationId: choXacNhan || !dayHetKhoiNguon ? d.currentLocationId : noiDenId,
            nguoiGiu: muonNoiBo ? yeuCau.createdBy.email : null,
            allocationStatus: dayHetKhoiNguon
              ? trangThaiMoi
              : yeuCau.items.find((i) => i.asset.id === d.assetId)?.asset.allocationStatus,
            conLaiONguon: Math.max(0, conLaiSau.get(d.assetId) ?? 0),
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

    const motNguon = cacNguon.size === 1 ? [...cacNguon][0] : undefined;
    const capNhat = await tx.request.update({
      where: { id },
      data: {
        status: choXacNhan ? 'DA_XUAT' : 'DA_HOAN_TAT',
        issuedAt: bayGio,
        ...(yeuCau.submittedAt ? {} : { submittedAt: bayGio }),
        ...(choXacNhan ? {} : { completedAt: bayGio }),
        // Luồng C cần nơi đi THẬT để lúc xác nhận bàn giao trừ đúng chỗ — ghi
        // đè cả nơi đi người lập đã chọn nếu lúc xuất kho lấy ở kho khác.
        ...(choXacNhan && motNguon ? { fromLocationId: motNguon } : {}),
      },
      select: CHON_YEU_CAU,
    });

    daBaoQuanTri = await baoQuanTriTuThucHien(tx, nguoiDung, yeuCau, 'xuất', dong);

    await ghiAudit(
      {
        actor,
        action: 'request.xuat_kho',
        entityType: 'request',
        entityId: id,
        beforeValue: { status: truocTrangThai },
        afterValue: {
          status: capNhat.status,
          soDong: dong.length,
          khongQuaDuyet: !yeuCau.approvedBy,
          ...(tuyChon.nguonGhiNhan ? { nguonGhiNhan: tuyChon.nguonGhiNhan } : {}),
        },
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
      ? `Yêu cầu ${sau.code} đã xuất, chờ Quản trị / Vận hành xác nhận bàn giao.`
      : `Yêu cầu ${sau.code} đã hoàn tất.`,
  });
  if (choXacNhan && noiDenId) {
    phatChoDiaDiem(noiDenId, SU_KIEN.YEU_CAU_DOI, {
      id: sau.id,
      code: sau.code,
      status: sau.status,
      thongDiep: `Có lô thiết bị đang chuyển tới trường bạn.`,
    });
  }
  // Phân bổ / luân chuyển: quản trị / vận hành phải biết có phiếu chờ họ xác
  // nhận bàn giao — kể cả khi chính quản trị là người xuất.
  if (choXacNhan) {
    phatChoNguoiDuyet(SU_KIEN.YEU_CAU_DOI, {
      id: sau.id,
      code: sau.code,
      status: sau.status,
      thongDiep: `Phiếu ${sau.code} đã xuất, chờ bạn xác nhận bàn giao.`,
    });
  }
  if (daBaoQuanTri) {
    phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
      id: sau.id,
      code: sau.code,
      thongDiep: `${nguoiDung.fullName} vừa xuất kho ${sau.code} (không qua duyệt).`,
    });
  }
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  return sau;
}

/**
 * HÀNG NHẬN VỀ THÌ LẤY ĐI TỪ ĐÂU?
 *
 * "Nhập kho" và "trả về kho" giờ là MỘT việc với người dùng: hàng đi vào kho.
 * Nên nơi đi phải xác định rõ, không đoán bừa — đoán sai là cộng kho mà nơi kia
 * không giảm (đếm hai lần) hoặc trừ nhầm sổ một trường khác.
 *
 * Thứ tự, dừng ở cái đầu tiên có:
 *   1. Người thực hiện chọn "Nhận từ" trên màn hình nhập kho (`NGOAI` = hàng mới
 *      từ ngoài vào, hoặc người mượn trả).
 *   2. "Nhận từ" ghi trên phiếu.
 *   3. Thiết bị theo đơn vị: nơi nó đang nằm (null = đang trong tay người mượn).
 *      Đã nằm sẵn ở chính kho nhận thì CHẶN — nhập lần nữa là một con robot
 *      thành hai.
 *   4. Hàng lẻ, phiếu loại TRA_VE_KHO cũ: nơi DUY NHẤT còn tồn ngoài kho nhận;
 *      nhiều nơi thì báo để chọn.
 *   5. Hàng lẻ, phiếu NHAP_KHO không ghi nơi đi: hàng từ NGOÀI vào (mua mới,
 *      người mượn trả). Form bắt buộc chọn "Nhận từ" nên đây là lựa chọn có chủ ý.
 */
async function nguonNhapTheoDong(
  yeuCau: YeuCauDayDu,
  dong: DongDaSoat[],
  khoNhanId: string,
  tuLocationId: string | null,
  tx: PrismaTx,
): Promise<Map<string, string | null>> {
  const ra = new Map<string, string | null>();
  // "Hàng mới" và "nhân sự trả" đều đến từ NGOÀI mọi điểm — không trừ ở đâu.
  const khaiNgoai = tuLocationId === NGUON_NGOAI || tuLocationId === NGUON_NHAN_SU;
  const khaiSan = khaiNgoai ? null : (tuLocationId ?? yeuCau.fromLocation?.id ?? null);
  for (const d of dong) {
    const kieu = yeuCau.items.find((i) => i.asset.id === d.assetId)?.asset.trackingType;
    if (kieu === 'DON_VI') {
      // Một con robot chỉ ở một chỗ — sự thật nằm ở tồn, không ở lời khai.
      const ton = await tonCuaTaiSan(d.assetId, tx);
      const dangO = ton.theoDiaDiem.find((t) => t.ton > 0)?.locationId ?? null;
      if (dangO === khoNhanId) {
        throw loi422(
          `Thiết bị ${d.code} đang nằm sẵn ở kho này rồi — nhập lần nữa sẽ thành hai cái.`,
          'DA_O_KHO',
          { ma: d.code },
        );
      }
      ra.set(d.assetId, dangO);
      continue;
    }
    if (khaiNgoai) {
      ra.set(d.assetId, null);
      continue;
    }
    if (khaiSan) {
      ra.set(d.assetId, khaiSan);
      continue;
    }
    if (yeuCau.type === 'NHAP_KHO') {
      ra.set(d.assetId, null);
      continue;
    }
    const ton = await tonCuaTaiSan(d.assetId, tx);
    const noiCon = ton.theoDiaDiem.filter((t) => t.ton > 0 && t.locationId !== khoNhanId);
    if (noiCon.length === 0) {
      ra.set(d.assetId, null);
    } else if (noiCon.length === 1) {
      ra.set(d.assetId, noiCon[0]?.locationId ?? null);
    } else {
      const ten = await tx.location.findMany({
        where: { id: { in: noiCon.map((t) => t.locationId) } },
        select: { id: true, name: true },
      });
      throw loi422(
        `Thiết bị ${d.code} đang nằm ở ${noiCon.length} nơi ` +
          `(${ten.map((t) => t.name).join(', ')}) nên không tự biết lô này trả về từ đâu. ` +
          'Chọn "Nhận từ" trên màn hình Nhập kho.',
        'KHONG_RO_NOI_TRA_VE',
        { ma: d.code, noiCon: ten },
      );
    }
  }
  return ra;
}

/**
 * Số HÀNG LẺ đang nằm trong tay nhân sự mượn (chưa trả), suy từ bút toán:
 * Σ cho mượn ra khỏi hệ thống − Σ trả về từ ngoài hệ thống.
 */
async function dangChoNhanSuMuon(assetId: string, tx: PrismaTx): Promise<number> {
  const [ra, ve] = await Promise.all([
    tx.movement.aggregate({
      where: { assetId, type: 'CHO_MUON', toLocationId: null },
      _sum: { quantity: true },
    }),
    tx.movement.aggregate({
      where: { assetId, type: 'TRA_VE_KHO', fromLocationId: null },
      _sum: { quantity: true },
    }),
  ]);
  return (ra._sum.quantity ?? 0) - (ve._sum.quantity ?? 0);
}

/** Số hàng lẻ MỘT NGƯỜI đang mượn (theo các phiếu cho mượn họ lập) mà chưa trả. */
async function dangMuonCuaNguoi(assetId: string, userId: string, tx: PrismaTx): Promise<number> {
  const [ra, ve] = await Promise.all([
    tx.movement.aggregate({
      where: { assetId, type: 'CHO_MUON', toLocationId: null, request: { createdById: userId } },
      _sum: { quantity: true },
    }),
    tx.movement.aggregate({
      where: { assetId, type: 'TRA_VE_KHO', fromLocationId: null, request: { createdById: userId } },
      _sum: { quantity: true },
    }),
  ]);
  return (ra._sum.quantity ?? 0) - (ve._sum.quantity ?? 0);
}

export async function nhapKho(
  id: string,
  duLieu: DuLieuNhapKho,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
  tuyChon: TuyChonGhiNhan = {},
): Promise<YeuCauDayDu> {
  const actor = nguoiDung;
  const yeuCau = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    select: CHON_YEU_CAU,
  });
  if (!yeuCau) throw loi404('Không tìm thấy yêu cầu.');
  if (!laLoaiNhap(yeuCau.type)) {
    throw loi409('Loại yêu cầu này không phải nhập kho / trả về kho.');
  }
  if (!TRANG_THAI_CHO_THUC_HIEN.has(yeuCau.status)) {
    throw loi422(
      `Yêu cầu đang ở trạng thái "${yeuCau.status}" nên không nhập kho được.`,
      'KHONG_O_TRANG_THAI_THUC_HIEN',
    );
  }

  const kho = await prisma.location.findFirst({
    // `deletedAt: null`: không nhập hàng về một điểm đã nằm trong thùng rác —
    // nhập được thì thiết bị nằm ở một nơi không còn hiện ở đâu cả.
    where: { id: duLieu.veLocationId, deletedAt: null },
    select: { id: true, name: true, type: true },
  });
  if (!kho) throw loi400('Kho nhận hàng về không tồn tại hoặc đã bị xoá.', 'KHO_KHONG_TON_TAI');
  // Nhập kho là VỀ KHO — không để một lần "nhập kho" đặt hàng xuống một trường.
  if (!LOAI_DIEM_KHO.has(kho.type)) {
    throw loi422(`"${kho.name}" không phải kho nên không nhập kho về đó được.`, 'KHONG_PHAI_KHO');
  }

  const dong = await soatDongThucHien(yeuCau, duLieu.muc, 'ANH_NHAN', tuyChon.boQuaAnh ?? false);
  const tinhTrangTheoAsset = new Map(duLieu.muc.map((m) => [m.assetId, m.tinhTrang]));
  const bayGio = new Date();
  const canhBao: Array<{ code: string; truoc: AssetCondition; sau: AssetCondition }> = [];
  const truocTrangThai = yeuCau.status;
  let daBaoQuanTri = false;

  const sau = await prisma.$transaction(async (tx) => {
    await khoaPhieuVaThietBi(
      tx,
      id,
      dong.map((d) => d.assetId),
    );
    const nguon = await nguonNhapTheoDong(
      yeuCau,
      dong,
      kho.id,
      duLieu.tuLocationId ?? null,
      tx,
    );
    kiemQuyenThucHien(nguoiDung, yeuCau, nguon, 'nhập');

    /*
     * NHÂN SỰ TRẢ LẠI hàng lẻ đã mượn — phải ghi là TRẢ VỀ, không phải nhập mới.
     *
     * Cho mượn 5 trong 100 quyển thì trạng thái vẫn "tại kho" (còn 95), nên trước
     * đây trả lại qua phiếu Nhập kho bị ghi thành hàng mới: kho cộng đúng nhưng
     * số "nhân sự đang mượn" không bao giờ giảm. Giờ coi là trả về khi người dùng
     * chọn "Nhân sự trả lại", hoặc khi chính người lập phiếu đang mượn đủ số đó.
     * Chọn "Hàng mới" thì luôn là nhập mới.
     */
    const traNhanSu = new Set<string>();
    const khongRoNguon =
      !duLieu.tuLocationId && !yeuCau.fromLocation && yeuCau.type === 'NHAP_KHO';
    for (const d of dong) {
      const kieu = yeuCau.items.find((i) => i.asset.id === d.assetId)?.asset.trackingType;
      if (kieu !== 'SO_LUONG' || nguon.get(d.assetId)) continue;
      if (duLieu.tuLocationId === NGUON_NHAN_SU) {
        const dangMuon = await dangChoNhanSuMuon(d.assetId, tx);
        if (d.soLuong > dangMuon) {
          throw loi422(
            `Thiết bị ${d.code}: khai trả ${d.soLuong} nhưng nhân sự chỉ đang mượn ${Math.max(0, dangMuon)}. ` +
              'Phần dư là hàng mới thì lập phiếu nhập riêng, chọn "Hàng mới / từ bên ngoài".',
            'VUOT_SO_DANG_MUON',
            { ma: d.code, khai: d.soLuong, dangMuon },
          );
        }
        traNhanSu.add(d.assetId);
      } else if (
        khongRoNguon &&
        (await dangMuonCuaNguoi(d.assetId, yeuCau.createdBy.id, tx)) >= d.soLuong
      ) {
        traNhanSu.add(d.assetId);
      }
    }

    // KHÔNG ĐƯỢC TRẢ VỀ NHIỀU HƠN SỐ ĐANG CÓ Ở NƠI TRẢ. Thiếu phép kiểm này thì
    // trả 30 từ một trường chỉ còn 20 sẽ đẩy tồn của trường đó xuống −10; tồn âm
    // là con số không thể có thật, mà mọi báo cáo sau đó đều lấy từ nó.
    for (const d of dong) {
      const tuDau = nguon.get(d.assetId) ?? null;
      if (!tuDau) continue;
      // Tồn DÙNG ĐƯỢC: hàng đã lên xe đi trường (phân bổ / luân chuyển chưa xác
      // nhận) không còn ở nơi trả — nhận nó về kho khác thì lúc xác nhận bàn
      // giao nơi gửi không còn hàng, phiếu kẹt mãi.
      const dangCo = Math.max(0, await tonDungDuoc(d.assetId, tuDau, tx));
      if (d.soLuong > dangCo) {
        throw loi422(
          `Thiết bị ${d.code}: khai nhận về ${d.soLuong} nhưng nơi trả chỉ còn ${dangCo} ` +
            '(đã trừ hàng đang trên đường đi). Kiểm lại số lượng hoặc chọn đúng nơi trả về.',
          'KHONG_DU_TON_NOI_TRA',
          { ma: d.code, khai: d.soLuong, conLai: dangCo },
        );
      }
    }

    for (const d of dong) {
      const tinhTrangMoi = tinhTrangTheoAsset.get(d.assetId) ?? d.condition;
      const tuDau = nguon.get(d.assetId) ?? null;
      const dong0 = yeuCau.items.find((i) => i.asset.id === d.assetId)?.asset;
      const dangMuon = dong0?.allocationStatus === 'CHO_MUON';
      const laTraVe =
        tuDau !== null || dangMuon || yeuCau.type === 'TRA_VE_KHO' || traNhanSu.has(d.assetId);

      const movement = await tx.movement.create({
        data: {
          assetId: d.assetId,
          type: laTraVe ? 'TRA_VE_KHO' : 'NHAP_KHO',
          fromLocationId: tuDau,
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

      /*
       * HÀNG LẺ TRẢ MỘT PHẦN thì KHÔNG xoá người giữ / hạn trả / trạng thái.
       *
       * Trước đây nhập kho luôn đặt lại cả dòng: trả 30 trong 60 quyển đang mượn
       * là 30 quyển còn lại mất người giữ, mất hạn trả, rơi khỏi "Đang cho mượn"
       * và khỏi cảnh báo quá hạn. Giờ chỉ đặt lại khi nơi trả (hoặc người mượn)
       * không còn gì. Thiết bị theo đơn vị luôn về trọn vẹn nên đặt lại như cũ.
       */
      let veHet = true;
      if (dong0?.trackingType === 'SO_LUONG') {
        if (tuDau) {
          veHet = (await tonTaiDiaDiem(d.assetId, tuDau, tx)) <= 0;
        } else if (dangMuon || (await dangChoNhanSuMuon(d.assetId, tx)) > 0) {
          veHet = (await dangChoNhanSuMuon(d.assetId, tx)) <= 0;
        }
      }

      await tx.asset.update({
        where: { id: d.assetId },
        data: {
          condition: tinhTrangMoi,
          ...(veHet
            ? {
                currentLocationId: kho.id,
                allocationStatus: 'TAI_KHO',
                holderUserId: null,
                dueReturnAt: null,
              }
            : {}),
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
            currentLocationId: veHet ? kho.id : d.currentLocationId,
            nhanTu: tuDau,
            condition: tinhTrangMoi,
            ...(veHet ? { allocationStatus: 'TAI_KHO' } : {}),
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

    const cacNguon = new Set(nguon.values());
    const motNguon = cacNguon.size === 1 ? [...cacNguon][0] : undefined;
    const capNhat = await tx.request.update({
      where: { id },
      data: {
        status: 'DA_HOAN_TAT',
        issuedAt: bayGio,
        completedAt: bayGio,
        ...(yeuCau.submittedAt ? {} : { submittedAt: bayGio }),
        // Ghi lại kho nhận và nơi đi đã xác định, để biên bản điền đúng hai bên.
        ...(yeuCau.toLocation ? {} : { toLocationId: kho.id }),
        ...(motNguon && !yeuCau.fromLocation ? { fromLocationId: motNguon } : {}),
      },
      select: CHON_YEU_CAU,
    });

    daBaoQuanTri = await baoQuanTriTuThucHien(tx, nguoiDung, yeuCau, 'nhập', dong);

    await ghiAudit(
      {
        actor,
        action: 'request.nhap_kho',
        entityType: 'request',
        entityId: id,
        beforeValue: { status: truocTrangThai },
        afterValue: {
          status: 'DA_HOAN_TAT',
          soDong: dong.length,
          veKho: kho.name,
          khongQuaDuyet: !yeuCau.approvedBy,
          ...(tuyChon.nguonGhiNhan ? { nguonGhiNhan: tuyChon.nguonGhiNhan } : {}),
        },
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
  if (canhBao.length > 0 || daBaoQuanTri) {
    phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
      id: sau.id,
      code: sau.code,
      thongDiep:
        canhBao.length > 0
          ? `${canhBao.length} thiết bị đổi tình trạng khi trả về kho.`
          : `${nguoiDung.fullName} vừa nhập kho ${sau.code} (không qua duyệt).`,
    });
  }
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  return sau;
}

/**
 * GHI NHẬN BÀN GIAO THEO BIÊN BẢN ĐÃ XUẤT.
 *
 * VÌ SAO CÓ HÀM NÀY. Người dùng lập yêu cầu → duyệt → bấm "Xuất biên bản" là đã
 * có tờ giấy hai bên ký, hàng rời kho ngay lúc đó. Nhưng tồn kho và tình trạng
 * chỉ đổi ở bước "Xuất kho" (màn hình riêng, bắt buộc chụp ảnh), nên nếu không
 * ai bấm bước đó thì hệ thống vẫn báo thiết bị nằm nguyên trong kho.
 *
 * ĐÃ DỰNG LẠI THẬT: duyệt một yêu cầu CHO_MUON rồi xuất biên bản BBBG-2026-0065
 * — file .docx ra đúng, mà thiết bị vẫn `TAI_KHO`, không có người giữ, dashboard
 * "Đang cho mượn" vẫn 0. Tờ giấy nói đã bàn giao, dữ liệu nói chưa: hai nguồn
 * cùng một việc mà nói ngược nhau.
 *
 * BẰNG CHỨNG THAY THẾ, KHÔNG PHẢI BỎ BẰNG CHỨNG. Nguyên tắc bất biến #3 đòi mọi
 * lần hàng đổi chỗ phải có bằng chứng; mặc định là ảnh chụp tại chỗ. Lối này đòi
 * ĐÚNG MỘT thứ khác thay cho ảnh: file biên bản .docx ĐÃ XUẤT, có tên và chữ ký
 * hai bên, lưu trong hệ thống. Chưa xuất file thì hàm này từ chối. Mọi phép kiểm
 * còn lại (đã duyệt, đủ tồn, không vượt số đã duyệt, đúng thiết bị của phiếu)
 * vẫn chạy y như lối thường vì dùng chung `xuatKho` / `nhapKho`.
 *
 * KHÔNG tự chạy khi xuất biên bản. Người dùng phải bấm riêng một nút có xác nhận
 * — nếu không thì cái nút "Xuất biên bản" vốn chỉ để in giấy lại âm thầm trừ kho,
 * và người ở kho mất luôn cơ hội chụp ảnh ở lối thường.
 */
export async function ghiNhanTheoBienBan(
  id: string,
  actor: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<YeuCauDayDu> {
  const yeuCau = await prisma.request.findFirst({
    where: { id, deletedAt: null },
    select: CHON_YEU_CAU,
  });
  if (!yeuCau) throw loi404('Không tìm thấy yêu cầu.');
  if (!laLoaiXuat(yeuCau.type) && !laLoaiNhap(yeuCau.type)) {
    throw loi409('Loại yêu cầu này không làm thay đổi tồn kho nên không có gì để ghi nhận.');
  }
  if (!TRANG_THAI_CHO_THUC_HIEN.has(yeuCau.status)) {
    throw loi422(
      yeuCau.status === 'DA_XUAT' || yeuCau.status === 'DA_HOAN_TAT'
        ? 'Yêu cầu này đã được ghi nhận rồi — tồn kho và tình trạng đã đổi.'
        : `Yêu cầu đang ở trạng thái "${yeuCau.status}" nên không ghi nhận được.`,
      'KHONG_O_TRANG_THAI_GHI_NHAN',
    );
  }

  // BẮT BUỘC có file biên bản: đây là bằng chứng thay cho ảnh.
  const bienBan = await prisma.handoverNote.findFirst({
    where: {
      requestId: id,
      deletedAt: null,
      status: { not: 'TU_CHOI' },
      filePath: { not: null },
    },
    select: { id: true, code: true, receiverLocationId: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!bienBan) {
    throw loi422(
      'Chưa có file biên bản bàn giao cho yêu cầu này. Bấm "Xuất biên bản" trước, ' +
        'hoặc dùng màn hình Xuất kho / Nhập kho nếu muốn ghi nhận kèm ảnh chụp.',
      'CHUA_CO_FILE_BIEN_BAN',
    );
  }

  const nguon = `Ghi nhận theo biên bản ${bienBan.code}`;
  const muc = yeuCau.items.map((d) => ({
    assetId: d.asset.id,
    // Dòng phải quét mã: đưa đúng mã của thiết bị trong phiếu — biên bản đã ghi
    // rõ từng mã nên không có gì để quét lại.
    ...(d.asset.category.yeuCauQuetMa ? { maDaQuet: d.asset.code } : { tenDaKhai: d.asset.name }),
    anhIds: [] as string[],
    quantity: d.quantity,
    ghiChu: nguon,
  }));

  if (laLoaiXuat(yeuCau.type)) {
    return xuatKho(id, { muc, ghiChu: nguon }, actor, ctx, {
      boQuaAnh: true,
      nguonGhiNhan: bienBan.code,
    });
  }

  /*
   * Nhập kho phải biết VỀ KHO NÀO. Yêu cầu nhập không bắt buộc chọn nơi đến
   * (`CAN_NOI_DEN` không có NHAP_KHO / TRA_VE_KHO), nên lấy theo thứ tự: nơi đến
   * của phiếu → bên nhận ghi trên biên bản. Không có cả hai thì KHÔNG đoán: nhập
   * hàng về một kho đoán ra là làm sai sổ của một kho không liên quan.
   */
  // Cuối cùng: hệ thống chỉ có MỘT kho văn phòng thì đó là kho nhận — không
  // phải đoán gì.
  const khoDuyNhat = await prisma.location.findMany({
    where: { deletedAt: null, isActive: true, type: 'KHO_VAN_PHONG' },
    select: { id: true },
    take: 2,
  });
  const veLocationId =
    yeuCau.toLocation?.id ??
    bienBan.receiverLocationId ??
    (khoDuyNhat.length === 1 ? (khoDuyNhat[0]?.id ?? null) : null);
  if (!veLocationId) {
    throw loi422(
      'Yêu cầu và biên bản đều chưa ghi rõ kho nhận hàng về. Mở màn hình Nhập kho để chọn kho.',
      'THIEU_KHO_NHAN',
    );
  }
  return nhapKho(
    id,
    {
      veLocationId,
      // Tình trạng giữ nguyên như đang ghi trong hệ thống: lối này không có ai
      // mở thùng ra kiểm, nên không được tự khai là "TỐT".
      muc: muc.map((m) => ({ ...m, tinhTrang: laTinhTrangCua(yeuCau, m.assetId) })),
      ghiChu: nguon,
    },
    actor,
    ctx,
    { boQuaAnh: true, nguonGhiNhan: bienBan.code },
  );
}

/** Tình trạng đang ghi trong hệ thống của một thiết bị thuộc yêu cầu. */
function laTinhTrangCua(yeuCau: YeuCauDayDu, assetId: string): AssetCondition {
  const dong = yeuCau.items.find((i) => i.asset.id === assetId);
  return dong?.asset.condition ?? 'TOT';
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

/**
 * Ghi nhận theo biên bản: vai trò nào được làm nghiệp vụ kho. Tài khoản trường
 * được vào — giới hạn "chỉ phiếu đi từ trường mình" kiểm tiếp ở
 * `kiemQuyenThucHien` bên trong xuất / nhập kho.
 */
export function batBuocQuyenThucHien(nguoiDung: NguoiDungDaXacThuc): void {
  if (!phamViCua(nguoiDung).toanBoKho && nguoiDung.role !== 'TRUONG') {
    throw loi403('Vai trò của bạn không thực hiện xuất / nhập kho được.');
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
  /*
   * HÀNG ĐANG TRÊN ĐƯỜNG thì không xoá được phiếu. Phân bổ / luân chuyển chỉ ghi
   * di chuyển lúc quản lý xác nhận bàn giao; xoá phiếu giữa chừng thì số "đang
   * chuyển" biến mất khỏi tổng quan, còn biên bản xác nhận sau đó không biết ghi
   * hàng vào đâu — hàng mất khỏi sổ. Quản lý xác nhận hoặc huỷ bàn giao
   * trước (từ chối thì phiếu tự huỷ, hàng tính lại ở nơi gửi), rồi mới xoá.
   */
  if (truoc.status === 'DA_XUAT') {
    throw loi409(
      `Phiếu ${truoc.code} đang chờ xác nhận bàn giao — hàng đang trên đường. ` +
        'Quản trị / Vận hành xác nhận bàn giao hoặc huỷ phiếu trước rồi mới xoá được.',
      { maLoi: 'DANG_TREN_DUONG' },
    );
  }

  await prisma.$transaction(async (tx) => {
    // Kiểm lại SAU KHI KHOÁ dòng phiếu: xuất kho chạy song song có thể vừa đưa
    // phiếu sang "Đã xuất" — xoá lúc đó là hàng trên xe biến khỏi sổ.
    const khoa = await tx.$queryRaw<Array<{ status: string; deleted_at: Date | null }>>(
      Prisma.sql`SELECT status, deleted_at FROM requests WHERE id = ${id} FOR UPDATE`,
    );
    if (khoa[0]?.deleted_at) throw loi409('Yêu cầu này đã nằm trong thùng rác.');
    if (khoa[0]?.status === 'DA_XUAT') {
      throw loi409(
        `Phiếu ${truoc.code} vừa xuất kho, đang chờ xác nhận bàn giao — không xoá được.`,
        { maLoi: 'DANG_TREN_DUONG' },
      );
    }
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
