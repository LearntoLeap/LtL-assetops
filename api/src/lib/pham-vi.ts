/**
 * PHẠM VI DỮ LIỆU theo vai trò — kiểm ở SERVER (nguyên tắc bất biến #6).
 *
 * Ẩn nút ở frontend chỉ là phụ: mọi truy vấn danh sách đều phải đi qua các hàm
 * ở đây để ghép điều kiện `where`, nên gọi thẳng API cũng không lấy được dữ
 * liệu ngoài phạm vi.
 */
import type { Prisma } from '@prisma/client';
import type { NguoiDungDaXacThuc } from '../types/express.js';
import { prisma, type PrismaTx } from '../prisma.js';
import { loi403 } from './loi-http.js';
import { idTaiSanThuocCacDiem } from './ton-kho.js';

export interface PhamVi {
  /** Xem được toàn bộ kho hay không. */
  toanBoKho: boolean;
  /** Chỉ xem dữ liệu thuộc các điểm lưu trữ này (null = không giới hạn theo điểm). */
  diaDiem: readonly string[] | null;
  /** Chỉ xem dữ liệu do chính mình tạo hoặc đang giữ. */
  chiCuaMinh: boolean;
}

/**
 * ADMIN / VAN_HANH / KHO / NHAN_SU xem toàn bộ kho. TRUONG chỉ xem điểm trường
 * của mình.
 *
 * NHÂN SỰ PHÒNG BAN làm được mọi việc của Kho — xuất / nhập kho, tìm kiếm có
 * gợi ý, lập biên bản, kiểm kê… — nên xem CÙNG dữ liệu như Kho. Chỗ khác duy
 * nhất là không có giao diện Kiosk, mà đó là chuyện giao diện chứ không phải
 * phạm vi dữ liệu. (Trước đây nhân sự chỉ thấy thứ mình đang giữ.)
 */
export function phamViCua(nguoiDung: NguoiDungDaXacThuc): PhamVi {
  switch (nguoiDung.role) {
    case 'ADMIN':
    case 'VAN_HANH':
    case 'KHO':
    case 'NHAN_SU':
      return { toanBoKho: true, diaDiem: null, chiCuaMinh: false };
    case 'TRUONG': {
      if (!nguoiDung.locationId) {
        throw loi403(
          'Tài khoản điểm trường chưa được gán trường phụ trách. Liên hệ quản trị viên.',
        );
      }
      return { toanBoKho: false, diaDiem: [nguoiDung.locationId], chiCuaMinh: false };
    }
  }
}

/**
 * Nơi đặt của một thiết bị, CHE ĐI nếu nằm ngoài phạm vi điểm của người xem.
 * Tài khoản trường thấy hàng lẻ dùng chung với nơi khác — cột vị trí của mã đó
 * có thể trỏ về kho hay một trường khác, mà trường chỉ được biết trường mình.
 */
export function noiTrongPhamVi<T extends { id: string }>(
  nguoiDung: NguoiDungDaXacThuc,
  noi: T | null,
): T | null {
  if (!noi) return null;
  return diemTrongPhamVi(nguoiDung, noi.id) ? noi : null;
}

/**
 * Che nơi đặt ngoài phạm vi trên các dòng thiết bị lồng trong một phiếu (báo
 * hỏng, linh kiện…). Vai trò xem toàn kho giữ nguyên.
 */
export function cheNoiTrongDong<
  T extends { asset: { currentLocation: { id: string; name: string } | null } },
>(nguoiDung: NguoiDungDaXacThuc, dong: readonly T[]): T[] {
  if (phamViCua(nguoiDung).toanBoKho) return [...dong];
  return dong.map((d) => ({
    ...d,
    asset: { ...d.asset, currentLocation: noiTrongPhamVi(nguoiDung, d.asset.currentLocation) },
  }));
}

/** Điểm này có nằm trong phạm vi dữ liệu của người dùng không. */
export function diemTrongPhamVi(nguoiDung: NguoiDungDaXacThuc, locationId: string): boolean {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return true;
  return pv.diaDiem?.includes(locationId) ?? false;
}

/**
 * Điều kiện `where` cho danh sách thiết bị.
 *
 * LUÔN loại thiết bị ĐÃ XOÁ MỀM (`deletedAt != null`), kể cả với ADMIN. Gộp phép
 * lọc đó vào đây chứ không rải ở từng truy vấn: hàm này đã được mọi chỗ đọc danh
 * sách thiết bị dùng rồi (nguyên tắc bất biến #6), nên bỏ sót một chỗ là thiết bị
 * "đã xoá" lại hiện ra ở đúng chỗ đó — loại lỗi rất khó thấy.
 *
 * TÀI KHOẢN TRƯỜNG thấy thiết bị CỦA TRƯỜNG MÌNH theo TỒN THẬT, không chỉ theo
 * cột vị trí: hàng lẻ (sách, cờ…) nằm rải nhiều nơi, kho cấp 30 trong 100 quyển
 * về trường thì cột vị trí vẫn trỏ kho — lọc theo cột đó là trường không tìm,
 * không quét, không báo hỏng được 30 quyển mình đang có. Nên trường thấy:
 *   - thiết bị có cột vị trí là trường mình;
 *   - mọi thiết bị còn tồn tại trường (Σ movements > 0);
 *   - hàng đang trên đường về trường (đã xuất phân bổ / luân chuyển, chờ xác
 *     nhận bàn giao) — trường là nơi NHẬN, phải thấy thứ sắp về.
 * Hàm phải chạy truy vấn tồn nên là async.
 *
 * Kết quả có thể chứa khoá `OR` — nơi gọi PHẢI ghép bằng `AND: [phamVi, ...]`,
 * không spread: spread thêm `OR` của ô tìm kiếm sẽ GHI ĐÈ phạm vi và lộ toàn kho.
 *
 * Trang Thùng rác cố ý KHÔNG dùng hàm này; nó lọc `deletedAt != null` riêng.
 */
