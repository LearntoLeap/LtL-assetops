import { Router } from 'express';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauAdmin,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';
import {
  luocDoDatLaiMatKhau,
  luocDoKhoa,
  luocDoLocNguoiDung,
  luocDoSuaNguoiDung,
  luocDoTaoNguoiDung,
} from './nguoi-dung.schema.js';
import * as dv from './nguoi-dung.service.js';

export const nguoiDungRouter = Router();

// Mọi route dưới đây đều cần đăng nhập, đã đổi mật khẩu, và vai trò quản lý.
// KHO / NHAN_SU / TRUONG bị chặn ngay ở đây, kể cả gọi thẳng API.
nguoiDungRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau, yeuCauVaiTro('ADMIN', 'VAN_HANH'));

nguoiDungRouter.get(
  '/',
  batAsync(async (req, res) => {
    const loc = luocDoLocNguoiDung.parse(req.query);
    res.json({ ok: true, ...(await dv.danhSach(loc)) });
  }),
);

nguoiDungRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    res.json({ ok: true, nguoiDung: await dv.xemMot(String(req.params['id'])) });
  }),
);

/** Tạo tài khoản: CHỈ ADMIN. */
nguoiDungRouter.post(
  '/',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoNguoiDung.parse(req.body);
    const nguoiDung = await dv.tao(duLieu, actor, boiCanh(req));
    res.status(201).json({ ok: true, nguoiDung });
  }),
);

nguoiDungRouter.patch(
  '/:id',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoSuaNguoiDung.parse(req.body);
    const nguoiDung = await dv.sua(String(req.params['id']), duLieu, actor, boiCanh(req));
    res.json({ ok: true, nguoiDung });
  }),
);

nguoiDungRouter.post(
  '/:id/khoa',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { isLocked, lyDo } = luocDoKhoa.parse(req.body);
    const nguoiDung = await dv.datKhoa(String(req.params['id']), isLocked, lyDo, actor, boiCanh(req));
    res.json({ ok: true, nguoiDung });
  }),
);

nguoiDungRouter.post(
  '/:id/dat-lai-mat-khau',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { matKhauMoi } = luocDoDatLaiMatKhau.parse(req.body);
    await dv.datLaiMatKhau(String(req.params['id']), matKhauMoi, actor, boiCanh(req));
    res.json({
      ok: true,
      thongDiep: 'Đã đặt lại mật khẩu. Người dùng phải đổi mật khẩu ở lần đăng nhập tới.',
    });
  }),
);

/** Xoá tài khoản: CHỈ ADMIN, và chỉ khi chưa phát sinh dữ liệu lịch sử. */
nguoiDungRouter.delete(
  '/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoa(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá tài khoản.' });
  }),
);
