/**
 * Danh mục nền: dòng giải pháp và loại tài sản.
 * Đọc: mọi tài khoản đã đăng nhập (form tạo thiết bị cần).
 * Ghi: ADMIN và VAN_HANH. Xoá: chỉ ADMIN, và chỉ khi chưa có thiết bị nào dùng.
 */
import { Router } from 'express';
import type { AssetOrigin, AssetPurpose, Prisma } from '@prisma/client';
import { z } from 'zod';
import { KIEU_QUAN_LY } from '@ltl/taisan-shared';
import { prisma } from '../../prisma.js';
import { batAsync } from '../../lib/bat-async.js';
import { boiCanh, ghiAudit } from '../../lib/audit.js';
import { loi404, loi409 } from '../../lib/loi-http.js';
import {
  chanKhiChuaDoiMatKhau,
  nguoiDungHienTai,
  yeuCauAdmin,
  yeuCauDangNhap,
  yeuCauVaiTro,
} from '../../middleware/xac-thuc.js';

export const danhMucRouter = Router();
danhMucRouter.use(yeuCauDangNhap, chanKhiChuaDoiMatKhau);

const chiSuaDuoc = yeuCauVaiTro('ADMIN', 'VAN_HANH');

/** Mã danh mục: CHỮ HOA, số và gạch dưới — dùng trong file Excel nhập liệu. */
const maDanhMuc = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'Mã phải có ít nhất 2 ký tự.')
  .max(64)
  .regex(/^[A-Z0-9_]+$/, 'Mã chỉ gồm chữ in hoa, số và dấu gạch dưới.');

const luocDoDongGiaiPhap = z.object({
  code: maDanhMuc,
  name: z.string().trim().min(1, 'Chưa nhập tên.').max(191),
  note: z.string().trim().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const luocDoLoaiTaiSan = luocDoDongGiaiPhap.extend({
  defaultTrackingType: z.enum(KIEU_QUAN_LY).default('DON_VI'),
  /**
   * Loại này có bắt buộc quét/gõ đúng mã thiết bị khi xuất–nhập kho hay không.
   * Chỉ nên bật cho loại có dán nhãn mã trên từng cái (robot); loại còn lại khai
   * TÊN + SỐ LƯỢNG kèm ảnh, vì thùng 200 quyển vở không có nhãn nào để quét.
   */
  yeuCauQuetMa: z.boolean().default(false),
});

// ---------------------------------------------------------------- dòng giải pháp

danhMucRouter.get(
  '/dong-giai-phap',
  batAsync(async (_req, res) => {
    const muc = await prisma.productLine.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assets: true } } },
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

danhMucRouter.post(
  '/dong-giai-phap',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoDongGiaiPhap.parse(req.body);
    if (await prisma.productLine.findUnique({ where: { code: duLieu.code }, select: { id: true } })) {
      throw loi409('Mã dòng giải pháp đã tồn tại.', { truong: 'code' });
    }
    const muc = await prisma.productLine.create({
      data: { ...duLieu, note: duLieu.note ?? null },
    });
    await ghiAudit({
      actor,
      action: 'product_line.create',
      entityType: 'product_line',
      entityId: muc.id,
      afterValue: { code: muc.code, name: muc.name },
      ...boiCanh(req),
    });
    res.status(201).json({ ok: true, muc });
  }),
);

danhMucRouter.patch(
  '/dong-giai-phap/:id',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const duLieu = luocDoDongGiaiPhap.partial().omit({ code: true }).parse(req.body);
    const truoc = await prisma.productLine.findUnique({ where: { id } });
    if (!truoc) throw loi404('Không tìm thấy dòng giải pháp.');

    const sau = await prisma.productLine.update({
      where: { id },
      data: {
        ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
        ...(duLieu.note === undefined ? {} : { note: duLieu.note || null }),
        ...(duLieu.sortOrder === undefined ? {} : { sortOrder: duLieu.sortOrder }),
        ...(duLieu.isActive === undefined ? {} : { isActive: duLieu.isActive }),
      },
    });
    await ghiAudit({
      actor,
      action: 'product_line.update',
      entityType: 'product_line',
      entityId: id,
      beforeValue: { name: truoc.name, isActive: truoc.isActive, sortOrder: truoc.sortOrder },
      afterValue: { name: sau.name, isActive: sau.isActive, sortOrder: sau.sortOrder },
      ...boiCanh(req),
    });
    res.json({ ok: true, muc: sau });
  }),
);

