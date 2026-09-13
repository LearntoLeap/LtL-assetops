import { Router } from 'express';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';
import {
  luocDoLocBBBG,
  luocDoSuaBBBG,
  luocDoTaoBBBG,
  luocDoTuChoiBBBG,
  luocDoXacNhanBBBG,
} from './bbbg.schema.js';
import * as dv from './bbbg.service.js';

export const bbbgRouter = Router();
bbbgRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

/** Lập/sửa biên bản: bên giao — ADMIN, VAN_HANH, KHO. */
const benGiao = yeuCauVaiTro('ADMIN', 'VAN_HANH', 'KHO');

bbbgRouter.get(
  '/',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const loc = luocDoLocBBBG.parse(req.query);
    res.json({ ok: true, ...(await dv.danhSach(nguoiDung, loc)) });
  }),
);

bbbgRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    res.json({ ok: true, bbbg: await dv.xemMot(nguoiDung, String(req.params['id'])) });
  }),
);

bbbgRouter.post(
  '/',
  benGiao,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoBBBG.parse(req.body);
    res.status(201).json({ ok: true, bbbg: await dv.tao(duLieu, actor, boiCanh(req)) });
  }),
);

bbbgRouter.patch(
  '/:id',
  benGiao,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoSuaBBBG.parse(req.body);
    res.json({ ok: true, bbbg: await dv.sua(String(req.params['id']), duLieu, actor, boiCanh(req)) });
  }),
);

bbbgRouter.post(
  '/:id/gui-xac-nhan',
  benGiao,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, bbbg: await dv.guiXacNhan(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

/**
 * BÊN NHẬN xác nhận — không giới hạn vai trò ở middleware vì chính tài khoản
 * TRUONG phải bấm được; service kiểm tài khoản có đúng thuộc điểm nhận hay không.
 */
bbbgRouter.post(
  '/:id/xac-nhan',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const { ghiChu } = luocDoXacNhanBBBG.parse(req.body ?? {});
    res.json({
      ok: true,
      bbbg: await dv.xacNhan(String(req.params['id']), ghiChu, nguoiDung, boiCanh(req)),
    });
  }),
);

bbbgRouter.post(
  '/:id/tu-choi',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const { rejectionNote } = luocDoTuChoiBBBG.parse(req.body);
    res.json({
      ok: true,
      bbbg: await dv.tuChoi(String(req.params['id']), rejectionNote, nguoiDung, boiCanh(req)),
    });
  }),
);
