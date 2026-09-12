/**
 * Cấp số chứng từ tự sinh: YC-2026-0001, BBBG-2026-0001, KK-2026-0001…
 *
 * Bộ đếm nằm ở bảng `document_sequences`, tăng bên trong transaction nên hai
 * người bấm cùng lúc không bao giờ nhận cùng một số.
 */
import { prisma, type PrismaTx } from '../prisma.js';

export const TIEN_TO = {
  YEU_CAU: 'YC',
  BBBG: 'BBBG',
  KIEM_KE: 'KK',
} as const;

export type TienTo = (typeof TIEN_TO)[keyof typeof TIEN_TO];

/**
 * Cấp số tiếp theo cho (tiền tố, năm). PHẢI gọi trong transaction cùng với
 * lệnh tạo chứng từ, để số đã cấp không bị bỏ trống khi ghi thất bại.
 */
export async function capSoChungTu(
  db: PrismaTx,
  tienTo: TienTo,
  nam: number = new Date().getFullYear(),
): Promise<string> {
  const banGhi = await db.documentSequence.upsert({
    where: { prefix_year: { prefix: tienTo, year: nam } },
    create: { prefix: tienTo, year: nam, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return dinhDangSo(tienTo, nam, banGhi.lastNumber);
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
