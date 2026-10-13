/**
 * Cấp số chứng từ tự sinh: YC-2026-0001, BBBG-2026-0001, KK-2026-0001…
 *
 * Bộ đếm nằm ở bảng `document_sequences`, tăng bên trong transaction nên hai
 * người bấm cùng lúc không bao giờ nhận cùng một số.
 */
import { Prisma } from '@prisma/client';
import { prisma, type PrismaTx } from '../prisma.js';

export const TIEN_TO = {
  YEU_CAU: 'YC',
  BBBG: 'BBBG',
  KIEM_KE: 'KK',
  LINH_KIEN: 'LK',
  ONSITE: 'OS',
} as const;

export type TienTo = (typeof TIEN_TO)[keyof typeof TIEN_TO];

/**
 * Cấp số tiếp theo cho (tiền tố, năm). PHẢI gọi trong transaction cùng với
 * lệnh tạo chứng từ, để số đã cấp không bị bỏ trống khi ghi thất bại.
 */
/** Năm theo GIỜ VIỆT NAM — máy chủ chạy giờ UTC thì 0–7 giờ sáng 1/1 vẫn là năm cũ. */
export function namViet(luc: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(luc),
  );
}

/**
 * TĂNG BỘ ĐẾM và trả về số mới — an toàn khi nhiều người ghi cùng lúc.
 *
 * Hai lỗi đã dựng lại thật khi 20 thiết bị lưu cùng lúc trên một tiền tố MỚI:
 *   - `upsert` / `update` của Prisma trên MySQL ĐỌC trước theo bản chụp của
 *     transaction rồi mới GHI: lượt sau không thấy dòng bộ đếm lượt trước vừa
 *     tạo → "không tìm thấy bản ghi".
 *   - Khởi tạo bộ đếm BÊN TRONG transaction (SELECT … FOR UPDATE rồi INSERT) thì
 *     các lượt giữ khoá khoảng trống của nhau → khoá chéo (deadlock).
 *
 * Cách làm: dòng bộ đếm được TẠO NGOÀI transaction (một lệnh INSERT bỏ qua nếu
 * trùng, tự commit ngay — không giữ khoá nào lâu). Bên trong transaction chỉ còn
 * đúng một khoá dòng: UPDATE +1, giữ tới khi commit. Mọi lượt khoá cùng một dòng
 * theo cùng thứ tự nên xếp hàng, không khoá chéo, không ai nhận trùng số. SQL
 * viết theo chuẩn chung (không backtick) để đổi sang PostgreSQL không phải sửa.
 */
export async function tangBoDem(
  db: PrismaTx,
  prefix: string,
  year: number,
  giaTriKhoiTao: () => Promise<number> = async () => 0,
): Promise<number> {
  // Đọc thường (không khoá). Transaction đã tự tăng dòng này thì luôn thấy nó,
  // nên không bao giờ chạy nhánh tạo khi chính mình đang giữ khoá dòng.
  const coSan = await db.documentSequence.findUnique({
    where: { prefix_year: { prefix, year } },
    select: { id: true },
  });
  if (!coSan) {
    await prisma.documentSequence.createMany({
      data: [{ prefix, year, lastNumber: await giaTriKhoiTao() }],
      skipDuplicates: true,
    });
  }
  const soDong = await db.$executeRaw(
    Prisma.sql`UPDATE document_sequences SET last_number = last_number + 1 WHERE prefix = ${prefix} AND year = ${year}`,
  );
  if (soDong !== 1) throw new Error(`Không tăng được bộ đếm ${prefix}/${year}.`);
  // Đọc lại chính dòng mình vừa sửa: transaction luôn thấy thay đổi của mình.
  const sau = await db.$queryRaw<Array<{ last_number: unknown }>>(
    Prisma.sql`SELECT last_number FROM document_sequences WHERE prefix = ${prefix} AND year = ${year}`,
  );
  return Number(sau[0]?.last_number ?? 0);
}

export async function capSoChungTu(
  db: PrismaTx,
  tienTo: TienTo,
  nam: number = namViet(),
): Promise<string> {
  return dinhDangSo(tienTo, nam, await tangBoDem(db, tienTo, nam));
}

/** Ghép chuỗi số chứng từ: BBBG-2026-0001. */
export function dinhDangSo(tienTo: TienTo, nam: number, so: number): string {
  return `${tienTo}-${nam}-${String(so).padStart(4, '0')}`;
}

/** Cấp số ngoài transaction sẵn có — tiện cho script/seed. */
export async function capSoChungTuDocLap(
  tienTo: TienTo,
  nam?: number,
): Promise<string> {
  return prisma.$transaction((tx) => capSoChungTu(tx, tienTo, nam));
}