danhMucRouter.delete(
  '/dong-giai-phap/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.productLine.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    if (!truoc) throw loi404('Không tìm thấy dòng giải pháp.');
    if (truoc._count.assets > 0) {
      throw loi409(
        `Còn ${truoc._count.assets} thiết bị thuộc dòng này nên không xoá được. Hãy đặt Ngừng dùng thay vì xoá.`,
        { soThietBi: truoc._count.assets },
      );
    }
    await prisma.$transaction(async (tx) => {
      await ghiAudit(
        {
          actor,
          action: 'product_line.delete',
          entityType: 'product_line',
          entityId: id,
          beforeValue: { code: truoc.code, name: truoc.name },
          ...boiCanh(req),
        },
        tx,
      );
      await tx.productLine.delete({ where: { id } });
    });
    res.json({ ok: true, thongDiep: 'Đã xoá dòng giải pháp.' });
  }),
);

// ------------------------------------------------------------------ loại tài sản

danhMucRouter.get(
  '/loai-tai-san',
  batAsync(async (_req, res) => {
    const muc = await prisma.assetCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assets: true } } },
    });
    res.json({ ok: true, muc, tong: muc.length });
  }),
);

danhMucRouter.post(
  '/loai-tai-san',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const duLieu = luocDoLoaiTaiSan.parse(req.body);
    if (await prisma.assetCategory.findUnique({ where: { code: duLieu.code }, select: { id: true } })) {
      throw loi409('Mã loại tài sản đã tồn tại.', { truong: 'code' });
    }
    const muc = await prisma.assetCategory.create({
      data: { ...duLieu, note: duLieu.note ?? null },
    });
    await ghiAudit({
      actor,
      action: 'asset_category.create',
      entityType: 'asset_category',
      entityId: muc.id,
      afterValue: { code: muc.code, name: muc.name },
      ...boiCanh(req),
    });
    res.status(201).json({ ok: true, muc });
  }),
);

danhMucRouter.patch(
  '/loai-tai-san/:id',
  chiSuaDuoc,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const duLieu = luocDoLoaiTaiSan.partial().omit({ code: true }).parse(req.body);
    const truoc = await prisma.assetCategory.findUnique({ where: { id } });
    if (!truoc) throw loi404('Không tìm thấy loại tài sản.');

    const sau = await prisma.assetCategory.update({
      where: { id },
      data: {
        ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
        ...(duLieu.note === undefined ? {} : { note: duLieu.note || null }),
        ...(duLieu.sortOrder === undefined ? {} : { sortOrder: duLieu.sortOrder }),
        ...(duLieu.isActive === undefined ? {} : { isActive: duLieu.isActive }),
        ...(duLieu.defaultTrackingType === undefined
          ? {}
          : { defaultTrackingType: duLieu.defaultTrackingType }),
        ...(duLieu.yeuCauQuetMa === undefined ? {} : { yeuCauQuetMa: duLieu.yeuCauQuetMa }),
      },
    });
    await ghiAudit({
      actor,
      action: 'asset_category.update',
      entityType: 'asset_category',
      entityId: id,
      beforeValue: {
        name: truoc.name,
        defaultTrackingType: truoc.defaultTrackingType,
        yeuCauQuetMa: truoc.yeuCauQuetMa,
      },
      afterValue: {
        name: sau.name,
        defaultTrackingType: sau.defaultTrackingType,
        yeuCauQuetMa: sau.yeuCauQuetMa,
      },
      ...boiCanh(req),
    });
    res.json({ ok: true, muc: sau });
  }),
);

