/**
 * MỌI phép đếm thiết bị ở tệp này đều lọc `deletedAt: null`.
 *
 * `_count: { select: { assets: true } }` trơn đếm CẢ thiết bị trong thùng rác,
 * nên cột "Thiết bị" ở trang Danh mục đứng yên sau khi người dùng xoá — đo thật:
 * xoá mềm một robot thì danh sách thiết bị về 7 mà Danh mục vẫn báo 8. Con số
 * không khớp với màn hình bên cạnh thì người dùng hết tin cả hai.
 *
 * Cùng lý do đó, số này cũng là số dùng để CHẶN xoá danh mục: đếm cả thiết bị
 * đã xoá thì một loại thực ra đã trống vẫn bị chặn mãi.
 *
 * Danh mục nền: dòng giải pháp và loại tài sản.
 * Đọc: mọi tài khoản đã đăng nhập (form tạo thiết bị cần).
 * Ghi: ADMIN và VAN_HANH. Xoá: chỉ ADMIN, và chỉ khi chưa có thiết bị nào dùng.
 */
import { Router } from 'express';
import type { AssetOrigin, AssetPurpose, Prisma } from '@prisma/client';
import { goiYVietTat, vietTatChuaDung } from '../../lib/sinh-ma-thiet-bi.js';
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

/**
 * Viết tắt dùng để sinh mã thiết bị. Bỏ trống thì server tự gợi ý từ tên.
 * Chỉ chữ in hoa và số — gạch ngang là dấu ngăn đoạn trong mã nên bị cấm.
 */
const luocDoVietTat = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Viết tắt không được để trống.')
  .max(10, 'Viết tắt tối đa 10 ký tự.')
  .regex(/^[A-Z0-9]+$/, 'Viết tắt chỉ gồm chữ in hoa không dấu và số.');

/**
 * Viết tắt cuối cùng cho một mục: dùng cái người dùng gõ, không có thì gợi ý từ
 * tên; trùng thì thêm số cho tới khi trống chỗ.
 *
 * Cố ý KHÔNG bắt người dùng tự nghĩ: họ thêm loại mới ngay giữa lúc đang điền
 * form thiết bị, hỏi thêm một ô nữa là đủ để có người bỏ cuộc.
 */
async function chotVietTat(
  mong: string | undefined,
  ten: string,
  daCo: (v: string) => Promise<boolean>,
): Promise<string> {
  if (mong) {
    // Người dùng gõ tay mà trùng thì phải BÁO, không tự đổi sau lưng họ.
    if (await daCo(mong)) {
      throw loi409(`Viết tắt ${mong} đã dùng cho mục khác.`, { truong: 'vietTat' });
    }
    return mong;
  }
  return vietTatChuaDung(goiYVietTat(ten), daCo);
}

