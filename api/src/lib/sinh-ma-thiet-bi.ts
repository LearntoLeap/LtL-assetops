/**
 * SINH MÃ THIẾT BỊ tự động.
 *
 * Dạng mã:  {nguồn gốc}-{loại tài sản}[-{dòng giải pháp}]-{số thứ tự 4 chữ số}
 * Ví dụ:    MUA-RB-UKIT-0001   (robot uKit do LtL mua)
 *           IPP-AP-0001        (ấn phẩm nhập từ IPP, không thuộc dòng nào)
 *
 * Số thứ tự đếm RIÊNG cho từng tiền tố đầy đủ — đổi bất kỳ đoạn nào là một dãy
 * số mới bắt đầu từ 0001. Nhờ vậy nhìn mã là biết ngay "cái thứ mấy trong đúng
 * nhóm này", thay vì một dãy chung mà số nhảy lung tung.
 *
 * Thiết bị KHÔNG thuộc dòng giải pháp nào thì BỎ HẲN đoạn dòng, không chèn ký
 * tự thay thế: mã ngắn hơn và không có đoạn thừa vô nghĩa.
 *
 * Số thứ tự cấp từ BỘ ĐẾM khoá dòng (`capMaThietBi`): không trùng, không lùi,
 * không cấp lại mã đã xoá.
 */
import { prisma, type PrismaTx } from '../prisma.js';
import { damBaoBoDem, tangBoDem } from './so-chung-tu.js';

/** Bốn chữ số, đủ 9999 thiết bị cho mỗi tổ hợp. */
const SO_CHU_SO = 4;

/**
 * Chuẩn hoá một chuỗi thành phần viết tắt hợp lệ: bỏ dấu, chữ in hoa, chỉ giữ
 * chữ cái và số. Gạch ngang bị loại vì nó là dấu ngăn giữa các đoạn của mã.
 */
