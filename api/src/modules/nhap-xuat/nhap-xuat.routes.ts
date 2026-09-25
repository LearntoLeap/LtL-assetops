/**
 * Nhập/xuất Excel. Ba nhóm endpoint:
 *   - /mau/...        tải file mẫu (kèm sheet hướng dẫn liệt kê mã hợp lệ)
 *   - /xem-truoc/...  soát file, trả lỗi theo từng dòng, KHÔNG ghi gì
 *   - /ghi/...        ghi thật, tất cả hoặc không gì cả
 *   - /xuat/...       xuất toàn bộ dữ liệu ra Excel
 */
import { Router } from 'express';
import multer from 'multer';
import {
  DS_KIEU_QUAN_LY,
  DS_LOAI_DIEM_LUU_TRU,
  DS_TINH_TRANG,
  NHAN_KIEU_QUAN_LY,
  NHAN_LOAI_DIEM_LUU_TRU,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_PHAN_BO,
} from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import { loi400 } from '../../lib/loi-http.js';
import { docFileBang, KIEU_XLSX, taoWorkbook, themSheet, xuatBuffer } from '../../lib/excel.js';
import { tonTatCa } from '../../lib/ton-kho.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';
import {
  COT_DIA_DIEM,
  COT_THIET_BI,
  ghiDiaDiem,
  ghiThietBi,
  soatDiaDiem,
  soatThietBi,
} from './nhap-xuat.service.js';

export const nhapXuatRouter = Router();
nhapXuatRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau, yeuCauVaiTro('ADMIN', 'VAN_HANH', 'KHO'));

const GIOI_HAN_BYTE = 8 * 1024 * 1024;

const nhanTep = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: GIOI_HAN_BYTE, files: 1 },
  fileFilter(_req, tep, tiep) {
    if (/\.(xlsx|xls|csv)$/i.test(tep.originalname)) tiep(null, true);
    else tiep(new Error('Chỉ nhận file .xlsx, .xls hoặc .csv.'));
  },
}).single('tep');

/** Bọc multer để lỗi của nó thành phản hồi JSON tiếng Việt. */
const nhanTepAnToan: import('express').RequestHandler = (req, res, next) => {
  nhanTep(req, res, (loi: unknown) => {
    if (!loi) {
      next();
      return;
    }
    if (loi instanceof multer.MulterError) {
      next(
        loi.code === 'LIMIT_FILE_SIZE'
          ? loi400(`File quá lớn. Giới hạn ${GIOI_HAN_BYTE / 1024 / 1024}MB.`, 'FILE_QUA_LON')
          : loi400(`Không nhận được file: ${loi.message}`, 'FILE_KHONG_HOP_LE'),
      );
      return;
    }
    next(loi400(loi instanceof Error ? loi.message : 'File không hợp lệ.', 'FILE_KHONG_HOP_LE'));
  });
};

function layTep(req: import('express').Request): { buffer: Buffer; ten: string } {
  const tep = req.file;
  if (!tep) throw loi400('Chưa chọn file để tải lên (trường "tep").', 'THIEU_FILE');
  return { buffer: tep.buffer, ten: tep.originalname };
}

