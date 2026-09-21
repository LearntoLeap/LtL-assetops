/**
 * THƯ VIỆN WIKI THIẾT BỊ.
 *
 * Một bài mô tả một KIỂU thiết bị và nối tới đích qua `wiki_links`: một bài phủ
 * được cả một dòng giải pháp, cả một loại tài sản, một nhóm mã cụ thể, hoặc
 * không nối gì (bài chung áp dụng cho mọi thiết bị).
 *
 * ĐỌC: mọi vai trò, KHÔNG lọc theo phạm vi. Cố ý như vậy — wiki là tri thức
 * hướng dẫn, chặn thì mất ý nghĩa, và trong nhóm bảng này không có trường giá
 * nào, cũng không đọc `assets.value`, nên không có thông tin thương mại để lộ.
 * GHI: ADMIN / VAN_HANH / KHO — người kho cầm máy nhiều nhất nên họ phát hiện
 * ghi chú sai sớm nhất; lưới an toàn là lịch sử phiên bản chứ không phải khoá quyền.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { loi404, loi409 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { xoaFileTaiLieu } from '../../lib/luu-tai-lieu.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type { DuLieuSuaBai, DuLieuTaoBai } from './wiki.schema.js';

/**
 * Bỏ dấu tiếng Việt và hạ chữ thường.
 *
 * Dùng cho cả `slug` lẫn cột `tim_kiem`. Lý do có cột tìm kiếm không dấu: người
 * Việt gõ tìm kiếm thường bỏ dấu ("luu y ugot"), mà LIKE trên chuỗi có dấu thì
 * không khớp. Làm tại chỗ bằng normalize của chuẩn Unicode, không cần thư viện.
 * Riêng đ/Đ phải thay tay vì nó không phải "d + dấu" trong bảng mã.
 */
