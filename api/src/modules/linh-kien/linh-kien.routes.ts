/**
 * LINH KIỆN THAY THẾ — lấy linh kiện ra khỏi kho để sửa robot.
 *
 * Quyết định của LtL: KHÔNG qua bước duyệt, vì robot hỏng giữa giờ dạy thì chờ
 * duyệt là mất tiết. Bù lại BẮT BUỘC gắn vào một phiếu báo hỏng đang mở — nhờ
 * vậy vẫn giữ tinh thần nguyên tắc bất biến #2: mỗi lần linh kiện rời kho đều
 * có chứng từ gốc, và vì báo hỏng đã trỏ tới thiết bị nên truy được linh kiện
 * lắp vào robot nào mà không phải bắt người ở kho chọn lại.
 *
 * Hai dạng linh kiện:
 *   - CÓ MÃ trong kho → trừ tồn thật, sinh kèm movement XUAT_LINH_KIEN để tồn
 *     vẫn suy ra từ movements (nguyên tắc #5). Chặn nếu xuất quá tồn.
 *   - KHÔNG CÓ MÃ     → bắt buộc ẢNH + (tên linh kiện HOẶC mã hãng cung cấp).
 *     Không trừ tồn của ai vì nó chưa từng nằm trong sổ.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi400, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { tonTaiDiaDiem } from '../../lib/ton-kho.js';
import { dieuKienTaiSan } from '../../lib/pham-vi.js';
import { phatChoNhomSuCo, SU_KIEN } from '../../realtime.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';

export const linhKienRouter = Router();
linhKienRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

/** Ai được lấy linh kiện: người đứng ở kho, và cấp trên của họ. */
const yeuCauNguoiKho = yeuCauVaiTro('ADMIN', 'VAN_HANH', 'KHO');

