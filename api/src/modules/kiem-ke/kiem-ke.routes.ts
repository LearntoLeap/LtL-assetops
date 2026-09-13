import { Router } from 'express';
import { NHAN_TINH_TRANG } from '@ltl/taisan-shared';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import { KIEU_XLSX, taoWorkbook, themSheet, xuatBuffer } from '../../lib/excel.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauNguoiDuyet,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';
import {
  luocDoChot,
  luocDoGhiDem,
  luocDoLocKiemKe,
  luocDoTaoKiemKe,
} from './kiem-ke.schema.js';
import * as dv from './kiem-ke.service.js';

export const kiemKeRouter = Router();
kiemKeRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

/** Người đi kiểm: kho và nhóm quản lý. */
const nguoiKiem = yeuCauVaiTro('ADMIN', 'VAN_HANH', 'KHO');

kiemKeRouter.get(
  '/',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const loc = luocDoLocKiemKe.parse(req.query);
    res.json({ ok: true, ...(await dv.danhSach(nguoiDung, loc)) });
  }),
);

kiemKeRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const phieu = await dv.xemMot(nguoiDung, String(req.params['id']));
    const dong = phieu.items.map(dv.dungDongBaoCao);
    res.json({ ok: true, phieu, baoCao: { dong, tongHop: dv.tongHop(dong) } });
  }),
);

/** Mở đợt kiểm kê: theo đặc tả là việc của ADMIN (và VAN_HANH). */
kiemKeRouter.post(
  '/',
  yeuCauNguoiDuyet,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoKiemKe.parse(req.body);
    res.status(201).json({ ok: true, phieu: await dv.tao(duLieu, actor, boiCanh(req)) });
  }),
);

kiemKeRouter.post(
  '/:id/muc/:itemId',
  nguoiKiem,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoGhiDem.parse(req.body);
    const phieu = await dv.ghiDem(
      String(req.params['id']),
      String(req.params['itemId']),
      duLieu,
      actor,
      boiCanh(req),
    );
    const dong = phieu.items.map(dv.dungDongBaoCao);
    res.json({ ok: true, phieu, baoCao: { dong, tongHop: dv.tongHop(dong) } });
  }),
);

kiemKeRouter.post(
  '/:id/gui-chot',
  nguoiKiem,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, phieu: await dv.guiChot(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

/** Chốt và điều chỉnh: chỉ nhóm duyệt. Mọi điều chỉnh đều vào nhật ký. */
kiemKeRouter.post(
  '/:id/chot',
  yeuCauNguoiDuyet,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoChot.parse(req.body ?? {});
    const kq = await dv.chot(String(req.params['id']), duLieu, actor, boiCanh(req));
    res.json({ ok: true, ...kq });
  }),
);

kiemKeRouter.post(
  '/:id/huy',
  yeuCauNguoiDuyet,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, phieu: await dv.huy(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

/** Xuất báo cáo chênh lệch ra Excel. */
kiemKeRouter.get(
  '/:id/bao-cao.xlsx',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const phieu = await dv.xemMot(nguoiDung, String(req.params['id']));
    const dong = phieu.items.map(dv.dungDongBaoCao);
    const tong = dv.tongHop(dong);

    const wb = taoWorkbook();
    const sheet = themSheet(wb, 'Chênh lệch kiểm kê', [
      { tieuDe: 'Mã thiết bị', rong: 18 },
      { tieuDe: 'Tên thiết bị', rong: 34 },
      { tieuDe: 'Loại', rong: 20 },
      { tieuDe: 'Hệ thống', rong: 12 },
      { tieuDe: 'Thực đếm', rong: 12 },
      { tieuDe: 'Chênh lệch', rong: 12 },
      { tieuDe: 'Tình trạng hệ thống', rong: 20 },
      { tieuDe: 'Tình trạng thực tế', rong: 20 },
      { tieuDe: 'Số ảnh', rong: 10 },
      { tieuDe: 'Người đếm', rong: 22 },
      { tieuDe: 'Ghi chú', rong: 40 },
    ]);

    for (const d of dong) {
      const hang = sheet.addRow([
        d.code,
        d.name,
        d.loai,
        d.heThong,
        d.thucDem ?? '',
        d.chenhLech ?? '',
        NHAN_TINH_TRANG[d.tinhTrangHeThong],
        d.tinhTrangThucTe ? NHAN_TINH_TRANG[d.tinhTrangThucTe] : '',
        d.soAnh,
        d.nguoiDem ?? '',
        d.note ?? '',
      ]);
      // Tô đỏ dòng chênh lệch để người đọc thấy ngay
      if ((d.chenhLech ?? 0) !== 0) {
        hang.eachCell((o) => {
          o.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        });
      }
    }

    const tt = wb.addWorksheet('Tổng hợp');
    tt.columns = [{ width: 28 }, { width: 20 }];
    tt.addRow(['PHIẾU KIỂM KÊ', phieu.code]).font = { bold: true, size: 14 };
    tt.addRow(['Tên đợt', phieu.name]);
    tt.addRow(['Địa điểm', phieu.location.name]);
    tt.addRow(['Trạng thái', phieu.status]);
    tt.addRow(['Người tạo', phieu.createdBy.fullName]);
    tt.addRow(['Chốt bởi', phieu.closedBy?.fullName ?? '—']);
    tt.addRow([]);
    tt.addRow(['Tổng số dòng', tong.tongDong]);
    tt.addRow(['Đã đếm', tong.daDem]);
    tt.addRow(['Chưa đếm', tong.chuaDem]);
    tt.addRow(['Số mã chênh lệch', tong.soChenhLech]);
    tt.addRow(['Tổng thiếu', tong.thieu]);
    tt.addRow(['Tổng thừa', tong.thua]);
    tt.addRow(['Số mã đổi tình trạng', tong.doiTinhTrang]);

    const duLieu = await xuatBuffer(wb);
    res.setHeader('Content-Type', KIEU_XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="kiem-ke-${phieu.code}.xlsx"`);
    res.setHeader('Content-Length', String(duLieu.length));
    res.end(duLieu);
  }),
);