export function boDau(chuoi: string): string {
  return chuoi
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function taoSlug(tieuDe: string): string {
  const goc = boDau(tieuDe)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
  return goc || 'bai-viet';
}

/** Slug phải duy nhất; trùng thì thêm hậu tố -2, -3… */
async function slugDuyNhat(tieuDe: string, boQuaId?: string): Promise<string> {
  const goc = taoSlug(tieuDe);
  for (let i = 0; i < 50; i++) {
    const thu = i === 0 ? goc : `${goc}-${i + 1}`;
    const da = await prisma.wikiArticle.findUnique({ where: { slug: thu }, select: { id: true } });
    if (!da || da.id === boQuaId) return thu;
  }
  return `${goc}-${Date.now().toString(36)}`;
}

/** Gộp mọi chữ trong bài thành một chuỗi không dấu để tìm kiếm. */
function dungTimKiem(
  bai: {
    tieuDe: string;
    tomTat?: string | null | undefined;
    moTa?: string | null | undefined;
    huongDan?: string | null | undefined;
  },
  muc: ReadonlyArray<{ tieuDe: string; noiDung?: string | null | undefined }>,
): string {
  const phan = [bai.tieuDe, bai.tomTat, bai.moTa, bai.huongDan];
  for (const m of muc) phan.push(m.tieuDe, m.noiDung);
  return boDau(phan.filter(Boolean).join(' ')).replace(/\s+/g, ' ').trim().slice(0, 60_000);
}

const CHON_DANH_SACH = {
  id: true,
  slug: true,
  tieuDe: true,
  tomTat: true,
  status: true,
  updatedAt: true,
  coverPhotoId: true,
  updatedBy: { select: { fullName: true } },
  _count: { select: { docs: true, links: true, items: true } },
} satisfies Prisma.WikiArticleSelect;

const CHON_MUC = {
  id: true,
  loai: true,
  tieuDe: true,
  noiDung: true,
  soLuong: true,
  donVi: true,
  mucDo: true,
  assetId: true,
  thuTu: true,
  // Mã + tên thiết bị thôi. KHÔNG lấy `value` — wiki không chứa thông tin giá.
  asset: { select: { id: true, code: true, name: true, isActive: true } },
} satisfies Prisma.WikiItemSelect;

const CHON_TAI_LIEU = {
  id: true,
  loai: true,
  tieuDe: true,
  moTa: true,
  fileName: true,
  mimeType: true,
  byteSize: true,
  lienKetNgoai: true,
  thuTu: true,
  createdAt: true,
  uploadedBy: { select: { fullName: true } },
} satisfies Prisma.WikiDocSelect;

const CHON_DICH = {
  id: true,
  asset: { select: { id: true, code: true, name: true } },
  category: { select: { id: true, name: true } },
  productLine: { select: { id: true, name: true } },
} satisfies Prisma.WikiLinkSelect;

export async function danhSach(loc: {
  tuKhoa?: string | undefined;
  dongGiaiPhapId?: string | undefined;
  loaiTaiSanId?: string | undefined;
  status?: 'BAN_NHAP' | 'DA_DANG' | undefined;
  trang: number;
  moiTrang: number;
}) {
  const dieuKien: Prisma.WikiArticleWhereInput[] = [];
  if (loc.tuKhoa) {
    // So trên cột không dấu, và cũng so trên tiêu đề có dấu để người gõ đủ dấu
    // vẫn khớp chính xác.
    const khongDau = boDau(loc.tuKhoa);
    dieuKien.push({
      OR: [{ timKiem: { contains: khongDau } }, { tieuDe: { contains: loc.tuKhoa } }],
    });
  }
  if (loc.dongGiaiPhapId) {
    dieuKien.push({ links: { some: { productLineId: loc.dongGiaiPhapId } } });
  }
  if (loc.loaiTaiSanId) dieuKien.push({ links: { some: { categoryId: loc.loaiTaiSanId } } });
  if (loc.status) dieuKien.push({ status: loc.status });

  const where: Prisma.WikiArticleWhereInput = dieuKien.length > 0 ? { AND: dieuKien } : {};
  const [muc, tong] = await Promise.all([
    prisma.wikiArticle.findMany({
      where,
      select: CHON_DANH_SACH,
      orderBy: [{ status: 'asc' }, { tieuDe: 'asc' }],
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.wikiArticle.count({ where }),
  ]);
  return { muc, tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

/** Bài đầy đủ theo slug HOẶC id — link chia sẻ dùng slug, form sửa dùng id. */
export async function chiTiet(khoa: string) {
  const bai = await prisma.wikiArticle.findFirst({
    where: { OR: [{ slug: khoa }, { id: khoa }] },
    select: {
      id: true,
      slug: true,
      tieuDe: true,
      tomTat: true,
      moTa: true,
      huongDan: true,
      status: true,
      coverPhotoId: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { fullName: true } },
      updatedBy: { select: { fullName: true } },
      links: { select: CHON_DICH },
      items: { select: CHON_MUC, orderBy: [{ loai: 'asc' }, { thuTu: 'asc' }] },
      docs: { select: CHON_TAI_LIEU, orderBy: [{ thuTu: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { revisions: true } },
    },
  });
  if (!bai) throw loi404('Không tìm thấy bài viết trong thư viện.');

  // Bài này đang áp dụng cho bao nhiêu mã, bao nhiêu mã còn hoạt động.
  const dieuKienMa = dieuKienTaiSanTheoDich(bai.links);
  const soMa = dieuKienMa ? await prisma.asset.count({ where: dieuKienMa }) : 0;

  return { bai, soMa };
}

/** Ghép điều kiện "những mã mà bài này áp dụng cho". Null nếu bài không nối đâu. */
function dieuKienTaiSanTheoDich(
  links: ReadonlyArray<{
    asset: { id: string } | null;
    category: { id: string } | null;
    productLine: { id: string } | null;
  }>,
): Prisma.AssetWhereInput | null {
  const maId = links.flatMap((l) => (l.asset ? [l.asset.id] : []));
  const loaiId = links.flatMap((l) => (l.category ? [l.category.id] : []));
  const dongId = links.flatMap((l) => (l.productLine ? [l.productLine.id] : []));
  const ve: Prisma.AssetWhereInput[] = [];
  if (maId.length) ve.push({ id: { in: maId } });
  if (loaiId.length) ve.push({ categoryId: { in: loaiId } });
  if (dongId.length) ve.push({ productLineId: { in: dongId } });
  return ve.length > 0 ? { OR: ve } : null;
}

/**
 * Mọi bài áp dụng cho MỘT thiết bị, gom từ bốn nguồn và giữ nguyên nguồn gốc
 * để giao diện xếp nhóm: riêng máy này ▸ cả dòng ▸ cả loại ▸ áp dụng chung.
 */
export async function theoThietBi(assetId: string) {
  const ts = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, code: true, name: true, categoryId: true, productLineId: true },
  });
  if (!ts) throw loi404('Không tìm thấy thiết bị.');

  const [rieng, theoDong, theoLoai, chung] = await Promise.all([
    prisma.wikiArticle.findMany({
      where: { status: 'DA_DANG', links: { some: { assetId: ts.id } } },
      select: CHON_DANH_SACH,
    }),
    ts.productLineId
      ? prisma.wikiArticle.findMany({
          where: { status: 'DA_DANG', links: { some: { productLineId: ts.productLineId } } },
          select: CHON_DANH_SACH,
        })
      : Promise.resolve([]),
    prisma.wikiArticle.findMany({
      where: { status: 'DA_DANG', links: { some: { categoryId: ts.categoryId } } },
      select: CHON_DANH_SACH,
    }),
    prisma.wikiArticle.findMany({
      where: { status: 'DA_DANG', links: { none: {} } },
      select: CHON_DANH_SACH,
    }),
  ]);

  // Một bài nối cả mã lẫn dòng thì chỉ hiện ở nhóm hẹp nhất, không lặp lại.
  const daCo = new Set<string>();
  const locTrung = <T extends { id: string }>(ds: T[]): T[] =>
    ds.filter((b) => (daCo.has(b.id) ? false : (daCo.add(b.id), true)));

  const nhom = {
    rieng: locTrung(rieng),
    theoDong: locTrung(theoDong),
    theoLoai: locTrung(theoLoai),
    chung: locTrung(chung),
  };

  // Lưu ý NGUY_HIEM của mọi bài liên quan — giao diện đẩy lên đầu trang thiết bị.
  const idBai = [...daCo];
  const canhBao = idBai.length
    ? await prisma.wikiItem.findMany({
        where: { articleId: { in: idBai }, loai: 'LUU_Y', mucDo: { in: ['NGUY_HIEM', 'CAN_THAN'] } },
        select: {
          id: true,
          tieuDe: true,
          mucDo: true,
          article: { select: { slug: true, tieuDe: true } },
        },
        orderBy: [{ mucDo: 'desc' }, { thuTu: 'asc' }],
        take: 10,
      })
    : [];

  return { thietBi: ts, ...nhom, canhBao };
}

async function ghiMucVaDich(
  tx: Prisma.TransactionClient,
  articleId: string,
  duLieu: DuLieuTaoBai,
): Promise<void> {
  await tx.wikiItem.deleteMany({ where: { articleId } });
  await tx.wikiLink.deleteMany({ where: { articleId } });

  if (duLieu.muc.length > 0) {
    await tx.wikiItem.createMany({
      data: duLieu.muc.map((m, i) => ({
        articleId,
        loai: m.loai,
        tieuDe: m.tieuDe,
        noiDung: m.noiDung ?? null,
        soLuong: m.loai === 'THANH_PHAN' ? (m.soLuong ?? null) : null,
        donVi: m.loai === 'THANH_PHAN' ? (m.donVi ?? null) : null,
        mucDo: m.loai === 'LUU_Y' ? (m.mucDo ?? null) : null,
        assetId: m.loai === 'THANH_PHAN' ? (m.assetId ?? null) : null,
        thuTu: i,
      })),
    });
  }

  // Bỏ trùng trước khi ghi: khoá duy nhất trong CSDL chỉ chặn được trùng trên
  // cùng một loại đích, còn người dùng bấm thêm hai lần cùng một dòng thì phải
  // lọc ở đây.
  const daCo = new Set<string>();
  const dich = duLieu.dich.filter((d) => {
    const khoa = `${d.loai}:${d.id}`;
    if (daCo.has(khoa)) return false;
    daCo.add(khoa);
    return true;
  });
  if (dich.length > 0) {
    await tx.wikiLink.createMany({
      data: dich.map((d) => ({
        articleId,
        assetId: d.loai === 'THIET_BI' ? d.id : null,
        categoryId: d.loai === 'LOAI_TAI_SAN' ? d.id : null,
        productLineId: d.loai === 'DONG_GIAI_PHAP' ? d.id : null,
      })),
    });
  }
}

export async function tao(duLieu: DuLieuTaoBai, actor: NguoiThaoTac, ctx: BoiCanhGoi) {
  const slug = await slugDuyNhat(duLieu.tieuDe);
  const id = await prisma.$transaction(async (tx) => {
    const bai = await tx.wikiArticle.create({
      data: {
        slug,
        tieuDe: duLieu.tieuDe,
        tomTat: duLieu.tomTat ?? null,
        moTa: duLieu.moTa ?? null,
        huongDan: duLieu.huongDan ?? null,
        coverPhotoId: duLieu.coverPhotoId ?? null,
        status: duLieu.status,
        timKiem: dungTimKiem(duLieu, duLieu.muc),
        createdById: actor.id,
        updatedById: actor.id,
      },
      select: { id: true },
    });
    await ghiMucVaDich(tx, bai.id, duLieu);
    await ghiAudit(
      {
        actor,
        action: 'wiki.create',
        entityType: 'wiki_article',
        entityId: bai.id,
        afterValue: { slug, tieuDe: duLieu.tieuDe, status: duLieu.status },
        ...ctx,
      },
      tx,
    );
    return bai.id;
  });
  return chiTiet(id);
}

export async function sua(
  id: string,
  duLieu: DuLieuSuaBai,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
) {
  const truoc = await prisma.wikiArticle.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      tieuDe: true,
      tomTat: true,
      moTa: true,
      huongDan: true,
      status: true,
      items: { select: CHON_MUC },
      links: { select: CHON_DICH },
      _count: { select: { revisions: true } },
    },
  });
  if (!truoc) throw loi404('Không tìm thấy bài viết trong thư viện.');

  // Đổi tiêu đề thì đổi slug theo, nhưng chỉ khi tiêu đề thật sự đổi — giữ
  // nguyên link cũ nếu chỉ sửa nội dung.
  const slug =
    truoc.tieuDe === duLieu.tieuDe ? truoc.slug : await slugDuyNhat(duLieu.tieuDe, id);

  await prisma.$transaction(async (tx) => {
    // Chụp lại bản CŨ trước khi ghi đè. Sửa nhầm "không cắm nguồn 12V" thành
    // "24V" là cháy máy — phải quay lại được.
    await tx.wikiRevision.create({
      data: {
        articleId: id,
        phienBan: truoc._count.revisions + 1,
        anhChup: JSON.parse(JSON.stringify(truoc)) as Prisma.InputJsonValue,
        lyDo: duLieu.lyDo ?? null,
        suaBoiId: actor.id,
      },
    });
    await tx.wikiArticle.update({
      where: { id },
      data: {
        slug,
        tieuDe: duLieu.tieuDe,
        tomTat: duLieu.tomTat ?? null,
        moTa: duLieu.moTa ?? null,
        huongDan: duLieu.huongDan ?? null,
        coverPhotoId: duLieu.coverPhotoId ?? null,
        status: duLieu.status,
        timKiem: dungTimKiem(duLieu, duLieu.muc),
        updatedById: actor.id,
      },
    });
    await ghiMucVaDich(tx, id, duLieu);
    await ghiAudit(
      {
        actor,
        action: 'wiki.update',
        entityType: 'wiki_article',
        entityId: id,
        beforeValue: { tieuDe: truoc.tieuDe, status: truoc.status, soMuc: truoc.items.length },
        afterValue: { tieuDe: duLieu.tieuDe, status: duLieu.status, soMuc: duLieu.muc.length },
        note: duLieu.lyDo ?? null,
        ...ctx,
      },
      tx,
    );
  });
  return chiTiet(id);
}

