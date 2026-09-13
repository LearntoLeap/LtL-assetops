import { Router } from 'express';
import { z } from 'zod';
import { batAsync } from '../../lib/bat-async.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
} from '../../middleware/xac-thuc.js';
import * as dv from './bao-cao.service.js';

export const baoCaoRouter = Router();
baoCaoRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

const luocDoLoc = z.object({
  /** Số ngày của biểu đồ ra/vào kho. */
  soNgay: z.coerce.number().int().min(7).max(180).default(30),
});

/**
 * Số liệu dashboard. KHÔNG giới hạn vai trò ở middleware: mọi tài khoản đều mở
 * được trang chủ, nhưng service lọc theo phạm vi nên điểm trường chỉ thấy số của
 * trường mình. ADMIN và VAN_HANH thấy toàn bộ.
 */
baoCaoRouter.get(
  '/dashboard',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const { soNgay } = luocDoLoc.parse(req.query);
    res.json({ ok: true, ...(await dv.dashboard(nguoiDung, soNgay)) });
  }),
);
