/**
 * THƯ VIỆN WIKI THIẾT BỊ — tuyến HTTP.
 *
 * ĐỌC: mọi tài khoản đã đăng nhập, không giới hạn vai trò và không lọc phạm vi
 * (xem lý do ở đầu wiki.service.ts).
 * GHI: ADMIN / VAN_HANH / KHO.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh } from '../../lib/audit.js';
import { loi400, loi404 } from '../../lib/loi-http.js';
import { duongDanTuyetDoi } from '../../lib/luu-anh.js';
import { luuTaiLieu, xemInlineDuoc } from '../../lib/luu-tai-lieu.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';
import * as dv from './wiki.service.js';
import { luocDoLocBai, luocDoSuaBai, luocDoTaiLieu, luocDoTaoBai } from './wiki.schema.js';

export const wikiRouter = Router();
wikiRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

/** Người kho cầm máy nhiều nhất nên họ được sửa wiki — lưới an toàn là lịch sử. */
const chiNguoiBienTap = yeuCauVaiTro('ADMIN', 'VAN_HANH', 'KHO');

const nhanTep = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_DOC_MAX_BYTES, files: 1 },
}).single('tep');

const nhanTepAnToan: RequestHandler = (req, res, next) => {
  nhanTep(req, res, (loi: unknown) => {
    if (!loi) {
      next();
      return;
    }
    if (loi instanceof multer.MulterError) {
      next(
        loi.code === 'LIMIT_FILE_SIZE'
          ? loi400(
              `File vượt quá ${Math.round(env.UPLOAD_DOC_MAX_BYTES / 1024 / 1024)}MB. File lớn thì để trên Drive rồi dán link.`,
              'TEP_QUA_LON',
            )
          : loi400(`Không nhận được file: ${loi.message}`, 'TEP_KHONG_HOP_LE'),
      );
      return;
    }
    next(loi400(loi instanceof Error ? loi.message : 'File không hợp lệ.', 'TEP_KHONG_HOP_LE'));
  });
};

// ------------------------------------------------------------------- đọc

wikiRouter.get(
  '/',
  batAsync(async (req, res) => {
    res.json({ ok: true, ...(await dv.danhSach(luocDoLocBai.parse(req.query))) });
  }),
);

/** Mọi bài áp dụng cho một thiết bị, đã xếp nhóm theo độ hẹp của phạm vi. */
wikiRouter.get(
  '/theo-thiet-bi/:assetId',
  batAsync(async (req, res) => {
    res.json({ ok: true, ...(await dv.theoThietBi(String(req.params['assetId']))) });
  }),
);

wikiRouter.get(
  '/bai/:khoa',
  batAsync(async (req, res) => {
    res.json({ ok: true, ...(await dv.chiTiet(String(req.params['khoa']))) });
  }),
);

wikiRouter.get(
  '/bai/:id/lich-su',
  batAsync(async (req, res) => {
    res.json({ ok: true, muc: await dv.lichSu(String(req.params['id'])) });
  }),
);

/**
 * Phục vụ file tài liệu.
 *
 * Chỉ PDF, ảnh và văn bản thuần được mở thẳng trong trang; mọi kiểu khác buộc
 * tải về. Kèm `nosniff` để trình duyệt không tự đoán kiểu rồi chạy nhầm một file
 * lạ như HTML — đó là đường vào của XSS lưu trữ.
 */
wikiRouter.get(
  '/tai-lieu/:id/tep',
  batAsync(async (req, res) => {
    const doc = await prisma.wikiDoc.findUnique({
      where: { id: String(req.params['id']) },
      select: { filePath: true, fileName: true, mimeType: true, byteSize: true },
    });
    if (!doc?.filePath || !doc.mimeType) throw loi404('Tài liệu này không có file đính kèm.');

    const dayDu = duongDanTuyetDoi(doc.filePath);
    if (!dayDu) throw loi404('Đường dẫn tài liệu không hợp lệ.');
    try {
      await stat(dayDu);
    } catch {
      throw loi404('File tài liệu không còn trên ổ đĩa.');
    }

    const ten = encodeURIComponent(doc.fileName ?? 'tai-lieu');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `${xemInlineDuoc(doc.mimeType) ? 'inline' : 'attachment'}; filename*=UTF-8''${ten}`,
    );
    if (doc.byteSize) res.setHeader('Content-Length', String(doc.byteSize));
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    createReadStream(dayDu).pipe(res);
  }),
);

// ------------------------------------------------------------------- ghi

wikiRouter.post(
  '/',
  chiNguoiBienTap,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaoBai.parse(req.body);
    res.status(201).json({ ok: true, ...(await dv.tao(duLieu, actor, boiCanh(req))) });
  }),
);

wikiRouter.patch(
  '/bai/:id',
  chiNguoiBienTap,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoSuaBai.parse(req.body);
    res.json({ ok: true, ...(await dv.sua(String(req.params['id']), duLieu, actor, boiCanh(req))) });
  }),
);

wikiRouter.delete(
  '/bai/:id',
  chiNguoiBienTap,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoa(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá bài viết khỏi thư viện.' });
  }),
);

wikiRouter.post(
  '/bai/:id/tai-lieu',
  chiNguoiBienTap,
  nhanTepAnToan,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoTaiLieu.parse(req.body);
    const tep = req.file ? await luuTaiLieu(req.file) : null;
    const doc = await dv.themTaiLieu(
      String(req.params['id']),
      duLieu,
      tep,
      actor,
      boiCanh(req),
    );
    res.status(201).json({ ok: true, taiLieu: doc });
  }),
);

wikiRouter.delete(
  '/tai-lieu/:id',
  chiNguoiBienTap,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    await dv.xoaTaiLieu(String(req.params['id']), actor, boiCanh(req));
    res.json({ ok: true, thongDiep: 'Đã xoá tài liệu.' });
  }),
);

/** Gợi ý mã thiết bị khi gắn thành phần / gắn đích — tìm theo mã hoặc tên. */
wikiRouter.get(
  '/goi-y-ma',
  batAsync(async (req, res) => {
    const { tuKhoa } = z.object({ tuKhoa: z.string().trim().min(1).max(64) }).parse(req.query);
    const muc = await prisma.asset.findMany({
      where: {
        deletedAt: null,
        OR: [{ code: { contains: tuKhoa } }, { name: { contains: tuKhoa } }],
      },
      // Không lấy `value`: wiki không hiển thị thông tin giá ở bất kỳ đâu.
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 20,
    });
    res.json({ ok: true, muc });
  }),
);