export async function xoa(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const bai = await prisma.wikiArticle.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      tieuDe: true,
      docs: { select: { filePath: true } },
    },
  });
  if (!bai) throw loi404('Không tìm thấy bài viết trong thư viện.');

  // Mục, đích, tài liệu và lịch sử đều cascade theo bài. Lấy đường dẫn file
  // TRƯỚC khi xoá, vì sau đó không còn chỗ nào tìm lại file trên đĩa.
  const fileCanDon = bai.docs.flatMap((d) => (d.filePath ? [d.filePath] : []));

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'wiki.delete',
        entityType: 'wiki_article',
        entityId: id,
        beforeValue: { slug: bai.slug, tieuDe: bai.tieuDe, soTaiLieu: bai.docs.length },
        ...ctx,
      },
      tx,
    );
    await tx.wikiArticle.delete({ where: { id } });
  });

  for (const f of fileCanDon) await xoaFileTaiLieu(f);
}

export async function lichSu(id: string) {
  const bai = await prisma.wikiArticle.findUnique({ where: { id }, select: { id: true } });
  if (!bai) throw loi404('Không tìm thấy bài viết trong thư viện.');
  return prisma.wikiRevision.findMany({
    where: { articleId: id },
    select: {
      id: true,
      phienBan: true,
      lyDo: true,
      createdAt: true,
      anhChup: true,
      suaBoi: { select: { fullName: true } },
    },
    orderBy: { phienBan: 'desc' },
    take: 50,
  });
}