export async function dieuKienTaiSan(
  nguoiDung: NguoiDungDaXacThuc,
  db: PrismaTx = prisma,
): Promise<Prisma.AssetWhereInput> {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return { deletedAt: null };
  if (pv.diaDiem) {
    const diaDiem = [...pv.diaDiem];
    const ids = await idTaiSanThuocCacDiem(diaDiem, db);
    return {
      deletedAt: null,
      OR: [
        { currentLocationId: { in: diaDiem } },
        ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
      ],
    };
  }
  return { deletedAt: null, holderUserId: nguoiDung.id };
}

/** Điều kiện `where` cho danh sách điểm lưu trữ. */
export function dieuKienDiaDiem(nguoiDung: NguoiDungDaXacThuc): Prisma.LocationWhereInput {
  const pv = phamViCua(nguoiDung);
  // `deletedAt: null` ở CẢ BA nhánh, không phải chỉ nhánh đầu: điểm trong thùng
  // rác phải biến khỏi mọi danh sách với mọi vai trò. Đặt ở đây — chỗ duy nhất
  // mọi truy vấn danh sách điểm đều đi qua — thay vì rải ở từng tuyến, vì rải
  // thì chỉ cần quên một chỗ là điểm đã xoá lại hiện ra.
  if (pv.toanBoKho) return { deletedAt: null };
  if (pv.diaDiem) return { deletedAt: null, id: { in: [...pv.diaDiem] } };
  // Không vai trò nào còn rơi vào nhánh này (nhân sự đã xem toàn kho); giữ lại
  // phòng khi thêm vai trò mới mà quên khai phạm vi — thà thấy ít còn hơn lộ.
  return { deletedAt: null, assets: { some: { holderUserId: nguoiDung.id } } };
}

/**
 * Điều kiện `where` cho danh sách yêu cầu.
 *
 * `deletedAt: null` ở CẢ BA nhánh — yêu cầu trong thùng rác phải biến khỏi mọi
 * danh sách với mọi vai trò. Đặt ở đây, chỗ duy nhất mọi truy vấn danh sách đi
 * qua, thay vì rải ở từng tuyến: rải thì chỉ cần quên một chỗ là phiếu đã xoá
 * lại hiện ra, hoặc tệ hơn là vẫn cộng vào số đếm trên trang Tổng quan.
 */
export function dieuKienYeuCau(nguoiDung: NguoiDungDaXacThuc): Prisma.RequestWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return { deletedAt: null };
  if (pv.diaDiem) {
    const diaDiem = [...pv.diaDiem];
    return {
      deletedAt: null,
      OR: [
        { createdById: nguoiDung.id },
        { fromLocationId: { in: diaDiem } },
        { toLocationId: { in: diaDiem } },
      ],
    };
  }
  return { deletedAt: null, createdById: nguoiDung.id };
}

/**
 * PHIẾU BÁO HỎNG trong phạm vi — dùng chung cho danh sách / chi tiết báo hỏng,
 * lấy linh kiện và ảnh của phiếu báo hỏng.
 *
 * Tài khoản trường KHÔNG xét theo phạm vi thiết bị: một mã hàng lẻ dùng chung
 * cho nhiều trường, xét theo thiết bị thì trường A thấy (và lấy linh kiện vào)
 * phiếu báo hỏng của trường B chỉ vì cả hai cùng có sách mã đó. Trường thấy:
 * phiếu mình báo, phiếu do tài khoản của trường mình báo, và phiếu về thiết bị
 * quản lý TỪNG ĐƠN VỊ đang nằm ở trường (cái đó chắc chắn là của trường).
 */
export function dieuKienBaoHong(nguoiDung: NguoiDungDaXacThuc): Prisma.RequestWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return { deletedAt: null };
  if (pv.diaDiem) {
    const ds = [...pv.diaDiem];
    return {
      deletedAt: null,
      OR: [
        { createdById: nguoiDung.id },
        // Chỉ tài khoản TRƯỜNG mới là "người của trường" — tài khoản đổi vai trò
        // có thể còn giữ locationId cũ.
        { createdBy: { role: 'TRUONG', locationId: { in: ds } } },
        {
          items: {
            some: {
              asset: { deletedAt: null, trackingType: 'DON_VI', currentLocationId: { in: ds } },
            },
          },
        },
      ],
    };
  }
  return { deletedAt: null, createdById: nguoiDung.id };
}

/** Yêu cầu chưa bị xoá mềm — dùng cho những chỗ đếm không qua phạm vi. */
export const YEU_CAU_CON_SONG = { deletedAt: null } satisfies Prisma.RequestWhereInput;

/** Biên bản chưa bị xoá mềm. */
export const BIEN_BAN_CON_SONG = { deletedAt: null } satisfies Prisma.HandoverNoteWhereInput;

/** Chặn thẳng nếu vai trò không được xem toàn bộ kho. */
export function batBuocToanBoKho(nguoiDung: NguoiDungDaXacThuc): void {
  if (!phamViCua(nguoiDung).toanBoKho) {
    throw loi403('Vai trò của bạn không được xem dữ liệu toàn bộ kho.');
  }
}
