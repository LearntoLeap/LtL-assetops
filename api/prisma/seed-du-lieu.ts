/**
 * Dữ liệu mẫu cho lệnh seed — tách riêng để dễ đọc và dễ sửa.
 * Mọi tên/ghi chú đều là dữ liệu MẪU, sửa lại theo thực tế trước khi dùng thật.
 */
import type { $Enums } from '@prisma/client';

export interface DongDiemLuuTru {
  code: string;
  name: string;
  type: $Enums.LocationType;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
  gpsRadiusM?: number;
  /** Bỏ trống = TẮT khoá vị trí (mặc định của cột trong CSDL). */
  gpsRequired?: boolean;
  note?: string;
}

export interface DongTaiSan {
  code: string;
  name: string;
  categoryCode: string;
  productLineCode?: string;
  serialNumber?: string;
  /** MÃ nguồn gốc (hàng trong `asset_origins`), không còn là enum. */
  origin: string;
  originNote?: string;
  receivedDate: string;
  value?: number;
  /** MÃ mục đích sử dụng (hàng trong `asset_purposes`). */
  purpose: string;
  trackingType: $Enums.TrackingType;
  condition: $Enums.AssetCondition;
  allocationStatus: $Enums.AllocationStatus;
  /** Số lượng lúc nhập ban đầu (tài sản DON_VI luôn 1). */
  soLuongNhap: number;
  /** Mã điểm lưu trữ nhận hàng lúc nhập ban đầu. */
  nhapVe: string;
  /**
   * Điều chuyển sau khi nhập: chuyển bao nhiêu, về đâu, theo loại di chuyển nào.
   * Tồn kho suy ra từ đây, KHÔNG lưu số tồn.
   */
  dieuChuyen?: Array<{
    den: string;
    soLuong: number;
    loai: $Enums.MovementType;
    ghiChu?: string;
  }>;
  /** Email tài khoản đang giữ (thiết bị cho nhân sự mượn). */
  nguoiGiuEmail?: string;
  /** Hạn trả (ISO) — dùng cho cảnh báo quá hạn. */
  hanTra?: string;
  note?: string;
}

// --- Dòng giải pháp -------------------------------------------------------
/**
 * NGUỒN GỐC và MỤC ĐÍCH SỬ DỤNG nạp ban đầu.
 *
 * Đây là điểm bắt đầu, KHÔNG phải danh sách cố định: người dùng thêm / sửa tên /
 * xoá thoải mái trong Danh mục. Seed chỉ upsert theo mã nên chạy lại không ghi
 * đè những mục họ tự thêm; nhưng có ghi đè TÊN của bốn mục này — muốn đổi tên
 * vĩnh viễn thì sửa luôn ở đây.
 */
export const NGUON_GOC_BAN_DAU = [
  { code: 'NHAP_TU_IPP', name: 'Nhập từ IPP', sortOrder: 10, vietTat: 'IPP' },
  { code: 'LTL_MUA', name: 'LtL mua', sortOrder: 20, vietTat: 'MUA' },
  { code: 'LTL_MUON_DOI_TAC', name: 'LtL mượn của đối tác', sortOrder: 30, vietTat: 'MUON' },
  { code: 'KHAC', name: 'Khác', sortOrder: 40, vietTat: 'KHAC' },
] as const;

export const MUC_DICH_BAN_DAU = [
  { code: 'XHH', name: 'XHH', sortOrder: 10 },
  { code: 'SU_KIEN', name: 'Sự kiện', sortOrder: 20 },
  { code: 'CO_DINH_TAI_KHO', name: 'Cố định tại kho', sortOrder: 30 },
  { code: 'CHO_MUON', name: 'Cho mượn', sortOrder: 40 },
] as const;

export const DONG_GIAI_PHAP = [
  { code: 'UKIT', name: 'uKit', sortOrder: 10, vietTat: 'UKIT' },
  { code: 'UGOT', name: 'UGOT', sortOrder: 20, vietTat: 'UGOT' },
  { code: 'STICKEM', name: "Stick'Em", sortOrder: 30, vietTat: 'STK' },
  { code: 'ALPHA_MINI', name: 'Alpha Mini', sortOrder: 40, vietTat: 'AM' },
  { code: 'YANSHEE', name: 'Yanshee', sortOrder: 50, vietTat: 'YS' },
  { code: 'WEEEMAKE', name: 'Weeemake', sortOrder: 60, vietTat: 'WM' },
  { code: 'KHAC', name: 'Dòng khác', sortOrder: 999, vietTat: 'DKHAC' },
] as const;