function guiXlsx(res: import('express').Response, ten: string, duLieu: Buffer): void {
  res.setHeader('Content-Type', KIEU_XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${ten}"`);
  res.setHeader('Content-Length', String(duLieu.length));
  res.end(duLieu);
}

function ngayHomNay(): string {
  return new Date().toISOString().slice(0, 10);
}

// ------------------------------------------------------------------- FILE MẪU

nhapXuatRouter.get(
  '/mau/thiet-bi',
  batAsync(async (_req, res) => {
    const [loai, dong, diem, nguonGoc, mucDich] = await Promise.all([
      prisma.assetCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true, defaultTrackingType: true },
      }),
      prisma.productLine.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true },
      }),
      prisma.location.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { name: 'asc' },
        select: { code: true, name: true, type: true },
      }),
      // Hai danh sách này giờ nằm trong CSDL: file mẫu phải nêu đúng những gì
      // hiện có, không phải một danh sách cứng in sẵn trong mã nguồn.
      prisma.assetOrigin.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { name: true },
      }),
      prisma.assetPurpose.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { name: true },
      }),
    ]);
    // Người dùng xoá sạch được cả hai bảng, lúc đó ví dụ để trống còn hơn ghi
    // một giá trị không tồn tại rồi họ nhập vào là báo lỗi.
    const nguonGocViDu = nguonGoc[0]?.name ?? '';
    const mucDichViDu = mucDich[0]?.name ?? '';

    const wb = taoWorkbook();
    const sheet = themSheet(wb, 'Thiết bị', COT_THIET_BI);

    // Hai dòng ví dụ để người dùng thấy ngay định dạng mong đợi.
    const maLoaiDauTien = loai[0]?.code ?? 'ROBOT';
    const maDiemDauTien = diem.find((d) => d.type === 'KHO_VAN_PHONG')?.code ?? diem[0]?.code ?? 'KHO-VP';
    sheet.addRow([
      'LTL-RB-9001',
      'Robot mẫu (xoá dòng này trước khi nhập)',
      maLoaiDauTien,
      dong[0]?.code ?? '',
      'SN-0001',
      nguonGocViDu,
      '',
      ngayHomNay(),
      '12500000',
      mucDichViDu,
      NHAN_KIEU_QUAN_LY.DON_VI,
      NHAN_TINH_TRANG.TOT,
      maDiemDauTien,
      '1',
      'Bộ gồm: …',
    ]);
    sheet.addRow([
      'LTL-AP-9001',
      'Ấn phẩm mẫu (xoá dòng này trước khi nhập)',
      loai.find((l) => l.defaultTrackingType === 'SO_LUONG')?.code ?? 'AN_PHAM_IN',
      '',
      '',
      nguonGocViDu,
      '',
      ngayHomNay(),
      '28000',
      mucDichViDu,
      NHAN_KIEU_QUAN_LY.SO_LUONG,
      NHAN_TINH_TRANG.TOT,
      maDiemDauTien,
      '500',
      'Đơn vị: cuốn',
    ]);

    // Sheet hướng dẫn: liệt kê đúng những giá trị hệ thống chấp nhận.
    const hd = wb.addWorksheet('Hướng dẫn');
    hd.columns = [{ width: 26 }, { width: 40 }, { width: 30 }];
    const tieuDeNhom = (chu: string): void => {
      const h = hd.addRow([chu]);
      h.font = { bold: true, size: 12 };
    };
    hd.addRow(['CÁCH DÙNG']).font = { bold: true, size: 14 };
    hd.addRow(['1. Xoá hai dòng ví dụ trong sheet "Thiết bị".']);
    hd.addRow(['2. Điền dữ liệu. Cột có dấu * là bắt buộc.']);
    hd.addRow(['3. Tải file lên màn hình Nhập liệu hàng loạt để xem trước.']);
    hd.addRow(['4. Sửa hết lỗi rồi mới bấm Ghi — còn một lỗi là không dòng nào được ghi.']);
    hd.addRow([]);
    tieuDeNhom('MÃ LOẠI TÀI SẢN');
    hd.addRow(['Mã', 'Tên', 'Kiểu quản lý mặc định']).font = { bold: true };
    for (const l of loai) {
      hd.addRow([l.code, l.name, NHAN_KIEU_QUAN_LY[l.defaultTrackingType]]);
    }
    hd.addRow([]);
    tieuDeNhom('MÃ DÒNG GIẢI PHÁP (không bắt buộc)');
    hd.addRow(['Mã', 'Tên']).font = { bold: true };
    for (const d of dong) hd.addRow([d.code, d.name]);
    hd.addRow([]);
    tieuDeNhom('MÃ ĐIỂM LƯU TRỮ');
    hd.addRow(['Mã', 'Tên', 'Loại']).font = { bold: true };
    for (const d of diem) hd.addRow([d.code, d.name, NHAN_LOAI_DIEM_LUU_TRU[d.type]]);
    hd.addRow([]);
    tieuDeNhom('GIÁ TRỊ CHO CÁC CỘT CHỌN');
    hd.addRow(['Nguồn gốc *', nguonGoc.map((x) => x.name).join(' / ')]);
    hd.addRow(['Mục đích sử dụng *', mucDich.map((x) => x.name).join(' / ')]);
    hd.addRow(['Kiểu quản lý *', DS_KIEU_QUAN_LY.map((x) => x.nhan).join(' / ')]);
    hd.addRow(['Tình trạng *', DS_TINH_TRANG.map((x) => x.nhan).join(' / ')]);
    hd.addRow([]);
    hd.addRow(['LƯU Ý', 'Thiết bị "Theo từng đơn vị" bắt buộc số lượng = 1 (mỗi cái một mã).']);
    hd.addRow(['', 'Thiết bị "Theo số lượng" dùng một mã cho nhiều cái (ấn phẩm, phụ kiện).']);

    guiXlsx(res, `mau-nhap-thiet-bi-${ngayHomNay()}.xlsx`, await xuatBuffer(wb));
  }),
);

