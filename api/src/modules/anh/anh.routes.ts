/**
 * Ảnh: tải lên và phục vụ lại.
 *
 * Ảnh là BẰNG CHỨNG của mỗi lần xuất/nhập kho (nguyên tắc bất biến #3), nên:
 *   - file nằm ngoài thư mục web tĩnh, chỉ đọc được qua endpoint có xác thực;
 *   - vai trò TRUONG/NHAN_SU chỉ xem được ảnh thuộc phạm vi dữ liệu của họ;
 *   - không có endpoint sửa ảnh — muốn thay thì tải ảnh mới và gắn lại.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { LOAI_ANH } from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi400, loi403, loi404 } from '../../lib/loi-http.js';
import { duongDanTuyetDoi, luuAnh, xoaFileAnh } from '../../lib/luu-anh.js';
import { dieuKienTaiSan, dieuKienYeuCau, phamViCua } from '../../lib/pham-vi.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
} from '../../middleware/xac-thuc.js';

export const anhRouter = Router();
anhRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

const nhanAnh = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
}).single('anh');

const nhanAnhAnToan: RequestHandler = (req, res, next) => {
  nhanAnh(req, res, (loi: unknown) => {
    if (!loi) {
      next();
      return;
    }
    if (loi instanceof multer.MulterError) {
      next(
        loi.code === 'LIMIT_FILE_SIZE'
          ? loi400(
              `Ảnh vượt quá ${Math.round(env.UPLOAD_MAX_BYTES / 1024 / 1024)}MB.`,
              'ANH_QUA_LON',
            )
          : loi400(`Không nhận được ảnh: ${loi.message}`, 'ANH_KHONG_HOP_LE'),
      );
      return;
    }
    next(loi400(loi instanceof Error ? loi.message : 'Ảnh không hợp lệ.', 'ANH_KHONG_HOP_LE'));
  });
};

const luocDoGanAnh = z.object({
  kind: z.enum(LOAI_ANH),
  assetId: z.string().trim().max(30).optional(),
  requestId: z.string().trim().max(30).optional(),
  movementId: z.string().trim().max(30).optional(),
  countItemId: z.string().trim().max(30).optional(),
  /** Toạ độ lúc chụp, nếu thiết bị cho phép — để đối chiếu hiện trường. */
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * Tải ảnh lên. Ảnh có thể gắn sẵn vào thiết bị/yêu cầu ngay lúc tải, hoặc để
 * trống rồi luồng xuất/nhập kho gắn vào movement sau.
 */
anhRouter.post(
  '/',
  nhanAnhAnToan,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const tep = req.file;
    if (!tep) throw loi400('Chưa chọn ảnh để tải lên (trường "anh").', 'THIEU_ANH');

    const gan = luocDoGanAnh.parse(req.body);

    // Ảnh gắn vào thiết bị nào thì thiết bị đó phải nằm trong phạm vi của người tải.
    //
    // NGOẠI LỆ: ảnh chụp cho chính PHIẾU của mình. Không còn bước duyệt, nhân sự
    // tự chụp ảnh xuất kho chiếc robot mình mượn — robot đó còn ở kho, chưa thuộc
    // phạm vi của họ, nên trước đây ảnh đầu tiên đã bị chặn 404. Cho qua khi phiếu
    // nằm trong phạm vi người tải VÀ phiếu có đúng thiết bị đó.
    if (gan.assetId) {
      const trongPhamVi = await prisma.asset.findFirst({
        where: { id: gan.assetId, ...dieuKienTaiSan(actor) },
        select: { id: true },
      });
      const quaPhieu =
        !trongPhamVi && gan.requestId
          ? await prisma.request.findFirst({
              where: {
                AND: [
                  { id: gan.requestId },
                  dieuKienYeuCau(actor),
                  { items: { some: { assetId: gan.assetId } } },
                ],
              },
              select: { id: true },
            })
          : null;
      if (!trongPhamVi && !quaPhieu) {
        throw loi404('Thiết bị không tồn tại hoặc ngoài phạm vi của bạn.');
      }
    }

    const daLuu = await luuAnh(tep);
    try {
      const anh = await prisma.photo.create({
        data: {
          kind: gan.kind,
          ...daLuu,
          assetId: gan.assetId ?? null,
          requestId: gan.requestId ?? null,
          movementId: gan.movementId ?? null,
          countItemId: gan.countItemId ?? null,
          latitude: gan.latitude ?? null,
          longitude: gan.longitude ?? null,
          uploadedById: actor.id,
        },
        select: { id: true, kind: true, width: true, height: true, byteSize: true, createdAt: true },
      });

      await ghiAudit({
        actor,
        action: 'photo.upload',
        entityType: 'photo',
        entityId: anh.id,
        afterValue: {
          kind: anh.kind,
          byteSize: anh.byteSize,
          assetId: gan.assetId ?? null,
          requestId: gan.requestId ?? null,
        },
        photoIds: [anh.id],
        ...boiCanh(req),
      });

      res.status(201).json({ ok: true, anh });
    } catch (loi) {
      // Ghi CSDL hỏng thì đừng để file mồ côi nằm lại trên đĩa.
      await xoaFileAnh(daLuu.filePath);
      throw loi;
    }
  }),
);

/**
 * Phục vụ file ảnh. Kiểm quyền theo phạm vi vai trò TRƯỚC khi mở file.
 * Ảnh không gắn thiết bị nào (vd ảnh nền kiosk) chỉ người tải và ADMIN/VAN_HANH xem.
 */
anhRouter.get(
  '/:id',
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const anh = await prisma.photo.findUnique({
      where: { id: String(req.params['id']) },
      select: {
        id: true,
        filePath: true,
        mimeType: true,
        byteSize: true,
        assetId: true,
        uploadedById: true,
        onsiteVisit: { select: { locationId: true, deletedAt: true } },
      },
    });
    if (!anh) throw loi404('Không tìm thấy ảnh.');

    const pv = phamViCua(actor);
    // Người tải ảnh luôn xem lại được ảnh của chính mình.
    if (!pv.toanBoKho && anh.uploadedById !== actor.id) {
      if (anh.onsiteVisit && !anh.onsiteVisit.deletedAt) {
        // Ảnh cập nhật onsite: theo phạm vi điểm trường — trường xem ảnh của
        // trường mình, nhân sự xem mọi trường (cùng quy tắc với /api/onsite).
        if (pv.diaDiem && !pv.diaDiem.includes(anh.onsiteVisit.locationId)) {
          throw loi403('Ảnh này không thuộc phạm vi dữ liệu của bạn.');
        }
      } else if (anh.assetId) {
        const trongPhamVi = await prisma.asset.findFirst({
          where: { id: anh.assetId, ...dieuKienTaiSan(actor) },
          select: { id: true },
        });
        if (!trongPhamVi) throw loi403('Ảnh này không thuộc phạm vi dữ liệu của bạn.');
      } else if (anh.uploadedById !== actor.id) {
        throw loi403('Ảnh này không thuộc phạm vi dữ liệu của bạn.');
      }
    }

    const dayDu = duongDanTuyetDoi(anh.filePath);
    if (!dayDu) throw loi404('Đường dẫn ảnh không hợp lệ.');
    try {
      await stat(dayDu);
    } catch {
      throw loi404('File ảnh không còn trên ổ đĩa.');
    }

    res.setHeader('Content-Type', anh.mimeType);
    res.setHeader('Content-Length', String(anh.byteSize));
    // Ảnh bất biến (tên file là ngẫu nhiên) nên cache lâu được, nhưng phải riêng tư.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    createReadStream(dayDu).pipe(res);
  }),
);
