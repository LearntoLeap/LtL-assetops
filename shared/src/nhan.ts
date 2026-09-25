/**
 * Nhãn tiếng Việt của mọi giá trị enum — nguồn duy nhất cho cả api và web.
 * CSDL lưu mã ASCII; đổi cách gọi tên ở đây không cần migration.
 */
import {
  LOAI_ANH,
  LOAI_CANH_BAO,
  LOAI_DICH_WIKI,
  LOAI_MUC_WIKI,
  LOAI_TAI_LIEU_WIKI,
  MUC_DO_LUU_Y,
  TRANG_THAI_WIKI,
  LOAI_DIEM_LUU_TRU,
  LOAI_DI_CHUYEN,
  LOAI_YEU_CAU,
  KIEU_QUAN_LY,
  MUC_DO_CANH_BAO,
  TINH_TRANG,
  ANH_NEN_KIOSK,
  TRANG_THAI_BBBG,
  TRANG_THAI_KIEM_KE,
  TRANG_THAI_PHAN_BO,
  TRANG_THAI_YEU_CAU,
  VAI_TRO,
  type KieuQuanLy,
  type LoaiAnh,
  type LoaiCanhBao,
  type LoaiDiChuyen,
  type LoaiDiemLuuTru,
  type LoaiDichWiki,
  type LoaiMucWiki,
  type LoaiTaiLieuWiki,
  type LoaiYeuCau,
  type MucDoLuuY,
  type TrangThaiWiki,
  type MucDoCanhBao,
  type TinhTrang,
  type AnhNenKiosk,
  type TrangThaiBBBG,
  type TrangThaiKiemKe,
  type TrangThaiPhanBo,
  type TrangThaiYeuCau,
  type VaiTro,
} from './enums.js';

export const NHAN_VAI_TRO = {
  ADMIN: 'Quản trị hệ thống',
  VAN_HANH: 'Vận hành thiết bị',
  KHO: 'Kho',
  NHAN_SU: 'Nhân sự phòng ban',
  TRUONG: 'Điểm trường',
} satisfies Record<VaiTro, string>;

export const NHAN_LOAI_DIEM_LUU_TRU = {
  KHO_VAN_PHONG: 'Kho văn phòng',
  DIEM_TRUONG: 'Điểm trường',
  DOI_TAC_MUON: 'Đối tác mượn',
  KHO_SU_KIEN: 'Kho sự kiện',
} satisfies Record<LoaiDiemLuuTru, string>;

export const NHAN_KIEU_QUAN_LY = {
  DON_VI: 'Theo từng đơn vị',
  SO_LUONG: 'Theo số lượng',
} satisfies Record<KieuQuanLy, string>;

export const NHAN_TINH_TRANG = {
  TOT: 'Tốt',
  DANG_SU_DUNG: 'Đang sử dụng',
  CAN_BAO_TRI: 'Cần bảo trì',
  HONG: 'Hỏng',
  DANG_BAO_HANH: 'Đang bảo hành',
  MAT: 'Mất',
} satisfies Record<TinhTrang, string>;

export const NHAN_TRANG_THAI_PHAN_BO = {
  TAI_KHO: 'Tại kho',
  DA_PHAN_BO: 'Đã phân bổ',
  DANG_VAN_CHUYEN: 'Đang vận chuyển',
  CHO_MUON: 'Cho mượn',
  DANG_PHUC_VU_SU_KIEN: 'Đang phục vụ sự kiện',
} satisfies Record<TrangThaiPhanBo, string>;

export const NHAN_LOAI_YEU_CAU = {
  XUAT_KHO: 'Xuất kho',
  NHAP_KHO: 'Nhập kho',
  PHAN_BO_VE_TRUONG: 'Phân bổ về trường',
  LUAN_CHUYEN_TRUONG: 'Luân chuyển trường ↔ trường',
  CHO_MUON: 'Cho mượn',
  TRA_VE_KHO: 'Trả về kho',
  BAO_HONG: 'Báo hỏng',
} satisfies Record<LoaiYeuCau, string>;

