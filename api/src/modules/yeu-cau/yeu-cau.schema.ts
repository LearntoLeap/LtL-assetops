import { z } from 'zod';
import { LOAI_YEU_CAU, TINH_TRANG, TRANG_THAI_YEU_CAU } from '@ltl/taisan-shared';
import { chuoiSua, chuoiTuyChon } from '../../lib/luoc-do-chung.js';

const ngayGioISO = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Thời điểm không hợp lệ.');

/**
 * Loại yêu cầu lập được qua API này. BAO_HONG bị loại ra CÓ CHỦ Ý.
 *
 * Báo hỏng có luồng riêng ở /api/bao-hong với ba ràng buộc mà API chung không
 * có: bắt buộc ít nhất một ẢNH, mô tả tối thiểu 10 ký tự, và tạo kèm bản ghi
 * cảnh báo để bốn nhóm nhận thông báo. Trước khi chặn, gọi thẳng /api/yeu-cau
 * với type BAO_HONG tạo ra phiếu ở trạng thái BAN_NHAP, không ảnh, không ai
 * được thông báo — phiếu hỏng vô hình. Đã dựng lại đúng lỗi này rồi mới sửa.
 */
const LOAI_LAP_QUA_API_CHUNG = LOAI_YEU_CAU.filter((l) => l !== 'BAO_HONG') as [
  (typeof LOAI_YEU_CAU)[number],
  ...(typeof LOAI_YEU_CAU)[number][],
];

export const luocDoTaoYeuCau = z.object({
  type: z.enum(LOAI_LAP_QUA_API_CHUNG, {
    errorMap: () => ({
      message:
        'Báo hỏng phải lập qua trang Báo hỏng (bắt buộc kèm ảnh và mô tả), không lập qua yêu cầu thường.',
    }),
  }),
  reason: z.string().trim().min(5, 'Lý do phải có ít nhất 5 ký tự.').max(5000),
  fromLocationId: chuoiTuyChon(30),
  toLocationId: chuoiTuyChon(30),
  destinationNote: chuoiTuyChon(255),
  expectedReturnAt: ngayGioISO.optional(),
  /** Danh sách MÃ thiết bị — tham chiếu theo mã, không nhập tên tự do. */
  muc: z
    .array(
      z.object({
        code: z.string().trim().toUpperCase().min(3).max(64),
        quantity: z.coerce.number().int().min(1).max(1_000_000).default(1),
        note: chuoiTuyChon(255),
      }),
    )
    .min(1, 'Yêu cầu phải có ít nhất một thiết bị.')
    .max(200, 'Mỗi yêu cầu tối đa 200 dòng thiết bị.'),
});
export type DuLieuTaoYeuCau = z.infer<typeof luocDoTaoYeuCau>;

export const luocDoSuaYeuCau = z
  .object({
    reason: z.string().trim().min(5).max(5000).optional(),
    fromLocationId: chuoiSua(30),
    toLocationId: chuoiSua(30),
    destinationNote: chuoiSua(255),
    expectedReturnAt: ngayGioISO.nullable().optional(),
    muc: luocDoTaoYeuCau.shape.muc.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });
export type DuLieuSuaYeuCau = z.infer<typeof luocDoSuaYeuCau>;

export const luocDoTuChoi = z.object({
  rejectionNote: z.string().trim().min(5, 'Phải ghi rõ lý do từ chối.').max(2000),
});

export const luocDoDuyet = z.object({
  ghiChu: chuoiTuyChon(2000),
});

/**
 * Hoàn tất XUẤT KHO — luồng A.
 *
 * ẢNH luôn bắt buộc, mọi loại thiết bị, cả chiều xuất và chiều nhập — ảnh là
 * bằng chứng của lần giao dịch (nguyên tắc bất biến #3).
 *
 * Cách NHẬN DẠNG thiết bị thì tuỳ loại, quyết định bởi `asset_categories.
 * yeu_cau_quet_ma` và kiểm ở service vì chỉ ở đó mới biết loại:
 *   - loại BẬT (robot — có nhãn mã dán trên từng cái): phải `maDaQuet` khớp
 *     đúng mã, chặn cầm nhầm thiết bị;
 *   - loại TẮT (ấn phẩm, phụ kiện, máy tính…): phải khai `tenDaKhai` và
 *     `quantity`. Thùng 200 quyển vở không có nhãn nào để quét, đòi quét chỉ
 *     tạo ra thao tác giả; ghi tên và số lượng kèm ảnh mới là bản ghi dùng được.
 *
 * Vì thế `maDaQuet` ở đây là TUỲ CHỌN — bắt buộc hay không do service xác định.
 */
export const luocDoXuatKho = z.object({
  muc: z
    .array(
      z.object({
        assetId: z.string().trim().min(1).max(30),
        maDaQuet: z.string().trim().toUpperCase().max(64).optional(),
        /** Tên thiết bị người ở kho tự khai — bắt buộc với loại không quét mã. */
        tenDaKhai: z.string().trim().max(191).optional(),
        anhIds: z
          .array(z.string().trim().min(1).max(30))
          .min(1, 'Phải có ít nhất một ảnh chụp thiết bị lúc xuất.'),
        quantity: z.coerce.number().int().min(1).max(1_000_000).optional(),
        ghiChu: chuoiTuyChon(2000),
      }),
    )
    .min(1, 'Chưa có dòng thiết bị nào để xuất.'),
  ghiChu: chuoiTuyChon(2000),
});
export type DuLieuXuatKho = z.infer<typeof luocDoXuatKho>;

/**
 * Hoàn tất NHẬP KHO / TRẢ VỀ KHO — luồng B.
 *
 * Cùng quy tắc nhận dạng như lúc xuất (quét mã với robot, khai tên + số lượng
 * với loại còn lại), và ẢNH cũng bắt buộc — để đối chiếu được thứ trả về với
 * thứ đã mang ra. Ngoài ra còn phải khai TÌNH TRẠNG lúc trả; khác lúc xuất thì
 * hệ thống tự sinh cảnh báo cho quản trị.
 */
export const luocDoNhapKho = z.object({
  veLocationId: z.string().trim().min(1, 'Chưa chọn kho nhận hàng về.').max(30),
  muc: z
    .array(
      z.object({
        assetId: z.string().trim().min(1).max(30),
        maDaQuet: z.string().trim().toUpperCase().max(64).optional(),
        tenDaKhai: z.string().trim().max(191).optional(),
        anhIds: z
          .array(z.string().trim().min(1).max(30))
          .min(1, 'Phải có ít nhất một ảnh chụp thiết bị lúc nhận.'),
        tinhTrang: z.enum(TINH_TRANG),
        quantity: z.coerce.number().int().min(1).max(1_000_000).optional(),
        ghiChu: chuoiTuyChon(2000),
      }),
    )
    .min(1, 'Chưa có dòng thiết bị nào để nhập.'),
  ghiChu: chuoiTuyChon(2000),
});
export type DuLieuNhapKho = z.infer<typeof luocDoNhapKho>;

export const luocDoLocYeuCau = z.object({
  type: z.enum(LOAI_YEU_CAU).optional(),
  status: z.enum(TRANG_THAI_YEU_CAU).optional(),
  cuaToi: z.enum(['true', 'false']).optional(),
  tuKhoa: chuoiTuyChon(191),
  trang: z.coerce.number().int().positive().default(1),
  moiTrang: z.coerce.number().int().positive().max(200).default(25),
});
export type DuLieuLocYeuCau = z.infer<typeof luocDoLocYeuCau>;
