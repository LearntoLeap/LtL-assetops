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

/**
 * Số liệu DASHBOARD TỔNG THỂ — cả guồng, không chỉ tài sản.
 *
 * Cũng không giới hạn vai trò ở middleware: service ghép điều kiện phạm vi vào
 * từng truy vấn, nên điểm trường mở trang này chỉ thấy số của trường mình.
 */
baoCaoRouter.get(
  '/tong-the',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const { soNgay } = luocDoLoc.parse(req.query);
    res.json({ ok: true, ...(await dv.tongThe(nguoiDung, soNgay)) });
  }),
);

const luocDoMotDiem = z.object({
  diaDiemId: z.string().trim().min(1).max(30),
  gioiHan: z.coerce.number().int().positive().max(300).default(100),
});

/**
 * Lịch sử sửa chữa / thay linh kiện, gom theo điểm lưu trữ.
 *
 * Không giới hạn vai trò ở middleware — service lọc theo phạm vi, nên điểm
 * trường chỉ thấy dòng của trường mình, ADMIN và VAN_HANH thấy hết.
 */
baoCaoRouter.get(
  '/lich-su-sua-chua',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    res.json({ ok: true, muc: await dv.lichSuSuaChuaTheoDiem(nguoiDung) });
  }),
);

/** Dòng thời gian của MỘT điểm: báo hỏng và lấy linh kiện trộn lẫn. */
baoCaoRouter.get(
  '/lich-su-sua-chua/chi-tiet',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const { diaDiemId, gioiHan } = luocDoMotDiem.parse(req.query);
    res.json({ ok: true, muc: await dv.lichSuMotDiem(nguoiDung, diaDiemId, gioiHan) });
  }),
);