// --- Loại tài sản ---------------------------------------------------------
export const LOAI_TAI_SAN: ReadonlyArray<{
  code: string;
  name: string;
  vietTat: string;
  defaultTrackingType: $Enums.TrackingType;
  sortOrder: number;
}> = [
  { code: 'ROBOT', name: 'Robot', defaultTrackingType: 'DON_VI', sortOrder: 10, vietTat: 'RB' },
  { code: 'MAY_TINH', name: 'Máy tính/Laptop', defaultTrackingType: 'DON_VI', sortOrder: 20, vietTat: 'PC' },
  { code: 'TABLET', name: 'Tablet', defaultTrackingType: 'DON_VI', sortOrder: 30, vietTat: 'TB' },
  { code: 'KINH_VR', name: 'Kính VR', defaultTrackingType: 'DON_VI', sortOrder: 40, vietTat: 'VR' },
  { code: 'SA_BAN', name: 'Sa bàn', defaultTrackingType: 'DON_VI', sortOrder: 50, vietTat: 'SB' },
  { code: 'AN_PHAM_IN', name: 'Ấn phẩm in', defaultTrackingType: 'SO_LUONG', sortOrder: 60, vietTat: 'AP' },
  { code: 'PHU_KIEN', name: 'Phụ kiện', defaultTrackingType: 'SO_LUONG', sortOrder: 70, vietTat: 'PK' },
  { code: 'KHAC', name: 'Khác', defaultTrackingType: 'DON_VI', sortOrder: 999, vietTat: 'KH' },
];

// --- Điểm lưu trữ ---------------------------------------------------------
/** Toạ độ dưới đây là MẪU — ADMIN phải cấu hình lại theo kho thật. */
export const DIEM_LUU_TRU: ReadonlyArray<DongDiemLuuTru> = [
  {
    code: 'KHO-VP',
    name: 'Kho văn phòng Learn to Leap',
    type: 'KHO_VAN_PHONG',
    address: 'Toà nhà văn phòng, Quận Thanh Xuân, Hà Nội',
    contactName: 'Bộ phận Kho',
    contactPhone: '0900000000',
    latitude: 21.0012345,
    longitude: 105.8123456,
    gpsRadiusM: 150,
    // Kho văn phòng nằm ngay trụ sở, người ra vào đã kiểm soát bằng cửa, nên
    // khoá GPS ở đây chỉ gây vướng vì GPS trong nhà hay lệch. Vẫn giữ toạ độ
    // để nhật ký ghi được máy đăng nhập cách kho bao xa.
    gpsRequired: false,
    note: 'Toạ độ và bán kính là dữ liệu MẪU — ADMIN cấu hình lại trước khi dùng thật. Khoá vị trí đang TẮT cho kho này.',
  },
  {
    code: 'TRUONG-MINHKHAI',
    name: 'Trường Tiểu học Minh Khai',
    type: 'DIEM_TRUONG',
    address: 'Quận Hoàng Mai, Hà Nội',
    contactName: 'Cô Nguyễn Thị Lan',
    contactPhone: '0911000001',
  },
  {
    code: 'TRUONG-QUANGTRUNG',
    name: 'Trường THCS Quang Trung',
    type: 'DIEM_TRUONG',
    address: 'Quận Cầu Giấy, Hà Nội',
    contactName: 'Thầy Trần Văn Hùng',
    contactPhone: '0911000002',
  },
  {
    code: 'TRUONG-SAOMAI',
    name: 'Trường Liên cấp Sao Mai',
    type: 'DIEM_TRUONG',
    address: 'Quận Hà Đông, Hà Nội',
    contactName: 'Cô Phạm Thu Hà',
    contactPhone: '0911000003',
  },
  {
    code: 'DOITAC-ADC',
    name: 'Đối tác ADC Việt Nam',
    type: 'DOI_TAC_MUON',
    address: 'Hà Nội',
    contactName: 'Anh Lê Minh Đức',
    contactPhone: '0911000004',
  },
  {
    code: 'KHO-SUKIEN',
    name: 'Kho sự kiện ROBOG',
    type: 'KHO_SU_KIEN',
    address: 'Nhà thi đấu, Hà Nội',
    contactName: 'Bộ phận Event',
    contactPhone: '0911000005',
  },
];

