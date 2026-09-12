/**
 * TỒN KHO — nguyên tắc bất biến #5.
 *
 * Không có cột "số tồn" nào trong CSDL. Tồn của một tài sản tại một địa điểm
 * LUÔN được suy ra từ bảng `movements`:
 *
 *     tồn(tài sản, địa điểm) = Σ quantity(movement đến địa điểm)
 *                            − Σ quantity(movement rời địa điểm)
 *
 * `from_location_id = NULL` nghĩa là hàng vào từ ngoài hệ thống (nhập ban đầu,
 * mua mới); `to_location_id = NULL` nghĩa là hàng ra khỏi hệ thống (thanh lý,
 * xác nhận mất). Nhờ vậy tổng tồn toàn hệ thống cũng tự khớp.
 *
 * SQL bên dưới cố ý viết theo chuẩn chung (không backtick, không hàm riêng của
 * MySQL) để đổi sang PostgreSQL không phải sửa gì.
 */
import { Prisma } from '@prisma/client';
import { prisma, type PrismaTx } from '../prisma.js';

export interface TonTheoDiaDiem {
  assetId: string;
  locationId: string;
  ton: number;
}

export interface TonMotTaiSan {
  assetId: string;
  /** Tổng còn nằm trong hệ thống (mọi địa điểm). */
  tongTon: number;
  theoDiaDiem: ReadonlyArray<{ locationId: string; ton: number }>;
}

/** SUM() trả về Decimal/BigInt/string tuỳ CSDL — quy về number an toàn. */
function veSo(giaTri: unknown): number {
  if (typeof giaTri === 'number') return giaTri;
  if (typeof giaTri === 'bigint') return Number(giaTri);
  if (giaTri instanceof Prisma.Decimal) return giaTri.toNumber();
  if (typeof giaTri === 'string') {
    const n = Number(giaTri);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

interface DongTho {
  asset_id: string;
  location_id: string;
  ton: unknown;
}

function doiDong(dong: DongTho): TonTheoDiaDiem {
  return { assetId: dong.asset_id, locationId: dong.location_id, ton: veSo(dong.ton) };
}

/**
 * Tồn của TOÀN BỘ tài sản, nhóm theo (tài sản, địa điểm).
 * Chỉ trả về các cặp có tồn khác 0.
 */
export async function tonTatCa(db: PrismaTx = prisma): Promise<TonTheoDiaDiem[]> {
  const dong = await db.$queryRaw<DongTho[]>(Prisma.sql`
    SELECT buoc.asset_id AS asset_id,
           buoc.location_id AS location_id,
           SUM(buoc.delta) AS ton
      FROM (
            SELECT asset_id, to_location_id AS location_id, quantity AS delta
              FROM movements
             WHERE to_location_id IS NOT NULL
            UNION ALL
            SELECT asset_id, from_location_id AS location_id, -quantity AS delta
              FROM movements
             WHERE from_location_id IS NOT NULL
           ) AS buoc
     GROUP BY buoc.asset_id, buoc.location_id
    HAVING SUM(buoc.delta) <> 0
  `);
  return dong.map(doiDong);
}

/** Tồn theo từng địa điểm của MỘT tài sản, kèm tổng. */
export async function tonCuaTaiSan(
  assetId: string,
  db: PrismaTx = prisma,
): Promise<TonMotTaiSan> {
  const dong = await db.$queryRaw<DongTho[]>(Prisma.sql`
    SELECT buoc.asset_id AS asset_id,
           buoc.location_id AS location_id,
           SUM(buoc.delta) AS ton
      FROM (
            SELECT asset_id, to_location_id AS location_id, quantity AS delta
              FROM movements
             WHERE to_location_id IS NOT NULL AND asset_id = ${assetId}
            UNION ALL
            SELECT asset_id, from_location_id AS location_id, -quantity AS delta
              FROM movements
             WHERE from_location_id IS NOT NULL AND asset_id = ${assetId}
           ) AS buoc
     GROUP BY buoc.asset_id, buoc.location_id
    HAVING SUM(buoc.delta) <> 0
  `);
  const theoDiaDiem = dong.map(doiDong).map((d) => ({ locationId: d.locationId, ton: d.ton }));
  return {
    assetId,
    tongTon: theoDiaDiem.reduce((tong, d) => tong + d.ton, 0),
    theoDiaDiem,
  };
}

/** Tồn của một tài sản tại đúng một địa điểm (0 nếu không còn gì). */
export async function tonTaiDiaDiem(
  assetId: string,
  locationId: string,
  db: PrismaTx = prisma,
): Promise<number> {
  const dong = await db.$queryRaw<Array<{ ton: unknown }>>(Prisma.sql`
    SELECT COALESCE(SUM(buoc.delta), 0) AS ton
      FROM (
            SELECT quantity AS delta
              FROM movements
             WHERE asset_id = ${assetId} AND to_location_id = ${locationId}
            UNION ALL
            SELECT -quantity AS delta
              FROM movements
             WHERE asset_id = ${assetId} AND from_location_id = ${locationId}
           ) AS buoc
  `);
  return veSo(dong[0]?.ton);
}

/** Tồn của mọi tài sản tại một địa điểm — dùng cho phiếu kiểm kê & màn hình kho. */
export async function tonTheoDiaDiem(
  locationId: string,
  db: PrismaTx = prisma,
): Promise<Array<{ assetId: string; ton: number }>> {
  const dong = await db.$queryRaw<Array<{ asset_id: string; ton: unknown }>>(Prisma.sql`
    SELECT buoc.asset_id AS asset_id, SUM(buoc.delta) AS ton
      FROM (
            SELECT asset_id, quantity AS delta
              FROM movements
             WHERE to_location_id = ${locationId}
            UNION ALL
            SELECT asset_id, -quantity AS delta
              FROM movements
             WHERE from_location_id = ${locationId}
           ) AS buoc
     GROUP BY buoc.asset_id
    HAVING SUM(buoc.delta) <> 0
  `);
  return dong.map((d) => ({ assetId: d.asset_id, ton: veSo(d.ton) }));
}