const CHON = {
  id: true,
  code: true,
  quantity: true,
  partName: true,
  vendorCode: true,
  note: true,
  issuedAt: true,
  asset: { select: { id: true, code: true, name: true } },
  reason: { select: { id: true, name: true } },
  fromLocation: { select: { id: true, name: true } },
  issuedBy: { select: { id: true, fullName: true, email: true } },
  request: {
    select: {
      id: true,
      code: true,
      status: true,
      items: {
        select: {
          asset: {
            select: {
              id: true,
              code: true,
              name: true,
              currentLocation: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
  photos: { select: { id: true, kind: true } },
} as const;

// ------------------------------------------------------------ LÝ DO THAY

/** Danh mục lý do thay — mọi vai trò đều đọc được để đổ vào ô chọn. */
linhKienRouter.get(
  '/ly-do',
  batAsync(async (_req, res) => {
    const muc = await prisma.partReplacementReason.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json({ ok: true, muc });
  }),
);

const luocDoLyDo = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Lý do phải có ít nhất 3 ký tự.')
    .max(191, 'Lý do quá dài.'),
});

/**
 * Thêm lý do mới ngay tại chỗ khi gặp hiện tượng chưa có trong danh sách.
 *
 * Trùng tên thì TRẢ VỀ bản ghi cũ chứ không báo lỗi: người ở kho đang giữa lúc
 * sửa robot, bắt họ xử lý một thông báo lỗi chỉ vì người khác vừa thêm đúng lý
 * do đó là vô ích. Danh mục cũng không phình ra vì tên là UNIQUE.
 */
linhKienRouter.post(
  '/ly-do',
  yeuCauNguoiKho,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const { name } = luocDoLyDo.parse(req.body);

    const daCo = await prisma.partReplacementReason.findUnique({
      where: { name },
      select: { id: true, name: true, isActive: true },
    });
    if (daCo) {
      // Đã từng có nhưng bị ẩn → bật lại, đỡ phải tạo bản trùng nghĩa.
      if (!daCo.isActive) {
        await prisma.partReplacementReason.update({
          where: { id: daCo.id },
          data: { isActive: true },
        });
      }
      res.json({ ok: true, lyDo: { id: daCo.id, name: daCo.name }, daCoSan: true });
      return;
    }

    const lyDo = await prisma.partReplacementReason.create({
      data: { name, createdById: actor.id },
      select: { id: true, name: true },
    });
    await ghiAudit({
      actor,
      action: 'part_reason.create',
      entityType: 'part_replacement_reason',
      entityId: lyDo.id,
      afterValue: { name },
      ...boiCanh(req),
    });
    res.status(201).json({ ok: true, lyDo, daCoSan: false });
  }),
);

// -------------------------------------------------------------- LẤY LINH KIỆN

const luocDoLay = z
  .object({
    /** Phiếu báo hỏng gốc — bắt buộc. */
    baoHongId: z.string().trim().min(1).max(30),
    /** Mã linh kiện trong kho. Bỏ trống = linh kiện không có mã. */
    maLinhKien: z.string().trim().toUpperCase().max(64).optional(),
    /** Tên linh kiện tự nhập — dùng khi không có mã. */
    tenLinhKien: z.string().trim().min(2).max(191).optional(),
    /** Mã của hãng cung cấp, vd "MG996R" — dùng khi không có mã. */
    maHang: z.string().trim().min(2).max(128).optional(),
    soLuong: z.coerce.number().int().positive().max(100_000),
    lyDoId: z.string().trim().min(1).max(30),
    ghiChu: z.string().trim().max(2000).optional(),
    /** Ảnh linh kiện — bắt buộc khi không có mã. */
    anhIds: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
  })
  .refine((v) => Boolean(v.maLinhKien) || Boolean(v.tenLinhKien) || Boolean(v.maHang), {
    message:
      'Linh kiện không có mã trong kho thì phải điền TÊN linh kiện hoặc MÃ của hãng cung cấp.',
  })
  // Không có mã kho thì ảnh là bắt buộc: đây là bằng chứng duy nhất cho thấy
  // linh kiện đó thật sự tồn tại và đã được lấy ra.
  .refine((v) => Boolean(v.maLinhKien) || v.anhIds.length > 0, {
    message: 'Linh kiện không có mã trong kho thì BẮT BUỘC chụp ảnh linh kiện.',
  });

linhKienRouter.post(
  '/',
  yeuCauNguoiKho,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoLay.parse(req.body);

    const baoHong = await prisma.request.findUnique({
      where: { id: duLieu.baoHongId },
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        items: {
          select: {
            asset: { select: { id: true, code: true, name: true, currentLocationId: true } },
          },
        },
      },
    });
    if (!baoHong) throw loi404('Không tìm thấy phiếu báo hỏng.');
    if (baoHong.type !== 'BAO_HONG') {
      throw loi400('Phiếu gắn kèm phải là phiếu báo hỏng.', 'SAI_LOAI');
    }
    if (baoHong.status === 'DA_HOAN_TAT') {
      throw loi409(
        `Phiếu báo hỏng ${baoHong.code} đã đóng. Mở lại phiếu hoặc lập phiếu báo hỏng mới trước khi lấy linh kiện.`,
      );
    }

    const lyDo = await prisma.partReplacementReason.findFirst({
      where: { id: duLieu.lyDoId, isActive: true },
      select: { id: true, name: true },
    });
    if (!lyDo) throw loi404('Không tìm thấy lý do thay này, hoặc lý do đã bị ẩn.');

    // Ảnh phải tồn tại, đúng loại, và chưa gắn vào phiếu nào khác.
    if (duLieu.anhIds.length > 0) {
      const anh = await prisma.photo.findMany({
        where: { id: { in: duLieu.anhIds } },
        select: { id: true, kind: true, partIssueId: true },
      });
      if (anh.length !== duLieu.anhIds.length) {
        throw loi422('Có ảnh không tồn tại trong hệ thống.', 'ANH_KHONG_TON_TAI');
      }
      if (anh.some((a) => a.kind !== 'LINH_KIEN')) {
        throw loi422('Ảnh phải được tải lên với loại "Ảnh linh kiện".', 'ANH_SAI_LOAI');
      }
      if (anh.some((a) => a.partIssueId !== null)) {
        throw loi422('Có ảnh đã gắn vào một phiếu linh kiện khác.', 'ANH_DA_DUNG');
      }
    }

    // --- Nhánh CÓ MÃ: phải tìm được trong phạm vi, và còn đủ tồn ---
    let linhKien: { id: string; code: string; name: string } | null = null;
    let khoXuatId: string | null = null;
    if (duLieu.maLinhKien) {
      const ts = await prisma.asset.findFirst({
        where: { code: duLieu.maLinhKien, ...dieuKienTaiSan(actor) },
        select: { id: true, code: true, name: true, currentLocationId: true, condition: true },
      });
      if (!ts) {
        throw loi404(
          `Không tìm thấy linh kiện mã ${duLieu.maLinhKien} trong phạm vi của bạn. ` +
            'Nếu linh kiện chưa có mã, hãy để trống ô mã và điền tên hoặc mã hãng kèm ảnh.',
        );
      }
      if (!ts.currentLocationId) {
        throw loi422(
          `Linh kiện ${ts.code} không ở kho nào nên không xuất được.`,
          'KHONG_O_KHO',
        );
      }
      linhKien = { id: ts.id, code: ts.code, name: ts.name };
      khoXuatId = ts.currentLocationId;
    }

    const phieu = await prisma.$transaction(async (tx) => {
      let movementId: string | null = null;

      if (linhKien && khoXuatId) {
        // Kiểm tồn TRONG transaction: hai người cùng lấy một linh kiện thì
        // người sau phải thấy số tồn đã trừ, không phải số lúc mở form.
        const ton = await tonTaiDiaDiem(linhKien.id, khoXuatId, tx);
        if (ton < duLieu.soLuong) {
          throw loi422(
            `Kho chỉ còn ${ton} ${linhKien.code}, không đủ ${duLieu.soLuong}.`,
            'KHONG_DU_TON',
            { ton, canLay: duLieu.soLuong },
          );
        }
        const dc = await tx.movement.create({
          data: {
            assetId: linhKien.id,
            type: 'XUAT_LINH_KIEN',
            fromLocationId: khoXuatId,
            // toLocationId null = ra khỏi hệ thống: linh kiện đã lắp vào robot,
            // không còn là một đơn vị tồn kho riêng nữa.
            toLocationId: null,
            requestId: baoHong.id,
            quantity: duLieu.soLuong,
            performedById: actor.id,
            note: `Thay cho ${baoHong.code}: ${lyDo.name}`,
          },
          select: { id: true },
        });
        movementId = dc.id;
      }

      const so = await capSoChungTu(tx, TIEN_TO.LINH_KIEN);
      const taoMoi = await tx.partIssue.create({
        data: {
          code: so,
          requestId: baoHong.id,
          assetId: linhKien?.id ?? null,
          partName: duLieu.tenLinhKien ?? null,
          vendorCode: duLieu.maHang ?? null,
          quantity: duLieu.soLuong,
          reasonId: lyDo.id,
          note: duLieu.ghiChu ?? null,
          fromLocationId: khoXuatId,
          movementId,
          issuedById: actor.id,
        },
        select: CHON,
      });

      if (duLieu.anhIds.length > 0) {
        await tx.photo.updateMany({
          where: { id: { in: duLieu.anhIds } },
          data: {
            partIssueId: taoMoi.id,
            requestId: baoHong.id,
            ...(linhKien ? { assetId: linhKien.id } : {}),
            ...(movementId ? { movementId } : {}),
          },
        });
      }

      await ghiAudit(
        {
          actor,
          action: 'part_issue.create',
          entityType: 'part_issue',
          entityId: taoMoi.id,
          afterValue: {
            code: so,
            baoHong: baoHong.code,
            maLinhKien: linhKien?.code ?? null,
            tenLinhKien: duLieu.tenLinhKien ?? null,
            maHang: duLieu.maHang ?? null,
            soLuong: duLieu.soLuong,
            lyDo: lyDo.name,
          },
          photoIds: duLieu.anhIds,
          note: duLieu.ghiChu ?? lyDo.name,
          ...boiCanh(req),
        },
        tx,
      );
      // Đọc LẠI sau khi gắn ảnh. Bản `taoMoi` được chọn TRƯỚC bước
      // photo.updateMany nên mảng photos của nó luôn rỗng — phản hồi sẽ báo
      // "không có ảnh" dù ảnh đã nằm trong CSDL. Đã đo thấy đúng lỗi này.
      return tx.partIssue.findUniqueOrThrow({ where: { id: taoMoi.id }, select: CHON });
    });

    const ten = linhKien ? `${linhKien.code} — ${linhKien.name}` : (duLieu.tenLinhKien ?? duLieu.maHang);
    phatChoNhomSuCo(SU_KIEN.KHO_DOI, {
      id: phieu.id,
      code: phieu.code,
      thongDiep: `Lấy ${duLieu.soLuong} ${ten} cho ${baoHong.code} — ${lyDo.name}.`,
    });

    res.status(201).json({ ok: true, phieu });
  }),
);