// --- 30 thiết bị mẫu ------------------------------------------------------
/**
 * Bao trùm cả 8 loại tài sản, cả 7 dòng giải pháp, cả 2 kiểu quản lý
 * (DON_VI / SO_LUONG), đủ 6 tình trạng và đủ 5 trạng thái phân bổ.
 *
 * Quy ước dữ liệu mẫu:
 *   - Mọi thiết bị đều có movement NHAP_BAN_DAU (từ ngoài hệ thống → kho),
 *     nên tồn kho luôn suy ra được từ bảng movements.
 *   - Thiết bị cho NHÂN SỰ mượn giữ nguyên `currentLocation` = kho quản lý,
 *     chỉ đổi `allocationStatus` = CHO_MUON và gắn người giữ: về sở hữu nó
 *     vẫn thuộc kho. Cho ĐỐI TÁC mượn thì có movement sang điểm đối tác.
 *   - Thiết bị DANG_VAN_CHUYEN chưa đổi vị trí: theo luồng C, trường nhận
 *     phải xác nhận trên app thì movement mới được ghi.
 */
export const TAI_SAN: ReadonlyArray<DongTaiSan> = [
  // ----- Robot (10) -----
  {
    code: 'LTL-RB-0001', name: 'Robot AI UGOT — bộ đầy đủ', categoryCode: 'ROBOT',
    productLineCode: 'UGOT', serialNumber: 'UGOT-24A0011', origin: 'NHAP_TU_IPP',
    receivedDate: '2025-08-12', value: 48000000, purpose: 'XHH', trackingType: 'DON_VI',
    condition: 'TOT', allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Bộ gồm: 1 thân robot, 6 cảm biến, 1 tay gắp, 1 sạc, 1 hộp đựng.',
  },
  {
    code: 'LTL-RB-0002', name: 'Robot AI UGOT — bộ đầy đủ', categoryCode: 'ROBOT',
    productLineCode: 'UGOT', serialNumber: 'UGOT-24A0012', origin: 'NHAP_TU_IPP',
    receivedDate: '2025-08-12', value: 48000000, purpose: 'XHH', trackingType: 'DON_VI',
    condition: 'DANG_SU_DUNG', allocationStatus: 'DA_PHAN_BO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'TRUONG-MINHKHAI', soLuong: 1, loai: 'PHAN_BO', ghiChu: 'Phân bổ phục vụ CLB Robotics.' }],
  },
  {
    code: 'LTL-RB-0003', name: "Bộ uKit Explore", categoryCode: 'ROBOT',
    productLineCode: 'UKIT', serialNumber: 'UKIT-23E0455', origin: 'LTL_MUA',
    receivedDate: '2025-03-05', value: 12500000, purpose: 'XHH', trackingType: 'DON_VI',
    condition: 'TOT', allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Bộ gồm: 1 hộp linh kiện, 1 bảng mạch chính, 2 servo, tài liệu hướng dẫn.',
  },
  {
    code: 'LTL-RB-0004', name: 'Bộ uKit Explore', categoryCode: 'ROBOT',
    productLineCode: 'UKIT', serialNumber: 'UKIT-23E0456', origin: 'LTL_MUA',
    receivedDate: '2025-03-05', value: 12500000, purpose: 'XHH', trackingType: 'DON_VI',
    condition: 'DANG_SU_DUNG', allocationStatus: 'DA_PHAN_BO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'TRUONG-QUANGTRUNG', soLuong: 1, loai: 'PHAN_BO' }],
  },
  {
    code: 'LTL-RB-0005', name: 'Robot Alpha Mini', categoryCode: 'ROBOT',
    productLineCode: 'ALPHA_MINI', serialNumber: 'AM-22X0098', origin: 'LTL_MUON_DOI_TAC',
    originNote: 'LtL mượn của ADC Việt Nam để demo tuyển sinh.',
    receivedDate: '2026-06-01', value: 35000000, purpose: 'SU_KIEN', trackingType: 'DON_VI',
    condition: 'TOT', allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    hanTra: '2026-12-31',
  },
  {
    code: 'LTL-RB-0006', name: 'Robot Alpha Mini', categoryCode: 'ROBOT',
    productLineCode: 'ALPHA_MINI', serialNumber: 'AM-22X0099', origin: 'NHAP_TU_IPP',
    receivedDate: '2025-05-20', value: 35000000, purpose: 'XHH', trackingType: 'DON_VI',
    condition: 'DANG_SU_DUNG', allocationStatus: 'DA_PHAN_BO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'TRUONG-MINHKHAI', soLuong: 1, loai: 'PHAN_BO' }],
  },
  {
    code: 'LTL-RB-0007', name: 'Robot Yanshee', categoryCode: 'ROBOT',
    productLineCode: 'YANSHEE', serialNumber: 'YS-21P0310', origin: 'NHAP_TU_IPP',
    receivedDate: '2024-11-02', value: 52000000, purpose: 'XHH', trackingType: 'DON_VI',
    condition: 'CAN_BAO_TRI', allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Servo khớp vai trái kêu lạ, cần kiểm tra trước khi cho mượn tiếp.',
  },
  {
    code: 'LTL-RB-0008', name: 'Bộ robot Weeemake mBot', categoryCode: 'ROBOT',
    productLineCode: 'WEEEMAKE', serialNumber: 'WM-24M0077', origin: 'LTL_MUA',
    receivedDate: '2026-01-15', value: 8900000, purpose: 'XHH', trackingType: 'DON_VI',
    condition: 'TOT', allocationStatus: 'DANG_VAN_CHUYEN', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Đang trên đường tới Trường Liên cấp Sao Mai — chờ trường xác nhận nhận bàn giao.',
  },
  {
    code: 'LTL-RB-0009', name: 'Robot AI UGOT — bộ đầy đủ', categoryCode: 'ROBOT',
    productLineCode: 'UGOT', serialNumber: 'UGOT-24A0013', origin: 'NHAP_TU_IPP',
    receivedDate: '2025-08-12', value: 48000000, purpose: 'CHO_MUON', trackingType: 'DON_VI',
    condition: 'DANG_SU_DUNG', allocationStatus: 'CHO_MUON', soLuongNhap: 1, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'DOITAC-ADC', soLuong: 1, loai: 'CHO_MUON', ghiChu: 'Cho ADC mượn trưng bày hội thảo.' }],
    hanTra: '2026-08-15',
    note: 'Dữ liệu mẫu QUÁ HẠN TRẢ — dùng để kiểm chứng cảnh báo trên dashboard.',
  },
  {
    code: 'LTL-RB-0010', name: 'Robot Yanshee', categoryCode: 'ROBOT',
    productLineCode: 'YANSHEE', serialNumber: 'YS-21P0311', origin: 'NHAP_TU_IPP',
    receivedDate: '2024-11-02', value: 52000000, purpose: 'XHH', trackingType: 'DON_VI',
    condition: 'HONG', allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Ngã trong vận chuyển, nứt vỏ ngực, không khởi động. Chờ phương án sửa.',
  },

  // ----- Máy tính/Laptop (4) -----
  {
    code: 'LTL-PC-0001', name: 'Laptop Dell Latitude 3540', categoryCode: 'MAY_TINH',
    serialNumber: 'DL3540-0021', origin: 'LTL_MUA', receivedDate: '2025-09-30',
    value: 18500000, purpose: 'XHH', trackingType: 'DON_VI', condition: 'TOT',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
  },
  {
    code: 'LTL-PC-0002', name: 'Laptop Asus Vivobook 15', categoryCode: 'MAY_TINH',
    serialNumber: 'ASV15-0044', origin: 'LTL_MUA', receivedDate: '2025-09-30',
    value: 16900000, purpose: 'CHO_MUON', trackingType: 'DON_VI', condition: 'DANG_SU_DUNG',
    allocationStatus: 'CHO_MUON', soLuongNhap: 1, nhapVe: 'KHO-VP',
    nguoiGiuEmail: 'nhansu@learntoleap.vn', hanTra: '2026-10-31',
    note: 'Nhân sự Phòng Chuyên môn mượn soạn học liệu; sở hữu vẫn thuộc kho văn phòng.',
  },
  {
    code: 'LTL-PC-0003', name: 'Laptop Lenovo ThinkBook 14', categoryCode: 'MAY_TINH',
    serialNumber: 'LTB14-0009', origin: 'NHAP_TU_IPP', receivedDate: '2025-04-18',
    value: 21000000, purpose: 'XHH', trackingType: 'DON_VI', condition: 'DANG_SU_DUNG',
    allocationStatus: 'DA_PHAN_BO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'TRUONG-QUANGTRUNG', soLuong: 1, loai: 'PHAN_BO', ghiChu: 'Máy điều khiển phòng STEM.' }],
  },
  {
    code: 'LTL-PC-0004', name: 'Máy tính để bàn màn hình kho (kiosk)', categoryCode: 'MAY_TINH',
    serialNumber: 'KIOSK-KHO-01', origin: 'LTL_MUA', receivedDate: '2026-02-01',
    value: 14500000, purpose: 'CO_DINH_TAI_KHO', trackingType: 'DON_VI', condition: 'DANG_SU_DUNG',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Máy chạy giao diện KIOSK liên tục tại kho, gắn với tài khoản vai trò KHO.',
  },

  // ----- Tablet (5) — nhóm "Cố định tại kho" có màn hình riêng -----
  {
    code: 'LTL-TB-0001', name: 'Tablet Samsung Galaxy Tab A9', categoryCode: 'TABLET',
    serialNumber: 'SMA9-1001', origin: 'LTL_MUA', receivedDate: '2026-02-10',
    value: 4300000, purpose: 'CO_DINH_TAI_KHO', trackingType: 'DON_VI', condition: 'TOT',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
  },
  {
    code: 'LTL-TB-0002', name: 'Tablet Samsung Galaxy Tab A9', categoryCode: 'TABLET',
    serialNumber: 'SMA9-1002', origin: 'LTL_MUA', receivedDate: '2026-02-10',
    value: 4300000, purpose: 'CO_DINH_TAI_KHO', trackingType: 'DON_VI', condition: 'TOT',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
  },
  {
    code: 'LTL-TB-0003', name: 'Tablet Lenovo Tab M10', categoryCode: 'TABLET',
    serialNumber: 'LNM10-2001', origin: 'LTL_MUA', receivedDate: '2026-02-10',
    value: 3900000, purpose: 'CO_DINH_TAI_KHO', trackingType: 'DON_VI', condition: 'DANG_SU_DUNG',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    nguoiGiuEmail: 'kho@learntoleap.vn',
    note: 'Tablet nhân viên kho dùng quét mã, chụp ảnh xuất/nhập.',
  },
  {
    code: 'LTL-TB-0004', name: 'Tablet Apple iPad 9', categoryCode: 'TABLET',
    serialNumber: 'IPAD9-3001', origin: 'NHAP_TU_IPP', receivedDate: '2025-07-07',
    value: 8200000, purpose: 'XHH', trackingType: 'DON_VI', condition: 'DANG_SU_DUNG',
    allocationStatus: 'DA_PHAN_BO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'TRUONG-MINHKHAI', soLuong: 1, loai: 'PHAN_BO' }],
  },
  {
    code: 'LTL-TB-0005', name: 'Tablet Lenovo Tab M10', categoryCode: 'TABLET',
    serialNumber: 'LNM10-2002', origin: 'LTL_MUA', receivedDate: '2026-02-10',
    value: 3900000, purpose: 'CO_DINH_TAI_KHO', trackingType: 'DON_VI', condition: 'DANG_BAO_HANH',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Màn hình sọc, đã gửi bảo hành hãng, dự kiến nhận lại trong tháng.',
  },

  // ----- Kính VR (2) -----
  {
    code: 'LTL-VR-0001', name: 'Kính VR Meta Quest 2 128GB', categoryCode: 'KINH_VR',
    serialNumber: 'MQ2-0501', origin: 'LTL_MUA', receivedDate: '2025-10-11',
    value: 9500000, purpose: 'SU_KIEN', trackingType: 'DON_VI', condition: 'DANG_SU_DUNG',
    allocationStatus: 'DANG_PHUC_VU_SU_KIEN', soLuongNhap: 1, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'KHO-SUKIEN', soLuong: 1, loai: 'XUAT_KHO', ghiChu: 'Phục vụ ngày hội ROBOG.' }],
  },
  {
    code: 'LTL-VR-0002', name: 'Kính VR Pico 4 128GB', categoryCode: 'KINH_VR',
    serialNumber: 'PICO4-0602', origin: 'LTL_MUA', receivedDate: '2025-10-11',
    value: 10200000, purpose: 'SU_KIEN', trackingType: 'DON_VI', condition: 'MAT',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Không tìm thấy sau sự kiện tháng 6. Đánh dấu Mất, chờ đợt kiểm kê chốt và điều chỉnh.',
  },

  // ----- Sa bàn (2) -----
  {
    code: 'LTL-SB-0001', name: 'Sa bàn Thành phố thông minh', categoryCode: 'SA_BAN',
    productLineCode: 'STICKEM', origin: 'LTL_MUA', receivedDate: '2025-12-01',
    value: 22000000, purpose: 'XHH', trackingType: 'DON_VI', condition: 'DANG_SU_DUNG',
    allocationStatus: 'DA_PHAN_BO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'TRUONG-SAOMAI', soLuong: 1, loai: 'PHAN_BO' }],
    note: 'Bộ gồm: đế sa bàn 120×80cm, 12 mô hình nhà, 1 bộ đèn LED, 1 hộp phụ kiện.',
  },
  {
    code: 'LTL-SB-0002', name: 'Sa bàn Giao thông thông minh', categoryCode: 'SA_BAN',
    productLineCode: 'STICKEM', origin: 'LTL_MUA', receivedDate: '2025-12-01',
    value: 19500000, purpose: 'XHH', trackingType: 'DON_VI', condition: 'TOT',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
  },

  // ----- Ấn phẩm in (3) — quản lý theo SỐ LƯỢNG -----
  {
    code: 'LTL-AP-0001', name: 'Sách hướng dẫn thực hành UGOT', categoryCode: 'AN_PHAM_IN',
    productLineCode: 'UGOT', origin: 'NHAP_TU_IPP', receivedDate: '2026-01-08',
    value: 65000, purpose: 'XHH', trackingType: 'SO_LUONG', condition: 'TOT',
    allocationStatus: 'TAI_KHO', soLuongNhap: 200, nhapVe: 'KHO-VP',
    note: 'Đơn vị: cuốn. Giá trị ghi theo đơn giá một cuốn.',
  },
  {
    code: 'LTL-AP-0002', name: "Vở bài tập Stick'Em lớp 3", categoryCode: 'AN_PHAM_IN',
    productLineCode: 'STICKEM', origin: 'LTL_MUA', receivedDate: '2026-01-08',
    value: 28000, purpose: 'XHH', trackingType: 'SO_LUONG', condition: 'TOT',
    allocationStatus: 'DA_PHAN_BO', soLuongNhap: 500, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'TRUONG-MINHKHAI', soLuong: 200, loai: 'PHAN_BO', ghiChu: 'Cấp cho 5 lớp khối 3.' }],
    note: 'Đơn vị: cuốn. Sau điều chuyển: kho còn 300, Minh Khai 200.',
  },
  {
    code: 'LTL-AP-0003', name: 'Poster giới thiệu chương trình STEM (A1)', categoryCode: 'AN_PHAM_IN',
    origin: 'KHAC', originNote: 'Đơn vị in tài trợ tặng tại ngày hội STEM.',
    receivedDate: '2026-03-20', value: 45000, purpose: 'SU_KIEN',
    trackingType: 'SO_LUONG', condition: 'TOT', allocationStatus: 'TAI_KHO',
    soLuongNhap: 80, nhapVe: 'KHO-VP', note: 'Đơn vị: tờ.',
  },

  // ----- Phụ kiện (3) — quản lý theo SỐ LƯỢNG -----
  {
    code: 'LTL-PK-0001', name: 'Pin sạc AA 2000mAh', categoryCode: 'PHU_KIEN',
    origin: 'LTL_MUA', receivedDate: '2026-02-14', value: 42000, purpose: 'CO_DINH_TAI_KHO',
    trackingType: 'SO_LUONG', condition: 'TOT', allocationStatus: 'TAI_KHO',
    soLuongNhap: 240, nhapVe: 'KHO-VP', note: 'Đơn vị: viên.',
  },
  {
    code: 'LTL-PK-0002', name: 'Cáp USB-C 1m', categoryCode: 'PHU_KIEN',
    origin: 'LTL_MUA', receivedDate: '2026-02-14', value: 35000, purpose: 'XHH',
    trackingType: 'SO_LUONG', condition: 'TOT', allocationStatus: 'DA_PHAN_BO',
    soLuongNhap: 120, nhapVe: 'KHO-VP',
    dieuChuyen: [{ den: 'TRUONG-QUANGTRUNG', soLuong: 20, loai: 'PHAN_BO' }],
    note: 'Đơn vị: cái. Sau điều chuyển: kho còn 100, Quang Trung 20.',
  },
  {
    code: 'LTL-PK-0003', name: 'Hộp đựng linh kiện 24 ô', categoryCode: 'PHU_KIEN',
    origin: 'LTL_MUA', receivedDate: '2025-11-25', value: 120000, purpose: 'CO_DINH_TAI_KHO',
    trackingType: 'SO_LUONG', condition: 'TOT', allocationStatus: 'TAI_KHO',
    soLuongNhap: 40, nhapVe: 'KHO-VP', note: 'Đơn vị: hộp.',
  },

  // ----- Khác (1) -----
  {
    code: 'LTL-KH-0001', name: 'Máy in nhãn QR Brother QL-820NWB', categoryCode: 'KHAC',
    serialNumber: 'BRQL-0001', origin: 'LTL_MUA', receivedDate: '2026-03-02',
    value: 7800000, purpose: 'CO_DINH_TAI_KHO', trackingType: 'DON_VI', condition: 'TOT',
    allocationStatus: 'TAI_KHO', soLuongNhap: 1, nhapVe: 'KHO-VP',
    note: 'Dùng in nhãn QR mã thiết bị tại kho.',
  },
];