export function chuanHoaVietTat(chu: string): string {
  return chu
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

/**
 * Gợi ý viết tắt từ tên, cho lúc người dùng thêm mục mới mà không tự đặt.
 *
 * Nhiều chữ thì lấy chữ cái đầu mỗi chữ ("Phụ huynh tặng" → PHT); một chữ thì
 * lấy ba ký tự đầu ("Robot" → ROB). Chỉ là GỢI Ý — người dùng sửa lại được ở
 * trang Danh mục, và cách gọi phải tự xử khi gợi ý này trùng với mục đã có.
 */
export function goiYVietTat(ten: string): string {
  const chu = ten
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  if (chu.length === 0) return '';
  if (chu.length === 1) return (chu[0] ?? '').slice(0, 3);
  return chu
    .map((c) => c[0] ?? '')
    .join('')
    .slice(0, 6);
}

/** Viết tắt đã trùng thì thêm 2, 3… cho tới khi trống chỗ. */
export async function vietTatChuaDung(
  goc: string,
  daCo: (v: string) => Promise<boolean>,
): Promise<string> {
  const nen = chuanHoaVietTat(goc) || 'M';
  if (!(await daCo(nen))) return nen;
  for (let i = 2; i <= 99; i++) {
    const thu = `${nen.slice(0, 10 - String(i).length)}${i}`;
    if (!(await daCo(thu))) return thu;
  }
  // 99 mục cùng một viết tắt thì đúng là nên đặt tên khác.
  throw new Error('Không sinh được viết tắt chưa trùng.');
}

/** Tiền tố (phần trước số thứ tự), đã kèm dấu gạch cuối. */
export function tienToMa(
  vietTatNguonGoc: string,
  vietTatLoai: string,
  vietTatDong: string | null,
): string {
  const doan = [vietTatNguonGoc, vietTatLoai, ...(vietTatDong ? [vietTatDong] : [])];
  return `${doan.join('-')}-`;
}

/**
 * Số lớn nhất ĐÃ DÙNG trong dãy của một tiền tố — so theo GIÁ TRỊ SỐ, chỉ nhận
 * mã có dạng đúng `{tiền tố}{toàn chữ số}`.
 *
 * Trước đây lấy mã lớn nhất theo THỨ TỰ CHỮ (`ORDER BY code DESC`), sai ở ba chỗ:
 *   - Tiền tố "IPP-RB-" cũng khớp mã CÓ dòng giải pháp "IPP-RB-UKIT-0001", mà
 *     chữ xếp sau số, nên mã đó luôn đứng đầu; đuôi "UKIT-0001" không phải số
 *     nên dãy quay về 0001 — đã có IPP-RB-0001 thì lưu là báo trùng, mãi mãi.
 *   - "…-5" gõ tay xếp trên "…-0043" → tính ra 0006 → trùng.
 *   - Qua 9999, "…-10000" xếp dưới "…-9999" → kẹt ở 10000.
 *
 * KHÔNG lọc `deletedAt`: thiết bị trong thùng rác vẫn giữ mã trong khoá duy nhất.
 */
async function soLonNhatDaDung(tienTo: string, db: PrismaTx): Promise<number> {
  const ma = await db.asset.findMany({
    where: { code: { startsWith: tienTo } },
    select: { code: true },
  });
  let lon = 0;
  for (const { code } of ma) {
    const duoi = code.slice(tienTo.length);
    if (/^\d+$/.test(duoi)) lon = Math.max(lon, Number(duoi));
  }
  return lon;
}

/** Bộ đếm mã thiết bị dùng chung bảng `document_sequences`, năm = 0 (không theo năm). */
const NAM_MA_THIET_BI = 0;

function dinhDangMa(tienTo: string, so: number): string {
  return `${tienTo}${String(so).padStart(SO_CHU_SO, '0')}`;
}

/**
 * MÃ DỰ KIẾN để hiện trước trên form — KHÔNG giữ chỗ.
 *
 * Bằng đúng mã sẽ được cấp nếu không ai lưu chen vào trước; mã chính thức do
 * `capMaThietBi` cấp lúc lưu.
 */
export async function maKeTiep(tienTo: string, db: PrismaTx = prisma): Promise<string> {
  const [boDem, daDung] = await Promise.all([
    db.documentSequence.findUnique({
      where: { prefix_year: { prefix: tienTo, year: NAM_MA_THIET_BI } },
      select: { lastNumber: true },
    }),
    soLonNhatDaDung(tienTo, db),
  ]);
  let so = Math.max(boDem?.lastNumber ?? 0, daDung) + 1;
  // Bỏ qua mã đã có người gõ tay chen vào trước.
  for (let i = 0; i < 1000; i++) {
    const daCo = await db.asset.findUnique({
      where: { code: dinhDangMa(tienTo, so) },
      select: { id: true },
    });
    if (!daCo) break;
    so++;
  }
  return dinhDangMa(tienTo, so);
}

/**
 * CẤP MÃ CHÍNH THỨC — gọi TRONG transaction tạo thiết bị.
 *
 * Bộ đếm theo tiền tố, khoá dòng lúc tăng (UPDATE … +1 giữ khoá tới khi commit)
 * nên hai người lưu cùng lúc xếp hàng, không bao giờ cùng nhận một số. Bộ đếm
 * KHÔNG BAO GIỜ giảm: xoá hẳn một thiết bị không làm mã của nó bị cấp lại cho
 * thiết bị khác — tem nhãn, nhật ký, file Excel cũ ghi mã đó vẫn chỉ đúng một
 * thiết bị. Số chỉ tăng.
 *
 * Lần đầu gặp một tiền tố, bộ đếm được khởi tạo bằng số lớn nhất đang dùng,
 * nên dãy nối tiếp đúng những gì đã có trong CSDL.
 */
/**
 * Tạo sẵn bộ đếm của một tiền tố mã — gọi NGOÀI transaction, trước `capMaThietBi`
 * (xem `damBaoBoDem`). Lần đầu khởi tạo bằng số lớn nhất đang dùng của tiền tố.
 */
export async function chuanBiBoDemMa(tienTo: string): Promise<void> {
  await damBaoBoDem(tienTo, NAM_MA_THIET_BI, () => soLonNhatDaDung(tienTo, prisma));
}

export async function capMaThietBi(tx: PrismaTx, tienTo: string): Promise<string> {
  for (let i = 0; i < 1000; i++) {
    const so = await tangBoDem(tx, tienTo, NAM_MA_THIET_BI, () => soLonNhatDaDung(tienTo, tx));
    const ma = dinhDangMa(tienTo, so);
    // Bước qua mã đã có (gõ tay, nhập Excel) — khoá duy nhất vẫn là chốt cuối.
    if (!(await tx.asset.findUnique({ where: { code: ma }, select: { id: true } }))) return ma;
  }
  throw new Error(`Không cấp được mã mới cho tiền tố ${tienTo}.`);
}

/**
 * Mã gõ tay nằm trong dãy tự sinh (vd IPP-RB-0100) thì đẩy bộ đếm lên tới đó, để
 * dãy tự sinh không bao giờ đuổi kịp rồi đâm vào nó.
 */
export async function dayBoDemQuaMa(tx: PrismaTx, tienTo: string, ma: string): Promise<void> {
  const duoi = ma.slice(tienTo.length);
  if (!ma.startsWith(tienTo) || !/^\d+$/.test(duoi)) return;
  const n = Number(duoi);
  await tx.documentSequence.createMany({
    data: [{ prefix: tienTo, year: NAM_MA_THIET_BI, lastNumber: n }],
    skipDuplicates: true,
  });
  await tx.documentSequence.updateMany({
    where: { prefix: tienTo, year: NAM_MA_THIET_BI, lastNumber: { lt: n } },
    data: { lastNumber: n },
  });
}

/** Tiền tố mã của một tổ hợp, tra viết tắt từ id của ba danh mục. */
export async function tienToTheoId(
  originId: string,
  categoryId: string,
  productLineId: string | null,
  db: PrismaTx = prisma,
): Promise<string | null> {
  const [ng, loai, dong] = await Promise.all([
    db.assetOrigin.findUnique({ where: { id: originId }, select: { vietTat: true } }),
    db.assetCategory.findUnique({ where: { id: categoryId }, select: { vietTat: true } }),
    productLineId
      ? db.productLine.findUnique({ where: { id: productLineId }, select: { vietTat: true } })
      : Promise.resolve(null),
  ]);
  if (!ng || !loai) return null;
  if (productLineId && !dong) return null;
  return tienToMa(ng.vietTat, loai.vietTat, dong?.vietTat ?? null);
}

/** Mã DỰ KIẾN kế tiếp, tra viết tắt từ id của ba danh mục. */
export async function maKeTiepTheoId(
  originId: string,
  categoryId: string,
  productLineId: string | null,
  db: PrismaTx = prisma,
): Promise<{ ma: string; tienTo: string } | null> {
  const tienTo = await tienToTheoId(originId, categoryId, productLineId, db);
  if (!tienTo) return null;
  return { ma: await maKeTiep(tienTo, db), tienTo };
}