nhapXuatRouter.get(
  '/mau/dia-diem',
  batAsync(async (_req, res) => {
    const wb = taoWorkbook();
    const sheet = themSheet(wb, 'Điểm lưu trữ', COT_DIA_DIEM);
    sheet.addRow([
      'TRUONG-VIDU',
      'Trường Tiểu học Ví Dụ (xoá dòng này trước khi nhập)',
      NHAN_LOAI_DIEM_LUU_TRU.DIEM_TRUONG,
      'Số 1, Quận X, Hà Nội',
      'Cô Nguyễn Văn A',
      '0900000000',
      '',
      '',
      '',
      '',
    ]);
    sheet.addRow([
      'KHO-VIDU',
      'Kho ví dụ (xoá dòng này trước khi nhập)',
      NHAN_LOAI_DIEM_LUU_TRU.KHO_VAN_PHONG,
      'Số 2, Quận Y, Hà Nội',
      'Bộ phận Kho',
      '0900000001',
      '21.0012345',
      '105.8123456',
      '150',
      'Kho có khoá vị trí',
    ]);

    const hd = wb.addWorksheet('Hướng dẫn');
    hd.columns = [{ width: 26 }, { width: 70 }];
    hd.addRow(['CÁCH DÙNG']).font = { bold: true, size: 14 };
    hd.addRow(['1. Xoá hai dòng ví dụ.']);
    hd.addRow(['2. Cột có dấu * là bắt buộc.']);
    hd.addRow(['3. Vĩ độ/Kinh độ phải cùng điền hoặc cùng để trống.']);
    hd.addRow(['4. Chỉ điểm KHO mới cần toạ độ + bán kính (khoá vị trí tài khoản kho).']);
    hd.addRow([]);
    hd.addRow(['Loại điểm *', DS_LOAI_DIEM_LUU_TRU.map((x) => x.nhan).join(' / ')]);
    hd.addRow(['Bán kính GPS (m)', 'Số nguyên 20–50000. Để trống thì dùng mặc định của hệ thống.']);

    guiXlsx(res, `mau-nhap-dia-diem-${ngayHomNay()}.xlsx`, await xuatBuffer(wb));
  }),
);

// ------------------------------------------------------------------ XEM TRƯỚC