// --- 5 tài khoản đủ 5 vai trò --------------------------------------------
export interface DongTaiKhoan {
  email: string;
  fullName: string;
  role: $Enums.UserRole;
  phone?: string;
  department?: string;
  /** Mã điểm lưu trữ gắn với tài khoản (KHO → kho; TRUONG → điểm trường). */
  diemLuuTru?: string;
}

/**
 * Mật khẩu KHÔNG nằm trong mã nguồn — lấy từ biến môi trường SEED_ADMIN_PASSWORD
 * (xem api/.env.example). Tài khoản email admin có thể đổi qua SEED_ADMIN_EMAIL.
 */
/**
 * Lý do thay linh kiện — mồi ban đầu cho danh mục.
 *
 * Chỉ là mồi: người ở kho thêm được lý do mới ngay tại chỗ, nên danh sách này
 * cố tình ngắn và chỉ gồm những hiện tượng gặp nhiều nhất ở robot STEM.
 */
export const LY_DO_THAY_LINH_KIEN: readonly string[] = [
  'Cháy động cơ servo',
  'Đứt dây tín hiệu',
  'Vỡ bánh răng',
  'Chai pin, không giữ điện',
  'Cảm biến không nhận tín hiệu',
  'Gãy khớp nhựa',
  'Lỏng chân cắm, tiếp xúc kém',
  'Mất phụ kiện kèm theo',
  'Hỏng bảng mạch điều khiển',
  'Nứt vỏ, hở mạch',
];

export const TAI_KHOAN: ReadonlyArray<DongTaiKhoan> = [
  {
    email: 'admin@learntoleap.vn',
    fullName: 'Quản trị hệ thống',
    role: 'ADMIN',
    phone: '0912000001',
    department: 'Ban Giám đốc',
  },
  {
    email: 'vanhanh@learntoleap.vn',
    fullName: 'Nguyễn Vận Hành',
    role: 'VAN_HANH',
    phone: '0912000002',
    department: 'Phòng Vận hành thiết bị',
  },
  {
    email: 'kho@learntoleap.vn',
    fullName: 'Máy kho văn phòng',
    role: 'KHO',
    phone: '0912000003',
    department: 'Phòng Vận hành thiết bị',
    diemLuuTru: 'KHO-VP',
  },
  {
    email: 'nhansu@learntoleap.vn',
    fullName: 'Trần Chuyên Môn',
    role: 'NHAN_SU',
    phone: '0912000004',
    department: 'Phòng Chuyên môn',
  },
  {
    email: 'truong.minhkhai@learntoleap.vn',
    fullName: 'Trường TH Minh Khai',
    role: 'TRUONG',
    phone: '0911000001',
    diemLuuTru: 'TRUONG-MINHKHAI',
  },
];
