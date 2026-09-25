/**
 * NHẬP LIỆU HÀNG LOẠT — luồng G.
 *
 * Quy tắc xương sống: **xem trước rồi mới ghi, và ghi thì ghi tất hoặc không
 * ghi gì**. Bước xem trước trả lỗi theo TỪNG DÒNG; bước ghi kiểm lại lần nữa
 * rồi chạy trong MỘT transaction, nên chỉ cần một dòng sai là không dòng nào
 * được ghi vào CSDL.
 */
import type { Prisma } from '@prisma/client';
import {
  KIEU_QUAN_LY,
  LOAI_DIEM_LUU_TRU,
  NHAN_KIEU_QUAN_LY,
  NHAN_LOAI_DIEM_LUU_TRU,
  NHAN_TINH_TRANG,
  TINH_TRANG,
} from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { loi422 } from '../../lib/loi-http.js';
import { chuanHoaDeSo, doiNhanSangMa, nhanHopLe, type OMotDong } from '../../lib/excel.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';

// ---------------------------------------------------------------- kiểu dữ liệu

export interface LoiDong {
  /** Số dòng đúng như trong file Excel (dòng 1 là tiêu đề). */
  dong: number;
  cot: string;
  thongDiep: string;
}

export interface KetQuaXemTruoc<T> {
  tongDong: number;
  soHopLe: number;
  soLoi: number;
  loi: LoiDong[];
  /** Bản xem trước các dòng hợp lệ (giới hạn để phản hồi không quá to). */
  xemTruoc: T[];
}

// ------------------------------------------------------------------- cột Excel

export const COT_THIET_BI = [
  { tieuDe: 'Mã thiết bị *', rong: 18 },
  { tieuDe: 'Tên thiết bị *', rong: 34 },
  { tieuDe: 'Mã loại tài sản *', rong: 18 },
  { tieuDe: 'Mã dòng giải pháp', rong: 18 },
  { tieuDe: 'Serial NSX', rong: 18 },
  { tieuDe: 'Nguồn gốc *', rong: 20 },
  { tieuDe: 'Ghi chú nguồn gốc', rong: 26 },
  { tieuDe: 'Ngày nhập (NĂM-THÁNG-NGÀY)', rong: 24 },
  { tieuDe: 'Giá trị (VND)', rong: 16 },
  { tieuDe: 'Mục đích sử dụng *', rong: 20 },
  { tieuDe: 'Kiểu quản lý *', rong: 20 },
  { tieuDe: 'Tình trạng *', rong: 16 },
  { tieuDe: 'Mã điểm nhập về *', rong: 20 },
  { tieuDe: 'Số lượng nhập *', rong: 15 },
  { tieuDe: 'Ghi chú', rong: 40 },
] as const;

export const COT_DIA_DIEM = [
  { tieuDe: 'Mã điểm *', rong: 20 },
  { tieuDe: 'Tên điểm *', rong: 34 },
  { tieuDe: 'Loại điểm *', rong: 20 },
  { tieuDe: 'Địa chỉ', rong: 40 },
  { tieuDe: 'Người phụ trách', rong: 24 },
  { tieuDe: 'Số điện thoại', rong: 16 },
  { tieuDe: 'Vĩ độ', rong: 14 },
  { tieuDe: 'Kinh độ', rong: 14 },
  { tieuDe: 'Bán kính GPS (m)', rong: 16 },
  { tieuDe: 'Ghi chú', rong: 40 },
] as const;

// ------------------------------------------------------------- bộ đổi nhãn→mã

// Nguồn gốc và mục đích KHÔNG có bộ đổi nhãn dựng sẵn ở đây: danh sách hợp lệ
// nằm trong CSDL và người dùng đổi được bất cứ lúc nào, nên phải dựng lại mỗi
// lần soát file (xem `dungTraCuu`).
const maKieuQuanLy = doiNhanSangMa(KIEU_QUAN_LY, NHAN_KIEU_QUAN_LY);
const maTinhTrang = doiNhanSangMa(TINH_TRANG, NHAN_TINH_TRANG);
const maLoaiDiem = doiNhanSangMa(LOAI_DIEM_LUU_TRU, NHAN_LOAI_DIEM_LUU_TRU);