danhMucRouter.delete(
  '/loai-tai-san/:id',
  yeuCauAdmin,
  batAsync(async (req, res) => {
    const actor = nguoiDungHienTai(req);
    const id = String(req.params['id']);
    const truoc = await prisma.assetCategory.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    if (!truoc) throw loi404('Không tìm thấy loại tài sản.');
    if (truoc._count.assets > 0) {
      throw loi409(
        `Còn ${truoc._count.assets} thiết bị thuộc loại này nên không xoá được. Hãy đặt Ngừng dùng thay vì xoá.`,
        { soThietBi: truoc._count.assets },
      );
    }
    await prisma.$transaction(async (tx) => {
      await ghiAudit(
        {
          actor,
          action: 'asset_category.delete',
          entityType: 'asset_category',
          entityId: id,
          beforeValue: { code: truoc.code, name: truoc.name },
          ...boiCanh(req),
        },
        tx,
      );
      await tx.assetCategory.delete({ where: { id } });
    });
    res.json({ ok: true, thongDiep: 'Đã xoá loại tài sản.' });
  }),
);

// ------------------------------------------------- nguồn gốc & mục đích sử dụng

/**
 * Hai danh sách này trước đây là enum cứng trong mã nguồn — muốn thêm một nguồn
 * gốc phải sửa code, chạy migration, triển khai lại. Giờ là bảng tra cứu, thêm
 * ngay trong ứng dụng.
 *
 * Bốn giá trị nạp sẵn KHÔNG có đặc quyền gì: sửa tên được, xoá được nếu chưa
 * thiết bị nào dùng — đúng như loại tài sản và dòng giải pháp.
 */

/**
 * Sinh mã từ tên khi người dùng thêm nhanh ngay trong form thiết bị.
 *
 * Họ chỉ gõ "Phụ huynh tặng", không ai muốn nghĩ thêm một cái mã viết hoa.
 * Nhưng mã vẫn phải có vì file Excel nhập liệu và vài chỗ gọi theo mã cố định
 * (tạo nhanh dùng KHAC, kiosk dùng CO_DINH_TAI_KHO) tra theo nó.
 */
function maTuTen(ten: string): string {
  const ma = ten
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  // Tên toàn ký tự lạ thì vẫn phải ra một mã dùng được, không để rỗng.
  return ma || `MUC_${Date.now().toString(36).toUpperCase()}`;
}

/** Mã đã có thì thêm _2, _3… thay vì bắt người dùng đặt lại tên. */
async function maChuaDung(
  goc: string,
  daCo: (ma: string) => Promise<boolean>,
): Promise<string> {
  if (!(await daCo(goc))) return goc;
  for (let i = 2; i <= 50; i++) {
    const thu = `${goc.slice(0, 60)}_${i}`;
    if (!(await daCo(thu))) return thu;
  }
  throw loi409('Không sinh được mã chưa trùng. Hãy đặt tên khác.', { truong: 'name' });
}

const luocDoBangTraCuu = z.object({
  /** Bỏ trống thì sinh từ tên — dùng cho luồng "thêm nhanh" trong form thiết bị. */
  code: maDanhMuc.optional(),
  name: z.string().trim().min(1, 'Chưa nhập tên.').max(191),
  note: z.string().trim().max(2000).optional(),
  /** Bỏ trống thì xếp xuống CUỐI danh sách (xem `thuTuCuoi`). */
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().default(true),
});

/**
 * Hai bảng giống hệt nhau nên dùng CHUNG một bộ tuyến thay vì chép hai lần —
 * chép hai lần thì sớm muộn sửa một bên quên bên kia.
 *
 * Không dùng được `typeof prisma.assetOrigin` làm kiểu chung: Prisma sinh hai
 * delegate khác nhau về danh nghĩa dù cấu trúc y hệt. Nên khai một giao diện hẹp
 * đúng phần đang dùng, rồi ép kiểu ở chỗ gọi.
 */
