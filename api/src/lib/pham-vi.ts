/**
 * PHẠM VI DỮ LIỆU theo vai trò — kiểm ở SERVER (nguyên tắc bất biến #6).
 *
 * Ẩn nút ở frontend chỉ là phụ: mọi truy vấn danh sách đều phải đi qua các hàm
 * ở đây để ghép điều kiện `where`, nên gọi thẳng API cũng không lấy được dữ
 * liệu ngoài phạm vi.
 */
import type { Prisma } from '@prisma/client';
import type { NguoiDungDaXacThuc } from '../types/express.js';
import { loi403 } from './loi-http.js';

export interface PhamVi {
  /** Xem được toàn bộ kho hay không. */
  toanBoKho: boolean;
  /** Chỉ xem dữ liệu thuộc các điểm lưu trữ này (null = không giới hạn theo điểm). */
  diaDiem: readonly string[] | null;
  /** Chỉ xem dữ liệu do chính mình tạo hoặc đang giữ. */
  chiCuaMinh: boolean;
}

/**
 * ADMIN / VAN_HANH / KHO xem toàn bộ kho (KHO cần tra cứu mọi mã thiết bị tại
 * quầy). TRUONG chỉ xem điểm trường của mình. NHAN_SU chỉ xem thứ mình đang giữ.
 */
export function phamViCua(nguoiDung: NguoiDungDaXacThuc): PhamVi {
  switch (nguoiDung.role) {
    case 'ADMIN':
    case 'VAN_HANH':
    case 'KHO':
      return { toanBoKho: true, diaDiem: null, chiCuaMinh: false };
    case 'TRUONG': {
      if (!nguoiDung.locationId) {
        throw loi403(
          'Tài khoản điểm trường chưa được gán trường phụ trách. Liên hệ quản trị viên.',
        );
      }
      return { toanBoKho: false, diaDiem: [nguoiDung.locationId], chiCuaMinh: false };
    }
    case 'NHAN_SU':
      return { toanBoKho: false, diaDiem: null, chiCuaMinh: true };
  }
}

/** Điều kiện `where` cho danh sách thiết bị. */
export function dieuKienTaiSan(nguoiDung: NguoiDungDaXacThuc): Prisma.AssetWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return {};
  if (pv.diaDiem) return { currentLocationId: { in: [...pv.diaDiem] } };
  return { holderUserId: nguoiDung.id };
}

/** Điều kiện `where` cho danh sách điểm lưu trữ. */
export function dieuKienDiaDiem(nguoiDung: NguoiDungDaXacThuc): Prisma.LocationWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return {};
  if (pv.diaDiem) return { id: { in: [...pv.diaDiem] } };
  // NHAN_SU không cần duyệt kho: chỉ thấy điểm đang giữ thiết bị của mình.
  return { assets: { some: { holderUserId: nguoiDung.id } } };
}

/** Điều kiện `where` cho danh sách yêu cầu. */
export function dieuKienYeuCau(nguoiDung: NguoiDungDaXacThuc): Prisma.RequestWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return {};
  if (pv.diaDiem) {
    const diaDiem = [...pv.diaDiem];
    return {
      OR: [
        { createdById: nguoiDung.id },
        { fromLocationId: { in: diaDiem } },
        { toLocationId: { in: diaDiem } },
      ],
    };
  }
  return { createdById: nguoiDung.id };
}

/** Chặn thẳng nếu vai trò không được xem toàn bộ kho. */
export function batBuocToanBoKho(nguoiDung: NguoiDungDaXacThuc): void {
  if (!phamViCua(nguoiDung).toanBoKho) {
    throw loi403('Vai trò của bạn không được xem dữ liệu toàn bộ kho.');
  }
}
