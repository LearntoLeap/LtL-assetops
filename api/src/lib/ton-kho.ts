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
 *
 * MỌI truy vấn ở đây đều nối sang `assets` và bỏ thiết bị ĐÃ XOÁ MỀM. Thiếu phép
 * nối đó thì movements của thiết bị đã xoá vẫn cộng vào tồn — xoá xong mà kho vẫn
 * báo còn hàng, và con số đó không có cách nào đối chiếu vì thiết bị đã biến khỏi
 * mọi danh sách. Đây là chỗ DUY NHẤT tính tồn nên lọc ở đây là đủ cho toàn hệ thống.
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
      JOIN assets ts ON ts.id = buoc.asset_id AND ts.deleted_at IS NULL
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
      JOIN assets ts ON ts.id = buoc.asset_id AND ts.deleted_at IS NULL
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
      JOIN assets ts ON ts.id = ${assetId} AND ts.deleted_at IS NULL
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
      JOIN assets ts ON ts.id = buoc.asset_id AND ts.deleted_at IS NULL
     GROUP BY buoc.asset_id
    HAVING SUM(buoc.delta) <> 0
  `);
  return dong.map((d) => ({ assetId: d.asset_id, ton: veSo(d.ton) }));
}

/**
 * Tồn của MỘT NHÓM tài sản — dùng cho ô chọn hàng lẻ theo tên.
 *
 * Có `tonTatCa()` rồi nhưng cố ý không dùng lại ở đây: ô chọn gọi lại sau mỗi
 * vài ký tự người dùng gõ, mà `tonTatCa()` quét TOÀN BỘ bảng movements. Ở đây
 * chỉ cần tồn của đúng 20 dòng đang hiện.
 *
 * `locationId` có truyền thì tính tồn TẠI ĐIỂM ĐÓ, không thì tính tổng toàn hệ
 * thống — người lập yêu cầu cần biết kho mình lấy còn bao nhiêu, chứ tổng toàn
 * công ty không giúp gì.
 */
export async function tonCuaNhom(
  assetIds: readonly string[],
  locationId: string | null,
  db: PrismaTx = prisma,
): Promise<Map<string, number>> {
  if (assetIds.length === 0) return new Map();
  const ids = Prisma.join(assetIds.map((x) => Prisma.sql`${x}`));
  const locVao = locationId
    ? Prisma.sql`AND to_location_id = ${locationId}`
    : Prisma.sql`AND to_location_id IS NOT NULL`;
  const locRa = locationId
    ? Prisma.sql`AND from_location_id = ${locationId}`
    : Prisma.sql`AND from_location_id IS NOT NULL`;

  const dong = await db.$queryRaw<Array<{ asset_id: string; ton: unknown }>>(Prisma.sql`
    SELECT buoc.asset_id AS asset_id, SUM(buoc.delta) AS ton
      FROM (
            SELECT asset_id, quantity AS delta
              FROM movements
             WHERE asset_id IN (${ids}) ${locVao}
            UNION ALL
            SELECT asset_id, -quantity AS delta
              FROM movements
             WHERE asset_id IN (${ids}) ${locRa}
           ) AS buoc
      JOIN assets ts ON ts.id = buoc.asset_id AND ts.deleted_at IS NULL
     GROUP BY buoc.asset_id
  `);
  return new Map(dong.map((d) => [d.asset_id, veSo(d.ton)]));
}

/**
 * Tồn của MỘT NHÓM tài sản, TÁCH THEO TỪNG ĐỊA ĐIỂM.
 *
 * Khác `tonCuaNhom` ở chỗ không gộp lại thành một con số. Cần vậy vì một mã
 * hàng lẻ nằm rải nhiều nơi: 70 quyển ở kho, 30 quyển đã về trường. Gộp lại
 * thành "còn 100" là đúng số nhưng vô dụng với người đang hỏi "kho còn mấy
 * quyển để tôi lấy" — và đó chính là con số họ nhìn khi lập yêu cầu.
 */
export async function tonNhomTheoDiem(
  assetIds: readonly string[],
  db: PrismaTx = prisma,
): Promise<Map<string, Array<{ locationId: string; ton: number }>>> {
  if (assetIds.length === 0) return new Map();
  const ids = Prisma.join(assetIds.map((x) => Prisma.sql`${x}`));
  const dong = await db.$queryRaw<DongTho[]>(Prisma.sql`
    SELECT buoc.asset_id AS asset_id, buoc.location_id AS location_id, SUM(buoc.delta) AS ton
      FROM (
            SELECT asset_id, to_location_id AS location_id, quantity AS delta
              FROM movements
             WHERE asset_id IN (${ids}) AND to_location_id IS NOT NULL
            UNION ALL
            SELECT asset_id, from_location_id AS location_id, -quantity AS delta
              FROM movements
             WHERE asset_id IN (${ids}) AND from_location_id IS NOT NULL
           ) AS buoc
      JOIN assets ts ON ts.id = buoc.asset_id AND ts.deleted_at IS NULL
     GROUP BY buoc.asset_id, buoc.location_id
    HAVING SUM(buoc.delta) <> 0
  `);
  const ra = new Map<string, Array<{ locationId: string; ton: number }>>();
  for (const d of dong) {
    const mot = doiDong(d);
    const da = ra.get(mot.assetId);
    if (da) da.push({ locationId: mot.locationId, ton: mot.ton });
    else ra.set(mot.assetId, [{ locationId: mot.locationId, ton: mot.ton }]);
  }
  return ra;
}

/**
 * Sau khi bớt `soLuong` khỏi `locationId`, điểm đó còn gì không?
 *
 * Dùng để quyết định có dời `current_location_id` của tài sản hay không. Tài
 * sản quản lý theo SỐ LƯỢNG nằm rải nhiều nơi, lấy 30 trong 100 mà dời vị trí
 * cả dòng sang nơi nhận thì 70 cái còn lại trong kho biến mất khỏi mọi danh
 * sách lọc theo vị trí — kho vẫn còn hàng mà máy bảo không có.
 */
export async function conLaiSauKhiBot(
  assetId: string,
  locationId: string,
  soLuong: number,
  db: PrismaTx = prisma,
): Promise<number> {
  return (await tonTaiDiaDiem(assetId, locationId, db)) - soLuong;
}

/**
 * HÀNG ĐÃ RA KHỎI KHO NHƯNG CHƯA ĐƯỢC BÊN NHẬN XÁC NHẬN ("đang trên đường").
 *
 * Phân bổ về trường và luân chuyển trường CHƯA ghi movement lúc xuất kho — bên
 * nhận bấm xác nhận mới ghi (luồng C). Nên nếu chỉ nhìn `movements` thì kho báo
 * còn nguyên trong khi hàng đã lên xe đi rồi: đúng sổ sách, sai thực tế.
 *
 * Hàm này đếm phần chênh đó, theo (tài sản, điểm xuất đi), để chỗ hiển thị trừ
 * ra được: "kho còn 100, đang đi 30, thật sự lấy được 70".
 *
 * KHÔNG cộng vào/trừ khỏi `movements`: tồn sổ sách vẫn phải là Σ movements
 * (nguyên tắc bất biến #5). Đây là con số đi kèm, không phải con số thay thế.
 */
export async function hangDangTrenDuong(
  assetIds: readonly string[],
  db: PrismaTx = prisma,
): Promise<Map<string, Array<{ locationId: string; soLuong: number }>>> {
  if (assetIds.length === 0) return new Map();
  const ids = Prisma.join(assetIds.map((x) => Prisma.sql`${x}`));
  const dong = await db.$queryRaw<Array<{ asset_id: string; location_id: string; so: unknown }>>(Prisma.sql`
    SELECT dong.asset_id AS asset_id,
           ts.current_location_id AS location_id,
           SUM(COALESCE(dong.issued_quantity, dong.quantity)) AS so
      FROM request_items dong
      JOIN requests yc ON yc.id = dong.request_id
      JOIN assets ts ON ts.id = dong.asset_id AND ts.deleted_at IS NULL
     WHERE dong.asset_id IN (${ids})
       AND yc.status = 'DA_XUAT'
       AND yc.type IN ('PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG')
       AND ts.current_location_id IS NOT NULL
     GROUP BY dong.asset_id, ts.current_location_id
  `);
  const ra = new Map<string, Array<{ locationId: string; soLuong: number }>>();
  for (const d of dong) {
    const mot = { locationId: d.location_id, soLuong: veSo(d.so) };
    const da = ra.get(d.asset_id);
    if (da) da.push(mot);
    else ra.set(d.asset_id, [mot]);
  }
  return ra;
}