nhapXuatRouter.post(
  '/xem-truoc/thiet-bi',
  nhanTepAnToan,
  batAsync(async (req, res) => {
    const tep = layTep(req);
    const doc = await docFileBang(tep.buffer, tep.ten);
    const { loi, hopLe } = await soatThietBi(doc.dong, doc.dongDauTien);
    res.json({
      ok: true,
      tenTep: tep.ten,
      tongDong: doc.dong.filter((d) => Object.keys(d).length > 0).length,
      soHopLe: hopLe.length,
      soLoi: loi.length,
      loi,
      xemTruoc: hopLe.slice(0, 50),
    });
  }),
);

nhapXuatRouter.post(
  '/xem-truoc/dia-diem',
  nhanTepAnToan,
  batAsync(async (req, res) => {
    const tep = layTep(req);
    const doc = await docFileBang(tep.buffer, tep.ten);
    const { loi, hopLe } = await soatDiaDiem(doc.dong, doc.dongDauTien);
    res.json({
      ok: true,
      tenTep: tep.ten,
      tongDong: doc.dong.filter((d) => Object.keys(d).length > 0).length,
      soHopLe: hopLe.length,
      soLoi: loi.length,
      loi,
      xemTruoc: hopLe.slice(0, 50),
    });
  }),
);

// ------------------------------------------------------------------------ GHI

nhapXuatRouter.post(
  '/ghi/thiet-bi',
  nhanTepAnToan,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const tep = layTep(req);
    const doc = await docFileBang(tep.buffer, tep.ten);
    const kq = await ghiThietBi(doc.dong, doc.dongDauTien, actor, boiCanh(req));
    res.json({ ok: true, ...kq, thongDiep: `Đã nhập ${kq.soDaGhi} thiết bị.` });
  }),
);

nhapXuatRouter.post(
  '/ghi/dia-diem',
  nhanTepAnToan,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const tep = layTep(req);
    const doc = await docFileBang(tep.buffer, tep.ten);
    const kq = await ghiDiaDiem(doc.dong, doc.dongDauTien, actor, boiCanh(req));
    res.json({ ok: true, ...kq, thongDiep: `Đã nhập ${kq.soDaGhi} điểm lưu trữ.` });
  }),
);

// ----------------------------------------------------------------------- XUẤT

