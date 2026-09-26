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

/** Xoá phiếu là quyền của ADMIN — chặn ở server, ẩn nút chỉ là phụ. */
const chiAdmin = yeuCauVaiTro('ADMIN');

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
  chiAdmin,
  batAsync(async (req, res) => {
    const loc = luocDoLocYeuCau.parse(req.query);
    res.json({ ok: true, ...(await dv.thungRac({ trang: loc.trang, moiTrang: loc.moiTrang })) });
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
  chiAdmin,
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
  chiAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, yeuCau: await dv.khoiPhuc(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

yeuCauRouter.delete(
  '/:id/vinh-vien',
  chiAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaVinhVien(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá hẳn yêu cầu khỏi cơ sở dữ liệu.' });
  }),
);