// ------------------------------------------------------------------ tiện ích

const MA_HOP_LE = /^[A-Z0-9][A-Z0-9._-]*$/;

function lay(d: OMotDong, cot: string): string {
  return (d[cot] ?? '').trim();
}

function doiSo(chu: string): number | null {
  // Chấp nhận "1.200.000", "1,200,000" và "1200000"
  const sach = chu.replace(/[.,\s]/g, '');
  if (sach === '') return null;
  const n = Number(sach);
  return Number.isFinite(n) ? n : null;
}

function doiSoThapPhan(chu: string): number | null {
  const sach = chu.replace(/\s/g, '').replace(',', '.');
  if (sach === '') return null;
  const n = Number(sach);
  return Number.isFinite(n) ? n : null;
}

function doiNgay(chu: string): Date | null {
  const khop = /^(\d{4})-(\d{2})-(\d{2})$/.exec(chu.trim());
  if (!khop) return null;
  const d = new Date(`${khop[1]}-${khop[2]}-${khop[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ==================================================== NHẬP THIẾT BỊ

export interface DongThietBiHopLe {
  dong: number;
  code: string;
  name: string;
  categoryId: string;
  categoryCode: string;
  productLineId: string | null;
  serialNumber: string | null;
  originId: string;
  originNote: string | null;
  receivedDate: Date;
  value: number | null;
  purposeId: string;
  trackingType: (typeof KIEU_QUAN_LY)[number];
  condition: (typeof TINH_TRANG)[number];
  nhapVeLocationId: string;
  nhapVeCode: string;
  soLuongNhap: number;
  note: string | null;
}

interface BangNhan {
  /** Mã HOẶC nhãn đã chuẩn hoá → id. */
  theoNhan: Map<string, string>;
  /** Danh sách nhãn đang hợp lệ, để nhét vào thông điệp lỗi. */
  nhanHopLe: string;
}

interface TraCuu {
  loai: Map<string, string>;
  dong: Map<string, string>;
  diem: Map<string, string>;
  maDaCo: Set<string>;
  nguonGoc: BangNhan;
  mucDich: BangNhan;
}

/**
 * Dựng bảng tra "người dùng gõ gì" → id, cho nguồn gốc và mục đích.
 *
 * Nhận cả MÃ lẫn TÊN, vì file mẫu ghi tên tiếng Việt mà người quen tay vẫn gõ
 * mã. Chỉ lấy mục đang dùng: mục đã Ngừng dùng thì không nên nhập thêm thiết bị
 * mới vào đó — nhưng thiết bị CŨ đang mang mục đó vẫn nguyên, không đụng tới.
 */
function dungBangNhan(hang: ReadonlyArray<{ id: string; code: string; name: string }>): BangNhan {
  const theoNhan = new Map<string, string>();
  for (const h of hang) {
    theoNhan.set(chuanHoaDeSo(h.code), h.id);
    theoNhan.set(chuanHoaDeSo(h.name), h.id);
  }
  return { theoNhan, nhanHopLe: hang.map((h) => h.name).join(' / ') };
}

async function dungTraCuu(): Promise<TraCuu> {
  const [loai, dong, diem, taiSan, nguonGoc, mucDich] = await Promise.all([
    prisma.assetCategory.findMany({ select: { id: true, code: true } }),
    prisma.productLine.findMany({ select: { id: true, code: true } }),
    prisma.location.findMany({ select: { id: true, code: true } }),
    // CỐ Ý KHÔNG lọc `deletedAt: null` ở đây. Thiết bị trong thùng rác vẫn giữ mã
    // của nó trong khoá duy nhất, nên nếu bỏ nó ra khỏi danh sách "mã đã có" thì
    // file nhập liệu trùng mã sẽ qua được bước soát rồi vỡ ở bước ghi với lỗi khoá
    // duy nhất của CSDL — thông điệp đó người dùng không hiểu gì.
    prisma.asset.findMany({ select: { code: true } }),
    prisma.assetOrigin.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true },
    }),
    prisma.assetPurpose.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true },
    }),
  ]);
  return {
    loai: new Map(loai.map((x) => [x.code.toUpperCase(), x.id])),
    dong: new Map(dong.map((x) => [x.code.toUpperCase(), x.id])),
    diem: new Map(diem.map((x) => [x.code.toUpperCase(), x.id])),
    maDaCo: new Set(taiSan.map((x) => x.code.toUpperCase())),
    nguonGoc: dungBangNhan(nguonGoc),
    mucDich: dungBangNhan(mucDich),
  };
}

/**
 * Soát toàn bộ file thiết bị. KHÔNG ghi gì vào CSDL.
 * Mỗi dòng có thể sinh nhiều lỗi — người dùng sửa một lượt thay vì sửa từng vòng.
 */
export async function soatThietBi(
  dongFile: OMotDong[],
  dongDauTien: number,
): Promise<{ loi: LoiDong[]; hopLe: DongThietBiHopLe[] }> {
  const traCuu = await dungTraCuu();
  const loi: LoiDong[] = [];
  const hopLe: DongThietBiHopLe[] = [];
  /** Mã đã gặp trong CHÍNH file này → bắt trùng nội bộ file. */
  const daGapTrongFile = new Map<string, number>();

  dongFile.forEach((d, i) => {
    const soDong = dongDauTien + i;
    if (Object.keys(d).length === 0) return;

    // Mốc để biết dòng này có sinh lỗi nào không: CHỈ dòng sạch hoàn toàn mới
    // được coi là hợp lệ. Nhờ vậy `soHopLe + số dòng lỗi` luôn khớp tổng dòng,
    // và không có dòng nào vừa bị báo lỗi vừa nằm trong danh sách sẽ ghi.
    const soLoiTruocDong = loi.length;
    const them = (cot: string, thongDiep: string): void => {
      loi.push({ dong: soDong, cot, thongDiep });
    };

    // --- mã thiết bị
    const code = lay(d, 'Mã thiết bị *').toUpperCase();
    let maOk = true;
    if (!code) {
      them('Mã thiết bị *', 'Chưa điền mã thiết bị.');
      maOk = false;
    } else if (code.length < 3 || code.length > 64) {
      them('Mã thiết bị *', 'Mã thiết bị phải dài 3–64 ký tự.');
      maOk = false;
    } else if (!MA_HOP_LE.test(code)) {
      them('Mã thiết bị *', 'Mã chỉ gồm chữ in hoa, số và các dấu . _ -');
      maOk = false;
    } else if (traCuu.maDaCo.has(code)) {
      them('Mã thiết bị *', `Mã ${code} đã có trong hệ thống.`);
      maOk = false;
    } else if (daGapTrongFile.has(code)) {
      them('Mã thiết bị *', `Mã ${code} bị trùng với dòng ${daGapTrongFile.get(code)} trong file.`);
      maOk = false;
    }
    if (code && maOk) daGapTrongFile.set(code, soDong);

    // --- tên
    const name = lay(d, 'Tên thiết bị *');
    if (!name) them('Tên thiết bị *', 'Chưa điền tên thiết bị.');
    else if (name.length < 2) them('Tên thiết bị *', 'Tên thiết bị quá ngắn.');

    // --- loại tài sản
    const categoryCode = lay(d, 'Mã loại tài sản *').toUpperCase();
    const categoryId = categoryCode ? traCuu.loai.get(categoryCode) : undefined;
    if (!categoryCode) them('Mã loại tài sản *', 'Chưa điền mã loại tài sản.');
    else if (!categoryId) {
      them('Mã loại tài sản *', `Không có loại tài sản mã "${categoryCode}".`);
    }

    // --- dòng giải pháp (không bắt buộc)
    const productLineCode = lay(d, 'Mã dòng giải pháp').toUpperCase();
    let productLineId: string | null = null;
    if (productLineCode) {
      const tim = traCuu.dong.get(productLineCode);
      if (!tim) them('Mã dòng giải pháp', `Không có dòng giải pháp mã "${productLineCode}".`);
      else productLineId = tim;
    }

    // --- nguồn gốc
    const nguonGocChu = lay(d, 'Nguồn gốc *');
    const originId = nguonGocChu
      ? (traCuu.nguonGoc.theoNhan.get(chuanHoaDeSo(nguonGocChu)) ?? null)
      : null;
    if (!nguonGocChu) them('Nguồn gốc *', 'Chưa điền nguồn gốc.');
    else if (!originId) {
      // Nêu đúng danh sách ĐANG có trong CSDL, không phải một danh sách cứng —
      // người dùng vừa thêm "Phụ huynh tặng" thì lỗi phải kể cả cái đó.
      them(
        'Nguồn gốc *',
        `"${nguonGocChu}" không hợp lệ. Chọn: ${traCuu.nguonGoc.nhanHopLe}. Muốn dùng giá trị khác thì vào Danh mục → Nguồn gốc thêm trước.`,
      );
    }

    // --- mục đích
    const mucDichChu = lay(d, 'Mục đích sử dụng *');
    const purposeId = mucDichChu
      ? (traCuu.mucDich.theoNhan.get(chuanHoaDeSo(mucDichChu)) ?? null)
      : null;
    if (!mucDichChu) them('Mục đích sử dụng *', 'Chưa điền mục đích sử dụng.');
    else if (!purposeId) {
      them(
        'Mục đích sử dụng *',
        `"${mucDichChu}" không hợp lệ. Chọn: ${traCuu.mucDich.nhanHopLe}. Muốn dùng giá trị khác thì vào Danh mục → Mục đích sử dụng thêm trước.`,
      );
    }

    // --- kiểu quản lý
    const kieuChu = lay(d, 'Kiểu quản lý *');
    const trackingType = kieuChu ? maKieuQuanLy(kieuChu) : null;
    if (!kieuChu) them('Kiểu quản lý *', 'Chưa điền kiểu quản lý.');
    else if (!trackingType) {
      them('Kiểu quản lý *', `"${kieuChu}" không hợp lệ. Chọn: ${nhanHopLe(KIEU_QUAN_LY, NHAN_KIEU_QUAN_LY)}.`);
    }

    // --- tình trạng
    const tinhTrangChu = lay(d, 'Tình trạng *');
    const condition = tinhTrangChu ? maTinhTrang(tinhTrangChu) : null;
    if (!tinhTrangChu) them('Tình trạng *', 'Chưa điền tình trạng.');
    else if (!condition) {
      them('Tình trạng *', `"${tinhTrangChu}" không hợp lệ. Chọn: ${nhanHopLe(TINH_TRANG, NHAN_TINH_TRANG)}.`);
    }

    // --- điểm nhập về
    const nhapVeCode = lay(d, 'Mã điểm nhập về *').toUpperCase();
    const nhapVeLocationId = nhapVeCode ? traCuu.diem.get(nhapVeCode) : undefined;
    if (!nhapVeCode) them('Mã điểm nhập về *', 'Chưa điền mã điểm nhập về.');
    else if (!nhapVeLocationId) them('Mã điểm nhập về *', `Không có điểm lưu trữ mã "${nhapVeCode}".`);

    // --- số lượng
    const soLuongChu = lay(d, 'Số lượng nhập *');
    let soLuongNhap = soLuongChu === '' ? 1 : doiSo(soLuongChu);
    if (soLuongNhap === null || !Number.isInteger(soLuongNhap) || soLuongNhap < 1) {
      them('Số lượng nhập *', `"${soLuongChu}" không phải số nguyên dương.`);
      soLuongNhap = null;
    } else if (trackingType === 'DON_VI' && soLuongNhap !== 1) {
      them(
        'Số lượng nhập *',
        'Thiết bị quản lý theo từng đơn vị phải có số lượng bằng 1 (mỗi cái một mã).',
      );
      soLuongNhap = null;
    }

    // --- giá trị
    const giaTriChu = lay(d, 'Giá trị (VND)');
    let value: number | null = null;
    if (giaTriChu !== '') {
      const n = doiSo(giaTriChu);
      if (n === null || n < 0) them('Giá trị (VND)', `"${giaTriChu}" không phải số tiền hợp lệ.`);
      else value = n;
    }

    // --- ngày nhập
    const ngayChu = lay(d, 'Ngày nhập (NĂM-THÁNG-NGÀY)');
    let receivedDate: Date | null = new Date();
    if (ngayChu !== '') {
      const n = doiNgay(ngayChu);
      if (!n) {
        them('Ngày nhập (NĂM-THÁNG-NGÀY)', `"${ngayChu}" không đúng dạng NĂM-THÁNG-NGÀY, ví dụ 2026-03-15.`);
        receivedDate = null;
      } else receivedDate = n;
    }

    // Viết thẳng điều kiện (không qua biến trung gian) để TypeScript thu hẹp
    // được các giá trị có thể null bên dưới.
    if (
      loi.length === soLoiTruocDong &&
      maOk &&
      code !== '' &&
      name.length >= 2 &&
      categoryId !== undefined &&
      originId !== null &&
      purposeId !== null &&
      trackingType !== null &&
      condition !== null &&
      nhapVeLocationId !== undefined &&
      soLuongNhap !== null &&
      receivedDate !== null
    ) {
      hopLe.push({
        dong: soDong,
        code,
        name,
        categoryId,
        categoryCode,
        productLineId,
        serialNumber: lay(d, 'Serial NSX') || null,
        originId,
        originNote: lay(d, 'Ghi chú nguồn gốc') || null,
        receivedDate,
        value,
        purposeId,
        trackingType,
        condition,
        nhapVeLocationId,
        nhapVeCode,
        soLuongNhap,
        note: lay(d, 'Ghi chú') || null,
      });
    }
  });

  return { loi, hopLe };
}

/**
 * Ghi thật. Soát LẠI từ đầu (dữ liệu có thể đã đổi giữa lúc xem trước và lúc
 * bấm ghi), còn lỗi thì từ chối toàn bộ — KHÔNG ghi dòng nào.
 */
export async function ghiThietBi(
  dongFile: OMotDong[],
  dongDauTien: number,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<{ soDaGhi: number }> {
  const { loi, hopLe } = await soatThietBi(dongFile, dongDauTien);

  if (loi.length > 0) {
    throw loi422(
      `File còn ${loi.length} lỗi nên KHÔNG ghi dòng nào. Hãy sửa file rồi nhập lại.`,
      'FILE_CON_LOI',
      { soLoi: loi.length, loi: loi.slice(0, 200) },
    );
  }
  if (hopLe.length === 0) {
    throw loi422('File không có dòng dữ liệu nào để nhập.', 'FILE_RONG');
  }

  // Tất cả hoặc không gì cả.
  await prisma.$transaction(async (tx) => {
    for (const d of hopLe) {
      const taiSan = await tx.asset.create({
        data: {
          code: d.code,
          name: d.name,
          categoryId: d.categoryId,
          productLineId: d.productLineId,
          serialNumber: d.serialNumber,
          originId: d.originId,
          originNote: d.originNote,
          receivedDate: d.receivedDate,
          value: d.value,
          purposeId: d.purposeId,
          trackingType: d.trackingType,
          condition: d.condition,
          currentLocationId: d.nhapVeLocationId,
          allocationStatus: 'TAI_KHO',
          note: d.note,
          createdById: actor.id,
        },
        select: { id: true },
      });
      // Gốc tồn kho — giống hệt đường tạo thủ công.
      await tx.movement.create({
        data: {
          assetId: taiSan.id,
          type: 'NHAP_BAN_DAU',
          fromLocationId: null,
          toLocationId: d.nhapVeLocationId,
          quantity: d.soLuongNhap,
          conditionAfter: d.condition,
          performedById: actor.id,
          performedAt: d.receivedDate,
          note: 'Nhập ban đầu qua nhập liệu hàng loạt.',
        },
      });
    }

    await ghiAudit(
      {
        actor,
        action: 'asset.import',
        entityType: 'asset',
        entityId: null,
        afterValue: { soDong: hopLe.length, ma: hopLe.slice(0, 50).map((d) => d.code) },
        note: `Nhập hàng loạt ${hopLe.length} thiết bị từ file.`,
        ...ctx,
      },
      tx,
    );
  });

  return { soDaGhi: hopLe.length };
}

// ==================================================== NHẬP ĐIỂM LƯU TRỮ

export interface DongDiaDiemHopLe {
  dong: number;
  code: string;
  name: string;
  type: (typeof LOAI_DIEM_LUU_TRU)[number];
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  gpsRadiusM: number | null;
  note: string | null;
}

export async function soatDiaDiem(
  dongFile: OMotDong[],
  dongDauTien: number,
): Promise<{ loi: LoiDong[]; hopLe: DongDiaDiemHopLe[] }> {
  const daCo = new Set(
    (await prisma.location.findMany({ select: { code: true } })).map((x) => x.code.toUpperCase()),
  );
  const loi: LoiDong[] = [];
  const hopLe: DongDiaDiemHopLe[] = [];
  const daGapTrongFile = new Map<string, number>();

  dongFile.forEach((d, i) => {
    const soDong = dongDauTien + i;
    if (Object.keys(d).length === 0) return;
    // Xem chú thích ở soatThietBi: dòng có bất kỳ lỗi nào đều không hợp lệ.
    const soLoiTruocDong = loi.length;
    const them = (cot: string, thongDiep: string): void => {
      loi.push({ dong: soDong, cot, thongDiep });
    };

    const code = lay(d, 'Mã điểm *').toUpperCase();
    let maOk = true;
    if (!code) {
      them('Mã điểm *', 'Chưa điền mã điểm.');
      maOk = false;
    } else if (!MA_HOP_LE.test(code) || code.length < 2 || code.length > 64) {
      them('Mã điểm *', 'Mã điểm dài 2–64 ký tự, chỉ gồm chữ in hoa, số và các dấu . _ -');
      maOk = false;
    } else if (daCo.has(code)) {
      them('Mã điểm *', `Mã ${code} đã có trong hệ thống.`);
      maOk = false;
    } else if (daGapTrongFile.has(code)) {
      them('Mã điểm *', `Mã ${code} bị trùng với dòng ${daGapTrongFile.get(code)} trong file.`);
      maOk = false;
    }
    if (code && maOk) daGapTrongFile.set(code, soDong);

    const name = lay(d, 'Tên điểm *');
    if (!name) them('Tên điểm *', 'Chưa điền tên điểm.');
    else if (name.length < 2) them('Tên điểm *', 'Tên điểm quá ngắn.');

    const loaiChu = lay(d, 'Loại điểm *');
    const type = loaiChu ? maLoaiDiem(loaiChu) : null;
    if (!loaiChu) them('Loại điểm *', 'Chưa điền loại điểm.');
    else if (!type) {
      them(
        'Loại điểm *',
        `"${loaiChu}" không hợp lệ. Chọn: ${nhanHopLe(LOAI_DIEM_LUU_TRU, NHAN_LOAI_DIEM_LUU_TRU)}.`,
      );
    }

    const sdt = lay(d, 'Số điện thoại');
    if (sdt && !/^[0-9+\s.-]{8,20}$/.test(sdt)) {
      them('Số điện thoại', `"${sdt}" không phải số điện thoại hợp lệ.`);
    }

    const viChu = lay(d, 'Vĩ độ');
    const kinhChu = lay(d, 'Kinh độ');
    let latitude: number | null = null;
    let longitude: number | null = null;
    let toaDoOk = true;

    if ((viChu === '') !== (kinhChu === '')) {
      them('Vĩ độ', 'Vĩ độ và kinh độ phải cùng điền hoặc cùng để trống.');
      toaDoOk = false;
    } else if (viChu !== '') {
      const vi = doiSoThapPhan(viChu);
      const kinh = doiSoThapPhan(kinhChu);
      if (vi === null || vi < -90 || vi > 90) {
        them('Vĩ độ', `"${viChu}" không phải vĩ độ hợp lệ (-90 đến 90).`);
        toaDoOk = false;
      } else latitude = vi;
      if (kinh === null || kinh < -180 || kinh > 180) {
        them('Kinh độ', `"${kinhChu}" không phải kinh độ hợp lệ (-180 đến 180).`);
        toaDoOk = false;
      } else longitude = kinh;
    }

    const banKinhChu = lay(d, 'Bán kính GPS (m)');
    let gpsRadiusM: number | null = null;
    let banKinhOk = true;
    if (banKinhChu !== '') {
      const n = doiSo(banKinhChu);
      if (n === null || !Number.isInteger(n) || n < 20 || n > 50_000) {
        them('Bán kính GPS (m)', `"${banKinhChu}" phải là số nguyên từ 20 đến 50000.`);
        banKinhOk = false;
      } else gpsRadiusM = n;
    }

    if (loi.length === soLoiTruocDong && maOk && code && name.length >= 2 && type && toaDoOk && banKinhOk) {
      hopLe.push({
        dong: soDong,
        code,
        name,
        type,
        address: lay(d, 'Địa chỉ') || null,
        contactName: lay(d, 'Người phụ trách') || null,
        contactPhone: sdt || null,
        latitude,
        longitude,
        gpsRadiusM,
        note: lay(d, 'Ghi chú') || null,
      });
    }
  });

  return { loi, hopLe };
}

export async function ghiDiaDiem(
  dongFile: OMotDong[],
  dongDauTien: number,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<{ soDaGhi: number }> {
  const { loi, hopLe } = await soatDiaDiem(dongFile, dongDauTien);

  if (loi.length > 0) {
    throw loi422(
      `File còn ${loi.length} lỗi nên KHÔNG ghi dòng nào. Hãy sửa file rồi nhập lại.`,
      'FILE_CON_LOI',
      { soLoi: loi.length, loi: loi.slice(0, 200) },
    );
  }
  if (hopLe.length === 0) throw loi422('File không có dòng dữ liệu nào để nhập.', 'FILE_RONG');

  await prisma.$transaction(async (tx) => {
    const duLieu: Prisma.LocationCreateManyInput[] = hopLe.map((d) => ({
      code: d.code,
      name: d.name,
      type: d.type,
      address: d.address,
      contactName: d.contactName,
      contactPhone: d.contactPhone,
      latitude: d.latitude,
      longitude: d.longitude,
      gpsRadiusM: d.gpsRadiusM,
      note: d.note,
    }));
    await tx.location.createMany({ data: duLieu });
    await ghiAudit(
      {
        actor,
        action: 'location.import',
        entityType: 'location',
        entityId: null,
        afterValue: { soDong: hopLe.length, ma: hopLe.slice(0, 50).map((d) => d.code) },
        note: `Nhập hàng loạt ${hopLe.length} điểm lưu trữ từ file.`,
        ...ctx,
      },
      tx,
    );
  });

  return { soDaGhi: hopLe.length };
}