nhapXuatRouter.get(
  '/xuat/thiet-bi',
  batAsync(async (_req, res) => {
    const [thietBi, ton, diem] = await Promise.all([
      prisma.asset.findMany({
        // File xuất ra là ảnh chụp danh sách thiết bị ĐANG có — không kèm thiết
        // bị đã xoá, nếu không thì nhập lại file đó là dựng lại cả cái đã xoá.
        where: { deletedAt: null },
        orderBy: { code: 'asc' },
        include: {
          category: { select: { code: true, name: true } },
          productLine: { select: { code: true, name: true } },
          currentLocation: { select: { code: true, name: true } },
          holder: { select: { fullName: true } },
          origin: { select: { name: true } },
          purpose: { select: { name: true } },
        },
      }),
      tonTatCa(),
      prisma.location.findMany({ select: { id: true, name: true } }),
    ]);

    const tenDiem = new Map(diem.map((d) => [d.id, d.name]));
    const tonTheoTaiSan = new Map<string, number>();
    const tonChiTiet = new Map<string, string[]>();
    for (const t of ton) {
      tonTheoTaiSan.set(t.assetId, (tonTheoTaiSan.get(t.assetId) ?? 0) + t.ton);
      const ds = tonChiTiet.get(t.assetId) ?? [];
      ds.push(`${tenDiem.get(t.locationId) ?? '?'}: ${t.ton}`);
      tonChiTiet.set(t.assetId, ds);
    }

    const wb = taoWorkbook();
    const sheet = themSheet(wb, 'Thiết bị', [
      { tieuDe: 'Mã thiết bị', rong: 18 },
      { tieuDe: 'Tên thiết bị', rong: 34 },
      { tieuDe: 'Loại tài sản', rong: 20 },
      { tieuDe: 'Dòng giải pháp', rong: 18 },
      { tieuDe: 'Serial NSX', rong: 18 },
      { tieuDe: 'Nguồn gốc', rong: 20 },
      { tieuDe: 'Ngày nhập', rong: 14 },
      { tieuDe: 'Giá trị (VND)', rong: 16 },
      { tieuDe: 'Mục đích sử dụng', rong: 18 },
      { tieuDe: 'Kiểu quản lý', rong: 18 },
      { tieuDe: 'Tình trạng', rong: 16 },
      { tieuDe: 'Trạng thái phân bổ', rong: 20 },
      { tieuDe: 'Vị trí hiện tại', rong: 28 },
      { tieuDe: 'Người đang giữ', rong: 22 },
      { tieuDe: 'Tổng tồn', rong: 12 },
      { tieuDe: 'Tồn theo điểm', rong: 40 },
      { tieuDe: 'Hạn trả', rong: 14 },
      { tieuDe: 'Đang theo dõi', rong: 14 },
      { tieuDe: 'Ghi chú', rong: 44 },
    ]);

    for (const t of thietBi) {
      sheet.addRow([
        t.code,
        t.name,
        t.category.name,
        t.productLine?.name ?? '',
        t.serialNumber ?? '',
        t.origin.name,
        t.receivedDate ? t.receivedDate.toISOString().slice(0, 10) : '',
        t.value === null ? '' : Number(t.value),
        t.purpose.name,
        NHAN_KIEU_QUAN_LY[t.trackingType],
        NHAN_TINH_TRANG[t.condition],
        NHAN_TRANG_THAI_PHAN_BO[t.allocationStatus],
        t.currentLocation?.name ?? '',
        t.holder?.fullName ?? '',
        tonTheoTaiSan.get(t.id) ?? 0,
        (tonChiTiet.get(t.id) ?? []).join('; '),
        t.dueReturnAt ? t.dueReturnAt.toISOString().slice(0, 10) : '',
        t.isActive ? 'Có' : 'Không',
        t.note ?? '',
      ]);
    }

    guiXlsx(res, `thiet-bi-${ngayHomNay()}.xlsx`, await xuatBuffer(wb));
  }),
);

nhapXuatRouter.get(
  '/xuat/dia-diem',
  batAsync(async (_req, res) => {
    const diem = await prisma.location.findMany({
      // Bản xuất là ảnh chụp danh sách đang dùng, không kèm thùng rác.
      where: { deletedAt: null },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
    });

    const wb = taoWorkbook();
    const sheet = themSheet(wb, 'Điểm lưu trữ', [
      { tieuDe: 'Mã điểm', rong: 20 },
      { tieuDe: 'Tên điểm', rong: 34 },
      { tieuDe: 'Loại điểm', rong: 20 },
      { tieuDe: 'Địa chỉ', rong: 40 },
      { tieuDe: 'Người phụ trách', rong: 24 },
      { tieuDe: 'Số điện thoại', rong: 16 },
      { tieuDe: 'Vĩ độ', rong: 14 },
      { tieuDe: 'Kinh độ', rong: 14 },
      { tieuDe: 'Bán kính GPS (m)', rong: 16 },
      { tieuDe: 'Số thiết bị đang ở đây', rong: 20 },
      { tieuDe: 'Đang dùng', rong: 12 },
      { tieuDe: 'Ghi chú', rong: 40 },
    ]);

    for (const d of diem) {
      sheet.addRow([
        d.code,
        d.name,
        NHAN_LOAI_DIEM_LUU_TRU[d.type],
        d.address ?? '',
        d.contactName ?? '',
        d.contactPhone ?? '',
        d.latitude === null ? '' : Number(d.latitude),
        d.longitude === null ? '' : Number(d.longitude),
        d.gpsRadiusM ?? '',
        d._count.assets,
        d.isActive ? 'Có' : 'Không',
        d.note ?? '',
      ]);
    }

    guiXlsx(res, `dia-diem-${ngayHomNay()}.xlsx`, await xuatBuffer(wb));
  }),
);