const luocDoDongGiaiPhap = z.object({
  code: maDanhMuc,
  name: z.string().trim().min(1, 'Chưa nhập tên.').max(191),
  vietTat: luocDoVietTat.optional(),
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
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
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
    const vietTat = await chotVietTat(
      duLieu.vietTat,
      duLieu.name,
      async (v) =>
        (await prisma.productLine.findUnique({ where: { vietTat: v }, select: { id: true } })) !==
        null,
    );
    const muc = await prisma.productLine.create({
      data: { ...duLieu, vietTat, note: duLieu.note ?? null },
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

    if (duLieu.vietTat !== undefined) {
      const trung = await prisma.productLine.findUnique({
        where: { vietTat: duLieu.vietTat },
        select: { id: true },
      });
      if (trung && trung.id !== id) {
        throw loi409(`Viết tắt ${duLieu.vietTat} đã dùng cho mục khác.`, { truong: 'vietTat' });
      }
    }

    const sau = await prisma.productLine.update({
      where: { id },
      data: {
        ...(duLieu.vietTat === undefined ? {} : { vietTat: duLieu.vietTat }),
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
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
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
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
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
    const vietTat = await chotVietTat(
      duLieu.vietTat,
      duLieu.name,
      async (v) =>
        (await prisma.assetCategory.findUnique({ where: { vietTat: v }, select: { id: true } })) !==
        null,
    );
    const muc = await prisma.assetCategory.create({
      data: { ...duLieu, vietTat, note: duLieu.note ?? null },
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

    if (duLieu.vietTat !== undefined) {
      const trung = await prisma.assetCategory.findUnique({
        where: { vietTat: duLieu.vietTat },
        select: { id: true },
      });
      if (trung && trung.id !== id) {
        throw loi409(`Viết tắt ${duLieu.vietTat} đã dùng cho mục khác.`, { truong: 'vietTat' });
      }
    }

    const sau = await prisma.assetCategory.update({
      where: { id },
      data: {
        ...(duLieu.vietTat === undefined ? {} : { vietTat: duLieu.vietTat }),
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
      include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
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
  /** Chỉ nguồn gốc dùng (nằm trong mã thiết bị); mục đích sử dụng bỏ qua. */
  vietTat: luocDoVietTat.optional(),
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
    include: { _count: { select: { assets: { where: { deletedAt: null } } } } };
  }): Promise<Array<HangTraCuu & { _count: { assets: number } }>>;
  // Ba dạng nạp chồng, để mỗi chỗ gọi nhận đúng kiểu nó cần: chỉ dò tồn tại,
  // lấy kèm số thiết bị đang dùng, hay lấy cả hàng.
  findUnique(args: { where: { code: string }; select: { id: true } }): Promise<{ id: string } | null>;
  findUnique(args: {
    where: { id: string };
    include: { _count: { select: { assets: { where: { deletedAt: null } } } } };
  }): Promise<(HangTraCuu & { _count: { assets: number } }) | null>;
  findUnique(args: { where: { id: string } }): Promise<HangTraCuu | null>;
  findFirst(args: {
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
    select: { sortOrder: true };
  }): Promise<{ sortOrder: number } | null>;
  create(args: { data: Omit<HangTraCuu, 'id'> & { vietTat?: string } }): Promise<HangTraCuu>;
  update(args: {
    where: { id: string };
    data: Partial<Omit<HangTraCuu, 'id'>> & { vietTat?: string };
  }): Promise<HangTraCuu>;
}

/**
 * CHỐT CHẶN BIÊN DỊCH cho phép ép kiểu ở trên.
 *
 * Yêu cầu là mỗi bảng PHỦ ĐỦ những cột bộ tuyến dùng chung đụng tới — thiếu một
 * cột thì dòng tương ứng đỏ ngay. Cột RIÊNG thì không sao: `AssetOrigin` có
 * `vietTat` để sinh mã thiết bị, `AssetPurpose` không cần vì mục đích sử dụng
 * không nằm trong mã.
 *
 * (Bản đầu bắt hai bảng GIỐNG HỆT nhau, và nó đã đỏ đúng lúc `vietTat` được
 * thêm vào một bên — chặt hơn mức cần, nên nới lại đúng điều kiện thật.)
 */
type CoDuCot<_T extends HangTraCuu> = true;
const _nguonGocDuCot: CoDuCot<AssetOrigin> = true;
const _mucDichDuCot: CoDuCot<AssetPurpose> = true;
void _nguonGocDuCot;
void _mucDichDuCot;

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
  /**
   * Bảng này có cột `vietTat` (dùng sinh mã thiết bị) hay không.
   *
   * Nguồn gốc có, mục đích sử dụng không — nên hai tuyến dùng chung bộ mã này
   * nhưng chỉ một bên đọc/ghi cột đó. Truyền hàm thay vì cờ boolean để phần
   * Prisma vẫn đúng kiểu, không phải ép.
   */
  vietTat?: {
    daCo: (v: string) => Promise<boolean>;
    trungVoiMucKhac: (v: string, id: string) => Promise<boolean>;
  };
  /** Xoá trong CÙNG transaction với dòng nhật ký kiểm toán. */
  xoaTrongTx: (tx: Prisma.TransactionClient, id: string) => Promise<unknown>;
}): void {
  const { duong, ten, entityType, bang, xoaTrongTx } = cauHinh;
  const coVietTat = cauHinh.vietTat;

  danhMucRouter.get(
    duong,
    batAsync(async (_req, res) => {
      const muc = await bang.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
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
          ...(coVietTat
            ? { vietTat: await chotVietTat(duLieu.vietTat, duLieu.name, coVietTat.daCo) }
            : {}),
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
      if (coVietTat && duLieu.vietTat !== undefined) {
        if (await coVietTat.trungVoiMucKhac(duLieu.vietTat, id)) {
          throw loi409(`Viết tắt ${duLieu.vietTat} đã dùng cho mục khác.`, { truong: 'vietTat' });
        }
      }

      const sau = await bang.update({
        where: { id },
        data: {
          ...(coVietTat && duLieu.vietTat !== undefined ? { vietTat: duLieu.vietTat } : {}),
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
        include: { _count: { select: { assets: { where: { deletedAt: null } } } } },
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
  vietTat: {
    daCo: async (v) =>
      (await prisma.assetOrigin.findUnique({ where: { vietTat: v }, select: { id: true } })) !==
      null,
    trungVoiMucKhac: async (v, id) => {
      const t = await prisma.assetOrigin.findUnique({
        where: { vietTat: v },
        select: { id: true },
      });
      return t !== null && t.id !== id;
    },
  },
  xoaTrongTx: (tx, id) => tx.assetOrigin.delete({ where: { id } }),
});

dangKyBangTraCuu({
  duong: '/muc-dich',
  ten: 'mục đích sử dụng',
  entityType: 'asset_purpose',
  bang: prisma.assetPurpose as unknown as BangTraCuu,
  xoaTrongTx: (tx, id) => tx.assetPurpose.delete({ where: { id } }),
});
