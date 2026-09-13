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
  luocDoLocThietBi,
  luocDoSuaThietBi,
  luocDoTaoThietBi,
  maThietBi,
} from './thiet-bi.schema.js';
import * as dv from './thiet-bi.service.js';

export const thietBiRouter = Router();
thietBiRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

/** Tạo/sửa thiết bị: ADMIN, VAN_HANH và KHO (KHO là nơi nhập liệu tại kho). */
const chiNguoiNhapLieu = yeuCauVaiTro('ADMIN', 'VAN_HANH', 'KHO');

/** Danh sách — đã lọc theo phạm vi vai trò trong service. */
thietBiRouter.get(
  '/',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const loc = luocDoLocThietBi.parse(req.query);
    res.json({ ok: true, ...(await dv.danhSach(nguoiDung, loc)) });
  }),
);

/**
 * Tra cứu theo MÃ — dùng cho quét QR. Đặt TRƯỚC '/:id' để không bị nuốt route.
 */
thietBiRouter.get(
  '/ma/:code',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const code = maThietBi.parse(req.params['code']);
    res.json({ ok: true, ...(await dv.timTheoMa(nguoiDung, code)) });
  }),
);

thietBiRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    res.json({ ok: true, ...(await dv.xemMot(nguoiDung, String(req.params['id']))) });
  }),
);

thietBiRouter.post(
  '/',
  chiNguoiNhapLieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoThietBi.parse(req.body);
    const thietBi = await dv.tao(duLieu, actor, boiCanh(req));
    res.status(201).json({ ok: true, thietBi });
  }),
);

thietBiRouter.patch(
  '/:id',
  chiNguoiNhapLieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoSuaThietBi.parse(req.body);
    const thietBi = await dv.sua(String(req.params['id']), duLieu, actor, boiCanh(req));
    res.json({ ok: true, thietBi });
  }),
);

/** Xoá hẳn: chỉ ADMIN, và chỉ khi thiết bị chưa phát sinh nghiệp vụ. */
thietBiRouter.delete(
  '/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoa(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá thiết bị.' });
  }),
);