export const NHAN_TRANG_THAI_YEU_CAU = {
  BAN_NHAP: 'Nháp',
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET: 'Đã duyệt',
  TU_CHOI: 'Từ chối',
  DA_XUAT: 'Đã xuất',
  DA_HOAN_TAT: 'Đã hoàn tất',
} satisfies Record<TrangThaiYeuCau, string>;

export const NHAN_LOAI_DI_CHUYEN = {
  NHAP_BAN_DAU: 'Nhập ban đầu',
  XUAT_KHO: 'Xuất kho',
  NHAP_KHO: 'Nhập kho',
  PHAN_BO: 'Phân bổ về trường',
  LUAN_CHUYEN: 'Luân chuyển trường ↔ trường',
  CHO_MUON: 'Cho mượn',
  TRA_VE_KHO: 'Trả về kho',
  DIEU_CHINH_KIEM_KE: 'Điều chỉnh sau kiểm kê',
  XUAT_LINH_KIEN: 'Xuất linh kiện thay thế',
} satisfies Record<LoaiDiChuyen, string>;

export const NHAN_LOAI_ANH = {
  HIEN_TRANG: 'Ảnh hiện trạng',
  ANH_XUAT: 'Ảnh lúc xuất',
  ANH_NHAN: 'Ảnh lúc nhận',
  BAO_HONG: 'Ảnh báo hỏng',
  KIEM_KE: 'Ảnh kiểm kê',
  BBBG: 'Ảnh biên bản bàn giao',
  KIOSK_BACKGROUND: 'Ảnh nền màn hình kho',
  LINH_KIEN: 'Ảnh linh kiện',
  WIKI: 'Ảnh minh hoạ wiki',
} satisfies Record<LoaiAnh, string>;

// --- Thư viện wiki thiết bị -------------------------------------------------

export const NHAN_LOAI_MUC_WIKI = {
  THANH_PHAN: 'Thành phần',
  LUU_Y: 'Lưu ý',
  LOI_THUONG_GAP: 'Lỗi thường gặp',
  THONG_SO: 'Thông số kỹ thuật',
} satisfies Record<LoaiMucWiki, string>;

export const NHAN_MUC_DO_LUU_Y = {
  THONG_TIN: 'Cần biết',
  CAN_THAN: 'Cẩn thận',
  NGUY_HIEM: 'Nguy hiểm',
} satisfies Record<MucDoLuuY, string>;

export const NHAN_LOAI_TAI_LIEU_WIKI = {
  HUONG_DAN_HANG: 'Hướng dẫn của hãng',
  HUONG_DAN_NOI_BO: 'Hướng dẫn nội bộ',
  SO_DO_MACH: 'Sơ đồ mạch / bản vẽ',
  PHAN_MEM_FIRMWARE: 'Phần mềm / firmware',
  BAO_HANH: 'Bảo hành',
  DAO_TAO: 'Tài liệu đào tạo',
  KHAC: 'Khác',
} satisfies Record<LoaiTaiLieuWiki, string>;

export const NHAN_TRANG_THAI_WIKI = {
  BAN_NHAP: 'Nháp',
  DA_DANG: 'Đã đăng',
} satisfies Record<TrangThaiWiki, string>;

export const NHAN_LOAI_DICH_WIKI = {
  THIET_BI: 'Mã thiết bị',
  LOAI_TAI_SAN: 'Loại tài sản',
  DONG_GIAI_PHAP: 'Dòng giải pháp',
} satisfies Record<LoaiDichWiki, string>;

export const NHAN_ANH_NEN_KIOSK = {
  XANH_MACH_DIEN: 'Mạch điện xanh',
  XANH_CYAN: 'Xanh dương – cyan',
  DEM_KHO: 'Đêm trong kho',
  TOI_GIAN: 'Tối giản',
} satisfies Record<AnhNenKiosk, string>;

export const NHAN_TRANG_THAI_BBBG = {
  BAN_NHAP: 'Nháp',
  CHO_XAC_NHAN: 'Chờ bên nhận xác nhận',
  DA_XAC_NHAN: 'Đã xác nhận',
  TU_CHOI: 'Bên nhận từ chối',
} satisfies Record<TrangThaiBBBG, string>;

