import { z } from 'zod';
import {
  KIEU_QUAN_LY,
  TINH_TRANG,
  TRANG_THAI_PHAN_BO,
} from '@ltl/taisan-shared';

/**
 * MÃ THIẾT BỊ — nguyên tắc bất biến #1.
 * Chữ in hoa, số, gạch ngang và gạch dưới. Chuẩn hoá về chữ hoa để
 * "ltl-rb-0001" và "LTL-RB-0001" không thành hai thiết bị khác nhau.
 */
export const maThietBi = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, 'Mã thiết bị phải có ít nhất 3 ký tự.')
  .max(64, 'Mã thiết bị tối đa 64 ký tự.')
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Mã chỉ gồm chữ in hoa, số và các dấu . _ -');

const ngayISO = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo dạng NĂM-THÁNG-NGÀY, ví dụ 2026-03-15');

/**
 * TẠO NHANH thiết bị khi lập yêu cầu mà mã chưa có trong kho.
 *
 * Người ở kho đang giữa việc — bắt họ rời form yêu cầu, sang trang Thiết bị,
 * điền đủ mười mấy ô rồi quay lại là mất mạch. Ở đây chỉ hỏi những gì KHÔNG
 * suy ra được: tên, loại tài sản, nơi nhập về, và ẢNH.
 *
 * ẢNH LÀ BẮT BUỘC, đúng lý do như với linh kiện không mã: thiết bị vào sổ mà
 * không ai thấy mặt nó thì sau này không đối chiếu được. Các trường còn lại
 * lấy mặc định an toàn (nguồn gốc KHÁC, tình trạng TỐT) và ghi rõ trong ghi
 * chú rằng bản ghi này tạo nhanh, cần bổ sung sau.
 *
 * Mã do SERVER sinh, không để người dùng tự đặt: tạo nhanh giữa lúc gấp là
 * lúc dễ đặt mã trùng hoặc sai quy ước nhất.
 */
export const luocDoTaoNhanhThietBi = z.object({
  name: z.string().trim().min(2, 'Tên thiết bị phải có ít nhất 2 ký tự.').max(191),
  categoryId: z.string().trim().min(1, 'Chưa chọn loại tài sản.').max(30),
  nhapVeLocationId: z.string().trim().min(1, 'Chưa chọn nơi nhập về.').max(30),
  /** Mã/serial của hãng cung cấp, nếu vỏ hộp có in. */
  vendorCode: z.string().trim().max(191).optional(),
  soLuongNhap: z.coerce.number().int().min(1).max(1_000_000).default(1),
  /**
   * Bỏ trống thì service tự lấy mục đích mã XHH. Tạo nhanh là lúc đang gấp,
   * không bắt chọn thêm một ô nữa.
   */
  purposeId: z.string().trim().max(30).optional(),
  /** Ảnh thiết bị — BẮT BUỘC ít nhất một. */
  anhIds: z
    .array(z.string().trim().min(1).max(30))
    .min(1, 'Bắt buộc chụp ít nhất một ảnh thiết bị khi tạo nhanh.')
    .max(5),
  note: z.string().trim().max(5000).optional(),
});
export type DuLieuTaoNhanhThietBi = z.infer<typeof luocDoTaoNhanhThietBi>;

export const luocDoTaoThietBi = z
  .object({
    /**
     * Bỏ trống thì SERVER tự sinh theo dạng
     * {nguồn gốc}-{loại}[-{dòng}]-{số thứ tự} (xem `lib/sinh-ma-thiet-bi.ts`).
     *
     * Vẫn cho gõ tay: nhập thiết bị cũ đã dán nhãn mã riêng thì phải giữ đúng
     * mã trên nhãn, không thể bắt dán lại nhãn mới cho cả kho.
     */
    code: maThietBi.optional(),
    name: z.string().trim().min(2, 'Tên thiết bị phải có ít nhất 2 ký tự.').max(191),
    categoryId: z.string().trim().min(1, 'Chưa chọn loại tài sản.').max(30),
    productLineId: z.string().trim().max(30).optional(),
    serialNumber: z.string().trim().max(191).optional(),
    originId: z.string().trim().min(1, 'Chưa chọn nguồn gốc.').max(30),
    originNote: z.string().trim().max(255).optional(),
    receivedDate: ngayISO.optional(),
    value: z.coerce.number().min(0).max(999_999_999_999).optional(),
    purposeId: z.string().trim().min(1, 'Chưa chọn mục đích sử dụng.').max(30),
    trackingType: z.enum(KIEU_QUAN_LY),
    condition: z.enum(TINH_TRANG).default('TOT'),
    /** Điểm nhận hàng lúc nhập ban đầu — sinh ra movement NHAP_BAN_DAU. */
    nhapVeLocationId: z.string().trim().min(1, 'Chưa chọn nơi nhập về.').max(30),
    /** Số lượng lúc nhập; tài sản quản lý theo đơn vị luôn là 1. */
    soLuongNhap: z.coerce.number().int().min(1).max(1_000_000).default(1),
    dueReturnAt: ngayISO.optional(),
    note: z.string().trim().max(5000).optional(),
  })
  .refine((v) => v.trackingType !== 'DON_VI' || v.soLuongNhap === 1, {
    message: 'Thiết bị quản lý theo từng đơn vị phải có số lượng nhập bằng 1.',
    path: ['soLuongNhap'],
  });