export async function themTaiLieu(
  articleId: string,
  duLieu: {
    loai: NonNullable<Prisma.WikiDocCreateInput['loai']>;
    tieuDe: string;
    moTa?: string | undefined;
    lienKetNgoai?: string | undefined;
  },
  tep:
    | { filePath: string; fileName: string; mimeType: string; byteSize: number; checksum: string }
    | null,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
) {
  const bai = await prisma.wikiArticle.findUnique({
    where: { id: articleId },
    select: { id: true, _count: { select: { docs: true } } },
  });
  if (!bai) throw loi404('Không tìm thấy bài viết trong thư viện.');
  if (!tep && !duLieu.lienKetNgoai) {
    throw loi409('Phải tải lên một file hoặc dán một liên kết ngoài.');
  }

  const doc = await prisma.wikiDoc.create({
    data: {
      articleId,
      loai: duLieu.loai,
      tieuDe: duLieu.tieuDe,
      moTa: duLieu.moTa ?? null,
      lienKetNgoai: tep ? null : (duLieu.lienKetNgoai ?? null),
      filePath: tep?.filePath ?? null,
      fileName: tep?.fileName ?? null,
      mimeType: tep?.mimeType ?? null,
      byteSize: tep?.byteSize ?? null,
      checksum: tep?.checksum ?? null,
      uploadedById: actor.id,
      thuTu: bai._count.docs,
    },
    select: CHON_TAI_LIEU,
  });

  await ghiAudit({
    actor,
    action: 'wiki.doc.add',
    entityType: 'wiki_doc',
    entityId: doc.id,
    afterValue: { articleId, tieuDe: duLieu.tieuDe, coFile: Boolean(tep) },
    ...ctx,
  });
  return doc;
}

export async function xoaTaiLieu(docId: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const doc = await prisma.wikiDoc.findUnique({
    where: { id: docId },
    select: { id: true, articleId: true, tieuDe: true, filePath: true },
  });
  if (!doc) throw loi404('Không tìm thấy tài liệu.');

  await prisma.wikiDoc.delete({ where: { id: docId } });
  await ghiAudit({
    actor,
    action: 'wiki.doc.delete',
    entityType: 'wiki_doc',
    entityId: docId,
    beforeValue: { articleId: doc.articleId, tieuDe: doc.tieuDe },
    ...ctx,
  });
  if (doc.filePath) await xoaFileTaiLieu(doc.filePath);
}
