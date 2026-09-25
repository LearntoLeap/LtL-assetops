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
  luocDoNhieuId,
  luocDoSuaThietBi,
  luocDoTaoNhanhThietBi,
  luocDoHangLe,
  luocDoTaoThietBi,
  luocDoXemTruocMa,
  maThietBi,
} from './thiet-bi.schema.js';
import * as dv from './thiet-bi.service.js';
import { maKeTiepTheoId } from '../../lib/sinh-ma-thiet-bi.js';
import { loi400 } from '../../lib/loi-http.js';

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

/**
 * XEM TRƯỚC mã sẽ được cấp, để form hiện mã ngay lúc chọn xong ba ô.
 *
 * Cũng phải khai TRƯỚC `GET /:id` vì lý do y hệt tuyến thùng rác.
 *
 * Đây chỉ là XEM TRƯỚC, KHÔNG giữ chỗ: hai người mở form cùng lúc sẽ thấy cùng
 * một mã, và người bấm Lưu sau sẽ nhận mã kế tiếp — `tao()` sinh lại mã ngay
 * trong lúc ghi chứ không tin con số form gửi lên.
 */
/**
 * Ô chọn HÀNG LẺ theo tên. Khai TRƯỚC `GET /:id` như mọi tuyến tên cố định khác.
 */
thietBiRouter.get(
  '/hang-le',
  batAsync(async (req, res) => {
    const loc = luocDoHangLe.parse(req.query);
    res.json({ ok: true, ...(await dv.hangLe(nguoiDungHienTai(req), loc)) });
  }),
);

thietBiRouter.get(
  '/ma-tiep-theo',
  batAsync(async (req, res) => {
    const loc = luocDoXemTruocMa.parse(req.query);
    const kq = await maKeTiepTheoId(loc.originId, loc.categoryId, loc.productLineId || null);
    if (!kq) {
      throw loi400(
        'Nguồn gốc, loại tài sản hoặc dòng giải pháp không tồn tại (có thể vừa bị xoá). Hãy tải lại trang.',
        'DANH_MUC_KHONG_TON_TAI',
      );
    }
    res.json({ ok: true, ma: kq.ma, tienTo: kq.tienTo });
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

/**
 * BA THAO TÁC HÀNG LOẠT cho các thiết bị đã tick ở danh sách / thùng rác.
 * Chỉ ADMIN, y như bản một-thiết-bị.
 *
 * Trả về `soThanhCong` và `boQua` (kèm mã + lý do) chứ không phải chỉ ok/lỗi:
 * lô 30 cái mà 2 cái vướng thì người dùng cần biết đúng 2 cái nào và vì sao,
 * không thể báo "thất bại" rồi để họ tự dò.
 */
thietBiRouter.post(
  '/xoa-nhieu',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuId.parse(req.body);
    const kq = await dv.xoaNhieu(ids, actor, boiCanh(req));
    res.json({
      ok: true,
      ...kq,
      thongDiep: `Đã chuyển ${kq.soThanhCong} thiết bị vào thùng rác.`,
    });
  }),
);

thietBiRouter.post(
  '/khoi-phuc-nhieu',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuId.parse(req.body);
    const kq = await dv.khoiPhucNhieu(ids, actor, boiCanh(req));
    res.json({ ok: true, ...kq, thongDiep: `Đã khôi phục ${kq.soThanhCong} thiết bị.` });
  }),
);

thietBiRouter.post(
  '/xoa-vinh-vien-nhieu',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuId.parse(req.body);
    const kq = await dv.xoaVinhVienNhieu(ids, actor, boiCanh(req));
    res.json({
      ok: true,
      ...kq,
      thongDiep: `Đã xoá vĩnh viễn ${kq.soThanhCong} thiết bị. Không khôi phục lại được.`,
    });
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
