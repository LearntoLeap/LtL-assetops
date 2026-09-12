import { Router } from 'express';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import { nguoiDungHienTai, yeuCauDangNhap } from '../../middleware/xac-thuc.js';
import { luocDoDangNhap, luocDoDoiMatKhau, luocDoLamMoi } from './auth.schema.js';
import { dangNhap, dangXuat, doiMatKhau, hoSoCuaToi, lamMoiToken } from './auth.service.js';

export const authRouter = Router();

/**
 * KHÔNG có POST /dang-ky. Tài khoản chỉ do ADMIN tạo ở /api/nguoi-dung.
 */

authRouter.post(
  '/dang-nhap',
  batAsync(async (req, res) => {
    const duLieu = luocDoDangNhap.parse(req.body);
    const ketQua = await dangNhap(duLieu, boiCanh(req));
    res.json({ ok: true, ...ketQua });
  }),
);

authRouter.post(
  '/lam-moi',
  batAsync(async (req, res) => {
    const { refreshToken } = luocDoLamMoi.parse(req.body);
    const boToken = await lamMoiToken(refreshToken, boiCanh(req));
    res.json({ ok: true, ...boToken });
  }),
);

authRouter.post(
  '/dang-xuat',
  yeuCauDangNhap,
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const than: unknown = req.body;
    const refreshToken =
      typeof than === 'object' && than !== null && 'refreshToken' in than
        ? String((than as { refreshToken: unknown }).refreshToken)
        : undefined;
    await dangXuat(refreshToken, nguoiDung, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã đăng xuất.' });
  }),
);

/** Thông tin tài khoản đang đăng nhập — dùng để khôi phục phiên khi tải lại web. */
authRouter.get(
  '/toi',
  yeuCauDangNhap,
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    res.json({ ok: true, nguoiDung: await hoSoCuaToi(nguoiDung.id) });
  }),
);

/** Đổi mật khẩu — KHÔNG chặn bởi chanKhiChuaDoiMatKhau, vì đây là đường thoát. */
authRouter.post(
  '/doi-mat-khau',
  yeuCauDangNhap,
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const { matKhauCu, matKhauMoi } = luocDoDoiMatKhau.parse(req.body);
    await doiMatKhau(nguoiDung, matKhauCu, matKhauMoi, boiCanh(req));
    res.json({
      ok: true,
      thongDiep: 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị thu hồi.',
    });
  }),
);
