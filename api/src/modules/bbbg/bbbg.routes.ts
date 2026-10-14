import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Router } from 'express';
import { batAsync } from '../../lib/bat-async.js';
import { loi403, loi404 } from '../../lib/loi-http.js';
import { boiCanh } from '../../lib/audit.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauNghiepVuKho,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';
import {
  luocDoLocBBBG,
  luocDoSuaBBBG,
  luocDoTaoBBBG,
  luocDoTuChoiBBBG,
  luocDoXacNhanBBBG,
} from './bbbg.schema.js';
import { luocDoNhieuIdChung } from '../../lib/luoc-do-chung.js';
import { phamViCua } from '../../lib/pham-vi.js';
import * as dv from './bbbg.service.js';
import { MAU_THEO_LOAI } from './mau-bbbg.js';

export const bbbgRouter = Router();
bbbgRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

/**
 * LẬP / SỬA / XUẤT FILE BIÊN BẢN — nghiệp vụ kho.
 *
 * Quản trị, Vận hành, Kho, Nhân sự phòng ban: mọi biên bản. Tài khoản TRƯỜNG:
 * biên bản của phiếu thuộc trường mình (trường gửi / trường nhận / mình lập) —
 * cùng phạm vi với danh sách biên bản trường đó thấy. Không bao giờ chỉ thêm
 * TRUONG vào một danh sách vai trò: service lập biên bản đọc phiếu theo id, nên
 * thiếu phép kiểm phạm vi là trường lập được biên bản cho phiếu của nơi khác.
 */
function benGiaoHoacNguoiLap(lay: 'bbbg' | 'yeuCau') {
  return batAsync(async (req, _res, next) => {
    const nd = nguoiDungHienTai(req);
    if (phamViCua(nd).toanBoKho) {
      next();
      return;
    }
    const duoc =
      lay === 'bbbg'
        ? (await dv.bienBanTrongPhamVi(String(req.params['id']), nd)) ||
          (await dv.laNguoiLapPhieuCuaBBBG(String(req.params['id']), nd.id))
        : (await dv.yeuCauTrongPhamVi(String(req.params['requestId']), nd)) ||
          (await dv.laNguoiLapYeuCau(String(req.params['requestId']), nd.id));
    if (!duoc) {
      throw loi403(
        'Tài khoản trường chỉ lập / sửa được biên bản của phiếu thuộc trường mình.',
      );
    }
    next();
  });
}
/**
 * XOÁ BIÊN BẢN: quản trị hệ thống và vận hành thiết bị — cùng nhóm theo dõi
 * chứng từ hằng ngày. Chặn ở máy chủ; ẩn nút chỉ là cho gọn mắt.
 */
const duocXoaPhieu = yeuCauVaiTro('ADMIN', 'VAN_HANH');

bbbgRouter.get(
  '/',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const loc = luocDoLocBBBG.parse(req.query);
    res.json({ ok: true, ...(await dv.danhSach(nguoiDung, loc)) });
  }),
);

/**
 * Nội dung mặc định của cả 7 mẫu biên bản, để form điền sẵn và cho người lập
 * sửa NGAY lúc lập chứ không phải lập xong mới thấy mình vừa ký cái gì.
 *
 * ĐẶT TRƯỚC `GET /:id` — Express khớp theo thứ tự khai báo, để sau thì "mau"
 * bị nuốt thành một mã biên bản.
 */
/** THÙNG RÁC — khai trước `/:id` để không bị nuốt thành một mã biên bản. */
bbbgRouter.get(
  '/thung-rac',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const loc = luocDoLocBBBG.parse(req.query);
    res.json({ ok: true, ...(await dv.thungRac({ trang: loc.trang, moiTrang: loc.moiTrang })) });
  }),
);

/** XOÁ / KHÔI PHỤC / XOÁ HẲN HÀNG LOẠT (ADMIN) — khai trước `/:id`. */
bbbgRouter.post(
  '/xoa-nhieu',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuIdChung.parse(req.body);
    const kq = await dv.xoaMemNhieu(ids, actor, boiCanh(req));
    res.json({
      ok: true,
      ...kq,
      thongDiep: `Đã chuyển ${kq.soThanhCong} biên bản vào thùng rác. Việc bàn giao không bị hoàn tác.`,
    });
  }),
);

bbbgRouter.post(
  '/khoi-phuc-nhieu',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuIdChung.parse(req.body);
    const kq = await dv.khoiPhucNhieu(ids, actor, boiCanh(req));
    res.json({ ok: true, ...kq, thongDiep: `Đã khôi phục ${kq.soThanhCong} biên bản.` });
  }),
);

