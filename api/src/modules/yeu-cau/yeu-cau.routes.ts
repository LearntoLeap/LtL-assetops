import { Router } from 'express';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauNguoiDuyet,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';
import { luocDoNhieuIdChung } from '../../lib/luoc-do-chung.js';
import {
  luocDoDuyet,
  luocDoLocYeuCau,
  luocDoNhapKho,
  luocDoSuaYeuCau,
  luocDoTaoYeuCau,
  luocDoTuChoi,
  luocDoXuatKho,
} from './yeu-cau.schema.js';
import * as dv from './yeu-cau.service.js';

export const yeuCauRouter = Router();
yeuCauRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

/**
 * XOÁ PHIẾU: quản trị hệ thống và vận hành thiết bị.
 *
 * Hai vai trò này là người theo dõi luồng phiếu hằng ngày nên cũng là người dọn
 * phiếu lập nhầm, lập trùng, phiếu thử. Chặn ở máy chủ; ẩn nút ở giao diện chỉ
 * là cho gọn mắt, không phải là phép kiểm.
 *
 * Xoá thiết bị và điểm lưu trữ VẪN chỉ quản trị — hai thứ đó là gốc của tồn kho.
 */
const duocXoaPhieu = yeuCauVaiTro('ADMIN', 'VAN_HANH');

/** Mọi vai trò đều tạo được yêu cầu — đó là cách duy nhất để lấy thiết bị. */
yeuCauRouter.post(
  '/',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoYeuCau.parse(req.body);
    const yeuCau = await dv.tao(duLieu, actor, boiCanh(req));
    res.status(201).json({ ok: true, yeuCau });
  }),
);

yeuCauRouter.get(
  '/',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const loc = luocDoLocYeuCau.parse(req.query);
    res.json({ ok: true, ...(await dv.danhSach(nguoiDung, loc)) });
  }),
);

/**
 * THÙNG RÁC. Khai TRƯỚC `/:id` — Express khớp tuyến theo thứ tự khai báo, để
 * sau thì "thung-rac" bị nuốt thành một mã yêu cầu và luôn trả 404.
 */
yeuCauRouter.get(
  '/thung-rac',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const loc = luocDoLocYeuCau.parse(req.query);
    res.json({ ok: true, ...(await dv.thungRac({ trang: loc.trang, moiTrang: loc.moiTrang })) });
  }),
);

/**
 * XOÁ / KHÔI PHỤC / XOÁ HẲN HÀNG LOẠT (ADMIN).
 *
 * Khai TRƯỚC `/:id` như mọi tuyến tĩnh khác trong tệp này.
 */
yeuCauRouter.post(
  '/xoa-nhieu',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuIdChung.parse(req.body);
    const kq = await dv.xoaMemNhieu(ids, actor, boiCanh(req));
    res.json({
      ok: true,
      ...kq,
      thongDiep: `Đã chuyển ${kq.soThanhCong} yêu cầu vào thùng rác. Tồn kho và nhật ký di chuyển giữ nguyên.`,
    });
  }),
);

yeuCauRouter.post(
  '/khoi-phuc-nhieu',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuIdChung.parse(req.body);
    const kq = await dv.khoiPhucNhieu(ids, actor, boiCanh(req));
    res.json({ ok: true, ...kq, thongDiep: `Đã khôi phục ${kq.soThanhCong} yêu cầu.` });
  }),
);

yeuCauRouter.post(
  '/xoa-vinh-vien-nhieu',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuIdChung.parse(req.body);
    const kq = await dv.xoaVinhVienNhieu(ids, actor, boiCanh(req));
    res.json({
      ok: true,
      ...kq,
      thongDiep: `Đã xoá hẳn ${kq.soThanhCong} yêu cầu. Không khôi phục lại được.`,
    });
  }),
);

yeuCauRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    res.json({ ok: true, yeuCau: await dv.xemMot(nguoiDung, String(req.params['id'])) });
  }),
);

yeuCauRouter.patch(
  '/:id',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoSuaYeuCau.parse(req.body);
    res.json({ ok: true, yeuCau: await dv.sua(String(req.params['id']), duLieu, actor, boiCanh(req)) });
  }),
);

yeuCauRouter.post(
  '/:id/gui-duyet',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, yeuCau: await dv.guiDuyet(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

/** Duyệt / từ chối: chỉ ADMIN và VAN_HANH, và không ai tự duyệt yêu cầu của mình. */
yeuCauRouter.post(
  '/:id/duyet',
  yeuCauNguoiDuyet,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ghiChu } = luocDoDuyet.parse(req.body ?? {});
    res.json({
      ok: true,
      yeuCau: await dv.duyet(String(req.params['id']), ghiChu, actor, boiCanh(req)),
    });
  }),
);

yeuCauRouter.post(
  '/:id/tu-choi',
  yeuCauNguoiDuyet,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { rejectionNote } = luocDoTuChoi.parse(req.body);
    res.json({
      ok: true,
      yeuCau: await dv.tuChoi(String(req.params['id']), rejectionNote, actor, boiCanh(req)),
    });
  }),
);

/**
 * Hoàn tất XUẤT KHO. Chốt chặn nằm ở service: phải đã duyệt, mã quét phải khớp,
 * và phải có ảnh chụp thực tế — thiếu một thứ là 422, không ghi gì.
 */
yeuCauRouter.post(
  '/:id/xuat-kho',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    dv.batBuocQuyenThucHien(nguoiDung);
    const duLieu = luocDoXuatKho.parse(req.body);
    res.json({
      ok: true,
      yeuCau: await dv.xuatKho(String(req.params['id']), duLieu, nguoiDung, boiCanh(req)),
    });
  }),
);

yeuCauRouter.post(
  '/:id/nhap-kho',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    dv.batBuocQuyenThucHien(nguoiDung);
    const duLieu = luocDoNhapKho.parse(req.body);
    res.json({
      ok: true,
      yeuCau: await dv.nhapKho(String(req.params['id']), duLieu, nguoiDung, boiCanh(req)),
    });
  }),
);

/**
 * Xoá BẢN NHÁP — người tạo tự xoá phiếu của mình, xoá hẳn khỏi CSDL vì bản nháp
 * chưa sinh ra bút toán nào.
 */
yeuCauRouter.delete(
  '/:id',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaNhap(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá bản nháp yêu cầu.' });
  }),
);

/** ADMIN xoá mềm phiếu ở BẤT KỲ trạng thái nào — đưa vào thùng rác. */
yeuCauRouter.delete(
  '/:id/xoa-mem',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaMem(String(req.params['id']), actor, boiCanh(req));
    res.json({
      ok: true,
      thongDiep:
        'Đã chuyển yêu cầu vào thùng rác. Nhật ký di chuyển và tồn kho giữ nguyên — xoá phiếu không làm hàng quay về kho.',
    });
  }),
);

yeuCauRouter.post(
  '/:id/khoi-phuc',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, yeuCau: await dv.khoiPhuc(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

yeuCauRouter.delete(
  '/:id/vinh-vien',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaVinhVien(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá hẳn yêu cầu khỏi cơ sở dữ liệu.' });
  }),
);
