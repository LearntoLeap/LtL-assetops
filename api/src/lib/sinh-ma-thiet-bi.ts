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
 */
import { prisma, type PrismaTx } from '../prisma.js';

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
 * Mã kế tiếp cho một tổ hợp.
 *
 * Quét theo TIỀN TỐ chứ không giữ một bảng bộ đếm riêng: bảng đếm sẽ lệch khỏi
 * thực tế ngay lần đầu có ai xoá vĩnh viễn một thiết bị hay nhập mã bằng tay.
 * Quét mã lớn nhất thì luôn khớp với những gì đang thực sự nằm trong CSDL.
 *
 * CỐ Ý KHÔNG lọc `deletedAt: null`: thiết bị trong thùng rác vẫn giữ mã trong
 * khoá duy nhất, cấp lại đúng mã đó là đâm thẳng vào lỗi trùng khoá.
 */
export async function maKeTiep(tienTo: string, db: PrismaTx = prisma): Promise<string> {
  const cuoi = await db.asset.findFirst({
    where: { code: { startsWith: tienTo } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let so = 1;
  if (cuoi) {
    const duoi = cuoi.code.slice(tienTo.length);
    // Chỉ nhận đuôi TOÀN SỐ. Có người gõ tay "MUA-RB-0001-cu" thì bỏ qua, đừng
    // để một mã lạ làm hỏng cả dãy đếm.
    const n = /^\d+$/.test(duoi) ? Number(duoi) : Number.NaN;
    so = Number.isFinite(n) ? n + 1 : 1;
  }
  return `${tienTo}${String(so).padStart(SO_CHU_SO, '0')}`;
}

/** Mã kế tiếp, tra viết tắt từ id của ba danh mục. */
export async function maKeTiepTheoId(
  originId: string,
  categoryId: string,
  productLineId: string | null,
  db: PrismaTx = prisma,
): Promise<{ ma: string; tienTo: string } | null> {
  const [ng, loai, dong] = await Promise.all([
    db.assetOrigin.findUnique({ where: { id: originId }, select: { vietTat: true } }),
    db.assetCategory.findUnique({ where: { id: categoryId }, select: { vietTat: true } }),
    productLineId
      ? db.productLine.findUnique({ where: { id: productLineId }, select: { vietTat: true } })
      : Promise.resolve(null),
  ]);
  if (!ng || !loai) return null;
  if (productLineId && !dong) return null;

  const tienTo = tienToMa(ng.vietTat, loai.vietTat, dong?.vietTat ?? null);
  return { ma: await maKeTiep(tienTo, db), tienTo };
}
