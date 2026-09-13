import { z } from 'zod';
import { LOAI_YEU_CAU, TINH_TRANG, TRANG_THAI_YEU_CAU } from '@ltl/taisan-shared';
import { chuoiSua, chuoiTuyChon } from '../../lib/luoc-do-chung.js';

const ngayGioISO = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Thời điểm không hợp lệ.');

export const luocDoTaoYeuCau = z.object({
  type: z.enum(LOAI_YEU_CAU),
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
 * Mỗi dòng thiết bị phải có ĐỦ HAI thứ:
 *   - `maDaQuet`: mã đọc được từ nhãn (quét QR hoặc gõ tay) — server đối chiếu
 *     đúng mã mới cho qua, tránh cầm nhầm thiết bị;
 *   - `anhIds`: ít nhất một ảnh chụp thực tế thiết bị, thấy được nhãn mã.
 * Thiếu một trong hai thì API từ chối hoàn tất (nguyên tắc bất biến #3).
 */
export const luocDoXuatKho = z.object({
  muc: z
    .array(
      z.object({
        assetId: z.string().trim().min(1).max(30),
        maDaQuet: z.string().trim().toUpperCase().min(1, 'Chưa quét/nhập mã thiết bị.').max(64),
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
 * Ngoài mã và ảnh còn phải khai TÌNH TRẠNG lúc trả; khác lúc xuất thì hệ thống
 * tự sinh cảnh báo cho quản trị.
 */
export const luocDoNhapKho = z.object({
  veLocationId: z.string().trim().min(1, 'Chưa chọn kho nhận hàng về.').max(30),
  muc: z
    .array(
      z.object({
        assetId: z.string().trim().min(1).max(30),
        maDaQuet: z.string().trim().toUpperCase().min(1, 'Chưa quét/nhập mã thiết bị.').max(64),
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
