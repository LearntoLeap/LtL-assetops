/**
 * CÀI ĐẶT CHUNG — thông tin đơn vị in trên chứng từ.
 *
 * Đọc: mọi tài khoản đã đăng nhập (form lập biên bản cần điền sẵn Bên giao).
 * Ghi: CHỈ ADMIN — đây là thông tin pháp lý in lên biên bản đã ký.
 */
import { Router } from 'express';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import { ghiAudit } from '../../lib/audit.js';
import { docCaiDat, ghiCaiDat, luocDoCaiDat } from '../../lib/cai-dat.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';

export const caiDatRouter = Router();
caiDatRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

caiDatRouter.get(
  '/',
  batAsync(async (_req, res) => {
    res.json({ ok: true, caiDat: await docCaiDat() });
  }),
);

caiDatRouter.put(
  '/',
  yeuCauVaiTro('ADMIN'),
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const truoc = await docCaiDat();
    const duLieu = luocDoCaiDat.parse(req.body);
    const sau = await ghiCaiDat(duLieu, actor.id);

    await ghiAudit({
      actor,
      action: 'settings.update',
      entityType: 'app_setting',
      entityId: 'chung',
      beforeValue: truoc,
      afterValue: sau,
      ...boiCanh(req),
    });
    res.json({ ok: true, caiDat: sau });
  }),
);