export const NHAN_TRANG_THAI_KIEM_KE = {
  BAN_NHAP: 'Nháp',
  DANG_KIEM: 'Đang kiểm',
  CHO_CHOT: 'Chờ chốt',
  DA_CHOT: 'Đã chốt',
  HUY: 'Đã huỷ',
} satisfies Record<TrangThaiKiemKe, string>;

export const NHAN_LOAI_CANH_BAO = {
  TINH_TRANG_THAY_DOI: 'Tình trạng thay đổi khi trả',
  QUA_HAN_TRA: 'Quá hạn trả',
  CHENH_LECH_KIEM_KE: 'Chênh lệch kiểm kê',
  BAO_HONG: 'Báo hỏng',
  DANG_NHAP_NGOAI_VUNG: 'Đăng nhập ngoài vùng kho',
} satisfies Record<LoaiCanhBao, string>;

export const NHAN_MUC_DO_CANH_BAO = {
  THAP: 'Thấp',
  TRUNG_BINH: 'Trung bình',
  CAO: 'Cao',
} satisfies Record<MucDoCanhBao, string>;

/** Dựng danh sách {ma, nhan} cho dropdown — giữ đúng thứ tự khai báo. */
function danhSach<T extends string>(
  ma: readonly T[],
  nhan: Record<T, string>,
): ReadonlyArray<{ ma: T; nhan: string }> {
  return ma.map((m) => ({ ma: m, nhan: nhan[m] }));
}

export const DS_VAI_TRO = danhSach(VAI_TRO, NHAN_VAI_TRO);
export const DS_ANH_NEN_KIOSK = danhSach(ANH_NEN_KIOSK, NHAN_ANH_NEN_KIOSK);
export const DS_LOAI_DIEM_LUU_TRU = danhSach(LOAI_DIEM_LUU_TRU, NHAN_LOAI_DIEM_LUU_TRU);
export const DS_KIEU_QUAN_LY = danhSach(KIEU_QUAN_LY, NHAN_KIEU_QUAN_LY);
export const DS_TINH_TRANG = danhSach(TINH_TRANG, NHAN_TINH_TRANG);
export const DS_LOAI_MUC_WIKI = danhSach(LOAI_MUC_WIKI, NHAN_LOAI_MUC_WIKI);
export const DS_MUC_DO_LUU_Y = danhSach(MUC_DO_LUU_Y, NHAN_MUC_DO_LUU_Y);
export const DS_LOAI_TAI_LIEU_WIKI = danhSach(LOAI_TAI_LIEU_WIKI, NHAN_LOAI_TAI_LIEU_WIKI);
export const DS_TRANG_THAI_WIKI = danhSach(TRANG_THAI_WIKI, NHAN_TRANG_THAI_WIKI);
export const DS_LOAI_DICH_WIKI = danhSach(LOAI_DICH_WIKI, NHAN_LOAI_DICH_WIKI);
export const DS_TRANG_THAI_PHAN_BO = danhSach(TRANG_THAI_PHAN_BO, NHAN_TRANG_THAI_PHAN_BO);
export const DS_LOAI_YEU_CAU = danhSach(LOAI_YEU_CAU, NHAN_LOAI_YEU_CAU);
export const DS_TRANG_THAI_YEU_CAU = danhSach(TRANG_THAI_YEU_CAU, NHAN_TRANG_THAI_YEU_CAU);
export const DS_LOAI_DI_CHUYEN = danhSach(LOAI_DI_CHUYEN, NHAN_LOAI_DI_CHUYEN);
export const DS_LOAI_ANH = danhSach(LOAI_ANH, NHAN_LOAI_ANH);
export const DS_TRANG_THAI_BBBG = danhSach(TRANG_THAI_BBBG, NHAN_TRANG_THAI_BBBG);
export const DS_TRANG_THAI_KIEM_KE = danhSach(TRANG_THAI_KIEM_KE, NHAN_TRANG_THAI_KIEM_KE);
export const DS_LOAI_CANH_BAO = danhSach(LOAI_CANH_BAO, NHAN_LOAI_CANH_BAO);
export const DS_MUC_DO_CANH_BAO = danhSach(MUC_DO_CANH_BAO, NHAN_MUC_DO_CANH_BAO);