interface HangTraCuu {
  id: string;
  code: string;
  name: string;
  note: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface BangTraCuu {
  findMany(args: {
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
    include: { _count: { select: { assets: true } } };
  }): Promise<Array<HangTraCuu & { _count: { assets: number } }>>;
  // Ba dạng nạp chồng, để mỗi chỗ gọi nhận đúng kiểu nó cần: chỉ dò tồn tại,
  // lấy kèm số thiết bị đang dùng, hay lấy cả hàng.
  findUnique(args: { where: { code: string }; select: { id: true } }): Promise<{ id: string } | null>;
  findUnique(args: {
    where: { id: string };
    include: { _count: { select: { assets: true } } };
  }): Promise<(HangTraCuu & { _count: { assets: number } }) | null>;
  findUnique(args: { where: { id: string } }): Promise<HangTraCuu | null>;
  findFirst(args: {
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
    select: { sortOrder: true };
  }): Promise<{ sortOrder: number } | null>;
  create(args: { data: Omit<HangTraCuu, 'id'> }): Promise<HangTraCuu>;
  update(args: { where: { id: string }; data: Partial<Omit<HangTraCuu, 'id'>> }): Promise<HangTraCuu>;
}

/**
 * CHỐT CHẶN BIÊN DỊCH cho phép ép kiểu ở trên.
 *
 * Nếu sau này ai thêm một cột vào `AssetOrigin` mà quên `AssetPurpose` (hoặc
 * ngược lại), dòng này đỏ ngay — thay vì bộ tuyến dùng chung lặng lẽ bỏ sót cột
 * đó ở một trong hai bảng.
 */
type PhaiGiongNhau<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _haiBangPhaiGiongNhau: PhaiGiongNhau<AssetOrigin, AssetPurpose> = true;
void _haiBangPhaiGiongNhau;

/**
 * Thứ tự để mục mới nằm CUỐI ô chọn.
 *
 * Mặc định 0 thì mục vừa thêm nhảy lên TRÊN cả bốn mục quen thuộc — người dùng
 * mở ô chọn ra thấy thứ tự đổi, tưởng mình bấm nhầm. Cộng 10 để sau này còn chỗ
 * chèn tay giữa hai mục.
 */
async function thuTuCuoi(bang: BangTraCuu): Promise<number> {
  const cuoi = await bang.findFirst({
    orderBy: [{ sortOrder: 'desc' }],
    select: { sortOrder: true },
  });
  return Math.min(9999, (cuoi?.sortOrder ?? 0) + 10);
}

function dangKyBangTraCuu(cauHinh: {
  duong: string;
  /** Dùng trong thông điệp: "Không tìm thấy nguồn gốc." */
  ten: string;
  /** Dùng trong nhật ký kiểm toán: asset_origin.create… */
  entityType: string;
  bang: BangTraCuu;
  /** Xoá trong CÙNG transaction với dòng nhật ký kiểm toán. */
  xoaTrongTx: (tx: Prisma.TransactionClient, id: string) => Promise<unknown>;
}): void {
  const { duong, ten, entityType, bang, xoaTrongTx } = cauHinh;

  danhMucRouter.get(
    duong,
    batAsync(async (_req, res) => {
      const muc = await bang.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { assets: true } } },
      });
      res.json({ ok: true, muc, tong: muc.length });
    }),
  );

  danhMucRouter.post(
    duong,
    // KHO cũng được thêm: họ là người đứng ở kho nhập thiết bị, gặp nguồn gốc
    // chưa có trong danh sách giữa lúc đang điền form. Bắt họ nhờ ADMIN thêm hộ
    // rồi quay lại điền từ đầu thì cuối cùng sẽ có người chọn bừa "Khác".
    yeuCauVaiTro('ADMIN', 'VAN_HANH', 'KHO'),
    batAsync(async (req, res) => {
      const actor = nguoiDungHienTai(req);
      const duLieu = luocDoBangTraCuu.parse(req.body);
      const daCo = async (ma: string): Promise<boolean> =>
        (await bang.findUnique({ where: { code: ma }, select: { id: true } })) !== null;

      let code: string;
      if (duLieu.code) {
        // Gõ tay mã trùng là lỗi của người dùng, phải báo — khác với mã tự sinh.
        if (await daCo(duLieu.code)) throw loi409(`Mã ${ten} đã tồn tại.`, { truong: 'code' });
        code = duLieu.code;
      } else {
        code = await maChuaDung(maTuTen(duLieu.name), daCo);
      }

      const muc = await bang.create({
        data: {
          code,
          name: duLieu.name,
          note: duLieu.note ?? null,
          sortOrder: duLieu.sortOrder ?? (await thuTuCuoi(bang)),
          isActive: duLieu.isActive,
        },
      });
      await ghiAudit({
        actor,
        action: `${entityType}.create`,
        entityType,
        entityId: muc.id,
        afterValue: { code: muc.code, name: muc.name },
        ...boiCanh(req),
      });
      res.status(201).json({ ok: true, muc });
    }),
  );

  danhMucRouter.patch(
    duong + '/:id',
    chiSuaDuoc,
    batAsync(async (req, res) => {
      const actor = nguoiDungHienTai(req);
      const id = String(req.params['id']);
      const duLieu = luocDoBangTraCuu.partial().omit({ code: true }).parse(req.body);
      const truoc = await bang.findUnique({ where: { id } });
      if (!truoc) throw loi404(`Không tìm thấy ${ten}.`);

      const sau = await bang.update({
        where: { id },
        data: {
          ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
          ...(duLieu.note === undefined ? {} : { note: duLieu.note || null }),
          ...(duLieu.sortOrder === undefined ? {} : { sortOrder: duLieu.sortOrder }),
          ...(duLieu.isActive === undefined ? {} : { isActive: duLieu.isActive }),
        },
      });
      await ghiAudit({
        actor,
        action: `${entityType}.update`,
        entityType,
        entityId: id,
        beforeValue: { name: truoc.name, isActive: truoc.isActive, sortOrder: truoc.sortOrder },
        afterValue: { name: sau.name, isActive: sau.isActive, sortOrder: sau.sortOrder },
        ...boiCanh(req),
      });
      res.json({ ok: true, muc: sau });
    }),
  );

  danhMucRouter.delete(
    duong + '/:id',
    yeuCauAdmin,
    batAsync(async (req, res) => {
      const actor = nguoiDungHienTai(req);
      const id = String(req.params['id']);
      const truoc = await bang.findUnique({
        where: { id },
        include: { _count: { select: { assets: true } } },
      });
      if (!truoc) throw loi404(`Không tìm thấy ${ten}.`);
      // Xoá giá trị mà thiết bị đang dùng thì những thiết bị đó mất phân loại,
      // không có đường dựng lại. "Ngừng dùng" giấu khỏi ô chọn mà giữ nguyên
      // bản ghi cũ — đó mới là cái người dùng thật sự muốn.
      if (truoc._count.assets > 0) {
        throw loi409(
          `Còn ${truoc._count.assets} thiết bị đang dùng ${ten} "${truoc.name}" nên không xoá được. Hãy đặt Ngừng dùng thay vì xoá, hoặc sửa ${ten} của các thiết bị đó trước.`,
          { soThietBi: truoc._count.assets },
        );
      }
      await prisma.$transaction(async (tx) => {
        await ghiAudit(
          {
            actor,
            action: `${entityType}.delete`,
            entityType,
            entityId: id,
            beforeValue: { code: truoc.code, name: truoc.name },
            ...boiCanh(req),
          },
          tx,
        );
        await xoaTrongTx(tx, id);
      });
      res.json({ ok: true, thongDiep: `Đã xoá ${ten}.` });
    }),
  );
}

dangKyBangTraCuu({
  duong: '/nguon-goc',
  ten: 'nguồn gốc',
  entityType: 'asset_origin',
  bang: prisma.assetOrigin as unknown as BangTraCuu,
  xoaTrongTx: (tx, id) => tx.assetOrigin.delete({ where: { id } }),
});

dangKyBangTraCuu({
  duong: '/muc-dich',
  ten: 'mục đích sử dụng',
  entityType: 'asset_purpose',
  bang: prisma.assetPurpose as unknown as BangTraCuu,
  xoaTrongTx: (tx, id) => tx.assetPurpose.delete({ where: { id } }),
});
