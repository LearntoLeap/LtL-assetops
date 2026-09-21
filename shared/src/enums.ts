/**
 * Các tập giá trị enum dùng chung giữa api và web.
 *
 * Đây là bản sao có chủ đích của enum trong `api/prisma/schema.prisma`:
 * web không phụ thuộc @prisma/client, nên cần một khai báo độc lập. Phía api
 * có kiểm tra biên dịch (`api/src/shared/kiem-tra-enum.ts`) bảo đảm hai bên
 * không lệch nhau — thêm/bớt giá trị trong schema mà quên sửa ở đây sẽ làm
 * `npm run build` của api báo lỗi.
 */

export const VAI_TRO = ['ADMIN', 'VAN_HANH', 'KHO', 'NHAN_SU', 'TRUONG'] as const;
export type VaiTro = (typeof VAI_TRO)[number];

export const LOAI_DIEM_LUU_TRU = [
  'KHO_VAN_PHONG',
  'DIEM_TRUONG',
  'DOI_TAC_MUON',
  'KHO_SU_KIEN',
] as const;
export type LoaiDiemLuuTru = (typeof LOAI_DIEM_LUU_TRU)[number];

export const KIEU_QUAN_LY = ['DON_VI', 'SO_LUONG'] as const;
export type KieuQuanLy = (typeof KIEU_QUAN_LY)[number];

export const NGUON_GOC = ['NHAP_TU_IPP', 'LTL_MUA', 'LTL_MUON_DOI_TAC', 'KHAC'] as const;
export type NguonGoc = (typeof NGUON_GOC)[number];

export const MUC_DICH_SU_DUNG = ['XHH', 'SU_KIEN', 'CO_DINH_TAI_KHO', 'CHO_MUON'] as const;
export type MucDichSuDung = (typeof MUC_DICH_SU_DUNG)[number];

export const TINH_TRANG = [
  'TOT',
  'DANG_SU_DUNG',
  'CAN_BAO_TRI',
  'HONG',
  'DANG_BAO_HANH',
  'MAT',
] as const;
export type TinhTrang = (typeof TINH_TRANG)[number];

export const TRANG_THAI_PHAN_BO = [
  'TAI_KHO',
  'DA_PHAN_BO',
  'DANG_VAN_CHUYEN',
  'CHO_MUON',
  'DANG_PHUC_VU_SU_KIEN',
] as const;
export type TrangThaiPhanBo = (typeof TRANG_THAI_PHAN_BO)[number];

export const LOAI_YEU_CAU = [
  'XUAT_KHO',
  'NHAP_KHO',
  'PHAN_BO_VE_TRUONG',
  'LUAN_CHUYEN_TRUONG',
  'CHO_MUON',
  'TRA_VE_KHO',
  'BAO_HONG',
] as const;
export type LoaiYeuCau = (typeof LOAI_YEU_CAU)[number];

export const TRANG_THAI_YEU_CAU = [
  'BAN_NHAP',
  'CHO_DUYET',
  'DA_DUYET',
  'TU_CHOI',
  'DA_XUAT',
  'DA_HOAN_TAT',
] as const;
export type TrangThaiYeuCau = (typeof TRANG_THAI_YEU_CAU)[number];

export const LOAI_DI_CHUYEN = [
  'NHAP_BAN_DAU',
  'XUAT_KHO',
  'NHAP_KHO',
  'PHAN_BO',
  'LUAN_CHUYEN',
  'CHO_MUON',
  'TRA_VE_KHO',
  'DIEU_CHINH_KIEM_KE',
  'XUAT_LINH_KIEN',
] as const;
export type LoaiDiChuyen = (typeof LOAI_DI_CHUYEN)[number];

export const LOAI_ANH = [
  'HIEN_TRANG',
  'ANH_XUAT',
  'ANH_NHAN',
  'BAO_HONG',
  'KIEM_KE',
  'BBBG',
  'KIOSK_BACKGROUND',
  'LINH_KIEN',
  'WIKI',
] as const;
export type LoaiAnh = (typeof LOAI_ANH)[number];

// --- Thư viện wiki thiết bị -------------------------------------------------

export const LOAI_MUC_WIKI = ['THANH_PHAN', 'LUU_Y', 'LOI_THUONG_GAP', 'THONG_SO'] as const;
export type LoaiMucWiki = (typeof LOAI_MUC_WIKI)[number];

export const MUC_DO_LUU_Y = ['THONG_TIN', 'CAN_THAN', 'NGUY_HIEM'] as const;
export type MucDoLuuY = (typeof MUC_DO_LUU_Y)[number];

export const LOAI_TAI_LIEU_WIKI = [
  'HUONG_DAN_HANG',
  'HUONG_DAN_NOI_BO',
  'SO_DO_MACH',
  'PHAN_MEM_FIRMWARE',
  'BAO_HANH',
  'DAO_TAO',
  'KHAC',
] as const;
export type LoaiTaiLieuWiki = (typeof LOAI_TAI_LIEU_WIKI)[number];

export const TRANG_THAI_WIKI = ['BAN_NHAP', 'DA_DANG'] as const;
export type TrangThaiWiki = (typeof TRANG_THAI_WIKI)[number];

export const LOAI_DICH_WIKI = ['THIET_BI', 'LOAI_TAI_SAN', 'DONG_GIAI_PHAP'] as const;
export type LoaiDichWiki = (typeof LOAI_DICH_WIKI)[number];

export const TRANG_THAI_BBBG = ['BAN_NHAP', 'CHO_XAC_NHAN', 'DA_XAC_NHAN', 'TU_CHOI'] as const;
export type TrangThaiBBBG = (typeof TRANG_THAI_BBBG)[number];

export const TRANG_THAI_KIEM_KE = [
  'BAN_NHAP',
  'DANG_KIEM',
  'CHO_CHOT',
  'DA_CHOT',
  'HUY',
] as const;
export type TrangThaiKiemKe = (typeof TRANG_THAI_KIEM_KE)[number];

export const LOAI_CANH_BAO = [
  'TINH_TRANG_THAY_DOI',
  'QUA_HAN_TRA',
  'CHENH_LECH_KIEM_KE',
  'BAO_HONG',
  'DANG_NHAP_NGOAI_VUNG',
] as const;
export type LoaiCanhBao = (typeof LOAI_CANH_BAO)[number];

export const MUC_DO_CANH_BAO = ['THAP', 'TRUNG_BINH', 'CAO'] as const;
export type MucDoCanhBao = (typeof MUC_DO_CANH_BAO)[number];

/**
 * Ảnh nền có sẵn cho màn hình KIOSK tại kho (giai đoạn 6).
 *
 * Đây KHÔNG phải enum trong CSDL: cột `kiosk_settings.background_key` là VarChar
 * nên thêm/bớt mẫu nền không cần migration. Mỗi mẫu là một dải màu vẽ bằng CSS ở
 * phía web, không kèm tệp ảnh nào — kho mã nguồn không phình thêm và màn hình
 * kiosk không phải tải ảnh nặng qua mạng kho.
 */
export const ANH_NEN_KIOSK = [
  'XANH_MACH_DIEN',
  'XANH_CYAN',
  'DEM_KHO',
  'TOI_GIAN',
] as const;
export type AnhNenKiosk = (typeof ANH_NEN_KIOSK)[number];