export type DuLieuTaoThietBi = z.infer<typeof luocDoTaoThietBi>;

/**
 * Sửa thiết bị: CHỈ các trường mô tả.
 *
 * Cố tình KHÔNG cho sửa `currentLocationId`, `allocationStatus`, `condition` ở
 * đây — vị trí và trạng thái chỉ đổi qua luồng yêu cầu → duyệt → xuất/nhập kho
 * (giai đoạn 4) hoặc điều chỉnh sau kiểm kê (giai đoạn 5), để không ai lách được
 * nguyên tắc bất biến #2 bằng cách sửa trực tiếp.
 */
export const luocDoSuaThietBi = z
  .object({
    name: z.string().trim().min(2).max(191).optional(),
    categoryId: z.string().trim().min(1).max(30).optional(),
    productLineId: z.string().trim().max(30).nullable().optional(),
    serialNumber: z.string().trim().max(191).nullable().optional(),
    originId: z.string().trim().min(1).max(30).optional(),
    originNote: z.string().trim().max(255).nullable().optional(),
    receivedDate: ngayISO.nullable().optional(),
    value: z.coerce.number().min(0).max(999_999_999_999).nullable().optional(),
    purposeId: z.string().trim().min(1).max(30).optional(),
    dueReturnAt: ngayISO.nullable().optional(),
    note: z.string().trim().max(5000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });
export type DuLieuSuaThietBi = z.infer<typeof luocDoSuaThietBi>;

export const luocDoLocThietBi = z.object({
  tuKhoa: z.string().trim().max(191).optional(),
  categoryId: z.string().trim().max(30).optional(),
  productLineId: z.string().trim().max(30).optional(),
  locationId: z.string().trim().max(30).optional(),
  condition: z.enum(TINH_TRANG).optional(),
  allocationStatus: z.enum(TRANG_THAI_PHAN_BO).optional(),
  purposeId: z.string().trim().max(30).optional(),
  trackingType: z.enum(KIEU_QUAN_LY).optional(),
  chiHoatDong: z.enum(['true', 'false']).default('true'),
  sapXep: z.enum(['code', 'name', 'moi_nhat']).default('code'),
  trang: z.coerce.number().int().positive().default(1),
  moiTrang: z.coerce.number().int().positive().max(200).default(50),
});
export type DuLieuLocThietBi = z.infer<typeof luocDoLocThietBi>;

/**
 * Danh sách id cho các thao tác HÀNG LOẠT (xoá nhiều, khôi phục nhiều, xoá hẳn
 * nhiều). Chặn ở 500 để một lần bấm không kéo theo hàng vạn bản ghi — cần nhiều
 * hơn thì chia lượt, hoặc dùng script `trien-khai/xoa-du-lieu.sh` cho cả kho.
 */
export const luocDoNhieuId = z.object({
  ids: z
    .array(z.string().trim().min(1).max(30))
    .min(1, 'Chưa chọn thiết bị nào.')
    .max(500, 'Mỗi lần tối đa 500 thiết bị.'),
});
export type DuLieuNhieuId = z.infer<typeof luocDoNhieuId>;

/** Tham số xem trước mã sẽ được cấp cho một tổ hợp danh mục. */
export const luocDoXemTruocMa = z.object({
  originId: z.string().trim().min(1, 'Chưa chọn nguồn gốc.').max(30),
  categoryId: z.string().trim().min(1, 'Chưa chọn loại tài sản.').max(30),
  productLineId: z.string().trim().max(30).optional(),
});