// ------------------------------------------------------------------ TRA CỨU

const luocDoLoc = z.object({
  /** Lọc theo phiếu báo hỏng. */
  baoHongId: z.string().trim().max(30).optional(),
  /** Lọc theo điểm lưu trữ của thiết bị được sửa — xem lịch sử theo trường. */
  diaDiemId: z.string().trim().max(30).optional(),
  moiTrang: z.coerce.number().int().positive().max(200).default(50),
});

/** Lịch sử lấy linh kiện. Lọc theo phiếu báo hỏng hoặc theo điểm trường. */
linhKienRouter.get(
  '/',
  batAsync(async (req, res) => {
    const nguoiDung = nguoiDungHienTai(req);
    const loc = luocDoLoc.parse(req.query);

    const muc = await prisma.partIssue.findMany({
      where: {
        ...(loc.baoHongId ? { requestId: loc.baoHongId } : {}),
        // Phạm vi vai trò: gọi thẳng API cũng không xem được việc của trường khác.
        request: {
          items: {
            some: {
              asset: {
                // AND: dieuKienTaiSan đặt `currentLocationId` cho vai trò
                // TRUONG, nên spread một currentLocationId khác từ query sẽ
                // ghi đè phạm vi. Đo thật: trường xem được 9 phiếu của kho.
                AND: [
                  dieuKienTaiSan(nguoiDung),
                  ...(loc.diaDiemId ? [{ currentLocationId: loc.diaDiemId }] : []),
                ],
              },
            },
          },
        },
      },
      select: CHON,
      orderBy: { issuedAt: 'desc' },
      take: loc.moiTrang,
    });
    res.json({ ok: true, muc });
  }),
);
