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
  luocDoTaoNhanhThietBi,
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

/**
 * Tra cứu rút gọn theo mã — dùng khi LẬP YÊU CẦU: người lập phải gõ được mã
 * thiết bị mình muốn mượn, dù thiết bị đó chưa thuộc phạm vi dữ liệu của họ.
 * Chỉ trả thông tin nhận dạng, không trả giá trị/tồn kho/lịch sử.
 */
thietBiRouter.get(
  '/tra-cuu/:code',
  batAsync(async (req, res) => {
    const code = maThietBi.parse(req.params['code']);
    res.json({ ok: true, thietBi: await dv.traCuuNhanh(code) });
  }),
);

/**
 * THÙNG RÁC — thiết bị đã xoá, còn khôi phục được.
 *
 * PHẢI khai TRƯỚC `GET /:id`: Express so khớp theo thứ tự khai báo, để sau thì
 * "thung-rac" bị hiểu là một id và trả về 404 "không tìm thấy thiết bị".
 *
 * Chỉ ADMIN: đây là nơi duy nhất thấy được dữ liệu đã bị xoá khỏi mọi danh sách.
 */
thietBiRouter.get(
  '/thung-rac',
  yeuCauAdmin,
  batAsync(async (_req, res) => {
    res.json({ ok: true, ...(await dv.thungRac()) });
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

/**
 * Tạo nhanh khi lập yêu cầu mà mã chưa có. Mã do SERVER sinh, ẢNH bắt buộc.
 * Cùng quyền với tạo thường (chỉ người nhập liệu) — tạo nhanh không phải là
 * cửa sau để vai trò khác thêm thiết bị.
 */
thietBiRouter.post(
  '/nhanh',
  chiNguoiNhapLieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoNhanhThietBi.parse(req.body);
    const thietBi = await dv.taoNhanh(duLieu, actor, boiCanh(req));
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

/**
 * XOÁ MỀM: chỉ ADMIN, nhưng LUÔN cho xoá — ở bất kỳ tình trạng và trạng thái
 * phân bổ nào. Thiết bị vào thùng rác, khôi phục lại được.
 */
thietBiRouter.delete(
  '/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoa(String(req.params['id']), actor, boiCanh(req));
    res.json({
      ok: true,
      thongDiep: 'Đã chuyển thiết bị vào thùng rác. Khôi phục được ở Thiết bị → Thùng rác.',
    });
  }),
);

/** Khôi phục từ thùng rác: chỉ ADMIN. */
thietBiRouter.post(
  '/:id/khoi-phuc',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const thietBi = await dv.khoiPhuc(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thietBi, thongDiep: 'Đã khôi phục thiết bị.' });
  }),
);

/**
 * XOÁ VĨNH VIỄN khỏi thùng rác: chỉ ADMIN, và service chỉ nhận thiết bị ĐÃ ở
 * thùng rác — bắt buộc hai bước để không có đường nào mất dữ liệu bằng một cú bấm.
 */
thietBiRouter.delete(
  '/:id/vinh-vien',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaVinhVien(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá vĩnh viễn. Không khôi phục lại được.' });
  }),
);