bbbgRouter.post(
  '/xoa-vinh-vien-nhieu',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { ids } = luocDoNhieuIdChung.parse(req.body);
    const kq = await dv.xoaVinhVienNhieu(ids, actor, boiCanh(req));
    res.json({
      ok: true,
      ...kq,
      thongDiep: `Đã xoá hẳn ${kq.soThanhCong} biên bản và file mềm. Không khôi phục lại được.`,
    });
  }),
);

bbbgRouter.get(
  '/mau',
  batAsync(async (_req, res) => {
    res.json({ ok: true, mau: MAU_THEO_LOAI });
  }),
);

bbbgRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    res.json({ ok: true, bbbg: await dv.xemMot(nguoiDung, String(req.params['id'])) });
  }),
);

/**
 * TẢI FILE WORD của biên bản. Chưa có file (hoặc biên bản sửa sau lần xuất gần
 * nhất) thì sinh lại rồi mới trả — người dùng không phải bấm hai nút.
 */
bbbgRouter.get(
  '/:id/tep',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const tep = await dv.layFile(String(req.params['id']), nguoiDung, boiCanh(req));
    try {
      await stat(tep.dayDu);
    } catch {
      throw loi404('File biên bản không còn trên ổ đĩa. Bấm "Tạo lại file" để xuất bản mới.');
    }

    res.setHeader('Content-Type', dv.KIEU_DOCX);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(tep.fileName)}`,
    );
    if (tep.byteSize) res.setHeader('Content-Length', String(tep.byteSize));
    createReadStream(tep.dayDu).pipe(res);
  }),
);

/** Xuất lại file Word sau khi sửa nội dung biên bản. */
bbbgRouter.post(
  '/:id/xuat-file',
  benGiaoHoacNguoiLap('bbbg'),
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, bbbg: await dv.sinhFile(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

bbbgRouter.post(
  '/',
  yeuCauNghiepVuKho,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoBBBG.parse(req.body);
    // Tài khoản trường: phiếu phải thuộc trường mình (service đọc phiếu theo id).
    if (!phamViCua(actor).toanBoKho && !(await dv.yeuCauTrongPhamVi(duLieu.requestId, actor))) {
      throw loi404('Không tìm thấy yêu cầu để lập biên bản.');
    }
    res.status(201).json({ ok: true, bbbg: await dv.tao(duLieu, actor, boiCanh(req)) });
  }),
);

/**
 * XUẤT BIÊN BẢN THẲNG TỪ MỘT YÊU CẦU — không phải mở trang Biên bản chọn lại.
 *
 * Điền sẵn hai bên từ trang Cài đặt và từ điểm lưu trữ, dựng luôn file Word rồi
 * trả về biên bản. Bấm nhiều lần vẫn ra đúng một biên bản.
 */
bbbgRouter.post(
  '/tu-yeu-cau/:requestId',
  benGiaoHoacNguoiLap('yeuCau'),
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const ctx = boiCanh(req);
    const { bbbg, moi } = await dv.taoTuYeuCau(String(req.params['requestId']), actor, ctx);
    const sau = await dv.sinhFile(bbbg.id, actor, ctx);
    res.status(moi ? 201 : 200).json({ ok: true, bbbg: sau, moi });
  }),
);

bbbgRouter.patch(
  '/:id',
  benGiaoHoacNguoiLap('bbbg'),
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoSuaBBBG.parse(req.body);
    res.json({ ok: true, bbbg: await dv.sua(String(req.params['id']), duLieu, actor, boiCanh(req)) });
  }),
);

bbbgRouter.post(
  '/:id/gui-xac-nhan',
  benGiaoHoacNguoiLap('bbbg'),
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, bbbg: await dv.guiXacNhan(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

/**
 * XÁC NHẬN BÀN GIAO — Quản trị / Vận hành (bên nhận không còn tự xác nhận).
 * Service kiểm vai trò (`batBuocNguoiXacNhan`).
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

// -------------------------------------------------------------- xoá (ADMIN)

bbbgRouter.delete(
  '/:id',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaMem(String(req.params['id']), actor, boiCanh(req));
    res.json({
      ok: true,
      thongDiep:
        'Đã chuyển biên bản vào thùng rác. Việc bàn giao KHÔNG bị hoàn tác — thiết bị vẫn ở nơi đã nhận.',
    });
  }),
);

bbbgRouter.post(
  '/:id/khoi-phuc',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    res.json({ ok: true, bbbg: await dv.khoiPhuc(String(req.params['id']), actor, boiCanh(req)) });
  }),
);

bbbgRouter.delete(
  '/:id/vinh-vien',
  duocXoaPhieu,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaVinhVien(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá hẳn biên bản và file mềm khỏi hệ thống.' });
  }),
);
