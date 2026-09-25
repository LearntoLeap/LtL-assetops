import { z } from 'zod';
import { LOAI_YEU_CAU, TINH_TRANG, TRANG_THAI_BBBG } from '@ltl/taisan-shared';
import { chuoiSua, chuoiTuyChon, soDienThoaiSua, soDienThoaiTuyChon } from '../../lib/luoc-do-chung.js';

const ngayISO = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo dạng NĂM-THÁNG-NGÀY, ví dụ 2026-03-15');

export const luocDoTaoBBBG = z.object({
  /** Sinh từ một yêu cầu đã duyệt — lấy sẵn danh sách thiết bị và nơi đến. */
  requestId: z.string().trim().min(1, 'Chưa chọn yêu cầu để lập biên bản.').max(30),

  /** Mẫu biên bản. Bỏ trống thì lấy đúng loại của yêu cầu. */
  templateType: z.enum(LOAI_YEU_CAU).optional(),
  subtitle: chuoiTuyChon(255),
  basis: chuoiTuyChon(2000),

  giverName: z.string().trim().min(2, 'Chưa điền tên người giao.').max(191),
  giverTitle: chuoiTuyChon(191),
  giverOrg: z.string().trim().min(2, 'Chưa điền đơn vị bên giao.').max(191),
  giverAddress: chuoiTuyChon(255),
  giverTaxCode: chuoiTuyChon(32),
  giverPhone: soDienThoaiTuyChon,

  receiverOrg: z.string().trim().min(2, 'Chưa điền đơn vị bên nhận.').max(191),
  receiverName: z.string().trim().min(2, 'Chưa điền tên người nhận.').max(191),
  receiverTitle: chuoiTuyChon(191),
  receiverPhone: soDienThoaiTuyChon,
  receiverAddress: chuoiTuyChon(255),

  issuedDate: ngayISO.optional(),
  handoverPlace: chuoiTuyChon(255),
  inspection: chuoiTuyChon(5000),
  obligations: chuoiTuyChon(5000),
  copies: z.coerce.number().int().min(1, 'Ít nhất 01 bản.').max(20, 'Nhiều nhất 20 bản.').optional(),
  commitment: chuoiTuyChon(5000),
  note: chuoiTuyChon(5000),
});
export type DuLieuTaoBBBG = z.infer<typeof luocDoTaoBBBG>;

export const luocDoSuaBBBG = z
  .object({
    templateType: z.enum(LOAI_YEU_CAU).optional(),
    subtitle: chuoiSua(255),
    basis: chuoiSua(2000),
    giverName: z.string().trim().min(2).max(191).optional(),
    giverTitle: chuoiSua(191),
    giverOrg: z.string().trim().min(2).max(191).optional(),
    giverAddress: chuoiSua(255),
    giverTaxCode: chuoiSua(32),
    giverPhone: soDienThoaiSua,
    receiverOrg: z.string().trim().min(2).max(191).optional(),
    receiverName: z.string().trim().min(2).max(191).optional(),
    receiverTitle: chuoiSua(191),
    receiverPhone: soDienThoaiSua,
    receiverAddress: chuoiSua(255),
    issuedDate: ngayISO.optional(),
    handoverPlace: chuoiSua(255),
    inspection: chuoiSua(5000),
    obligations: chuoiSua(5000),
    copies: z.coerce.number().int().min(1).max(20).optional(),
    commitment: chuoiSua(5000),
    note: chuoiSua(5000),
    /** Sửa tình trạng, đơn vị tính, nhóm và ghi chú từng dòng (khi còn là bản nháp). */
    muc: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(30),
          conditionSnapshot: z.enum(TINH_TRANG).optional(),
          unit: z.string().trim().min(1).max(32).optional(),
          groupLabel: chuoiSua(191),
          note: chuoiSua(255),
        }),
      )
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có trường nào để cập nhật.' });
export type DuLieuSuaBBBG = z.infer<typeof luocDoSuaBBBG>;

export const luocDoXacNhanBBBG = z.object({
  /** Ghi chú của bên nhận khi xác nhận (vd thiếu phụ kiện). */
  ghiChu: chuoiTuyChon(2000),
});

export const luocDoTuChoiBBBG = z.object({
  rejectionNote: z.string().trim().min(5, 'Phải ghi rõ lý do từ chối nhận.').max(2000),
});

export const luocDoLocBBBG = z.object({
  status: z.enum(TRANG_THAI_BBBG).optional(),
  templateType: z.enum(LOAI_YEU_CAU).optional(),
  receiverLocationId: chuoiTuyChon(30),
  tuKhoa: chuoiTuyChon(191),
  trang: z.coerce.number().int().positive().default(1),
  moiTrang: z.coerce.number().int().positive().max(200).default(25),
});
export type DuLieuLocBBBG = z.infer<typeof luocDoLocBBBG>;
