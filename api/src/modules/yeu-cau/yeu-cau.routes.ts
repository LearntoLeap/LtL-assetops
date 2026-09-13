import { Router } from 'express';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauNguoiDuyet,
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

yeuCauRouter.delete(
  '/:id',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaNhap(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá bản nháp yêu cầu.' });
  }),
);
