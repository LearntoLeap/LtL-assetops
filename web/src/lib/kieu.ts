/** Kiểu dữ liệu API dùng chung cho các trang. */
import type {
  AnhNenKiosk,
  KieuQuanLy,
  LoaiAnh,
  LoaiCanhBao,
  LoaiMucWiki,
  LoaiTaiLieuWiki,
  MucDoCanhBao,
  MucDoLuuY,
  TrangThaiWiki,
  TrangThaiYeuCau,
  LoaiDiChuyen,
  LoaiDiemLuuTru,
  LoaiYeuCau,
  TinhTrang,
  TrangThaiBBBG,
  TrangThaiKiemKe,
  TrangThaiPhanBo,
  VaiTro,
} from '@ltl/taisan-shared';

export interface DiaDiem {
  id: string;
  code: string;
  name: string;
  type: LoaiDiemLuuTru;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  gpsRadiusM: number | null;
  /** Khoá vị trí có đang bật cho điểm này không. */
  gpsRequired: boolean;
  isActive: boolean;
  note: string | null;
}

/**
 * Điểm lưu trữ ở dạng rút gọn — dùng cho ô chọn NƠI ĐẾN. Server trả danh sách
 * này cho mọi tài khoản đã đăng nhập nhưng chỉ gồm thông tin nhận dạng.
 */
export interface NoiDen {
  id: string;
  code: string;
  name: string;
  type: LoaiDiemLuuTru;
}

export interface HoSoQuanTri {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: VaiTro;
  department: string | null;
  locationId: string | null;
  isLocked: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  location: { id: string; code: string; name: string; type: LoaiDiemLuuTru } | null;
}

export interface BanGhiMaVuotQuyen {
  id: string;
  codePrefix: string;
  reason: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  location: { id: string; name: string } | null;
  issuedBy: { id: string; fullName: string } | null;
  issuedFor: { id: string; fullName: string } | null;
  usedBy: { id: string; fullName: string } | null;
}

export interface TrangDuLieu<T> {
  ok: true;
  muc: T[];
  tong: number;
  trang?: number;
  moiTrang?: number;
}

export interface DanhMuc {
  id: string;
  code: string;
  name: string;
  /**
   * Viết tắt dùng sinh mã thiết bị ({nguồn gốc}-{loại}-{dòng}-{số}).
   * Chỉ nguồn gốc, loại tài sản và dòng giải pháp có; mục đích sử dụng không.
   */
  vietTat?: string;
  note: string | null;
  sortOrder: number;
  isActive: boolean;
  defaultTrackingType?: KieuQuanLy;
  /** Chỉ có ở loại tài sản: loại này có bắt buộc quét mã khi xuất–nhập hay không. */
  yeuCauQuetMa?: boolean;
  _count?: { assets: number };
}

export interface ThietBi {
  id: string;
  code: string;
  name: string;
  serialNumber: string | null;
  /**
   * Nguồn gốc và mục đích KHÔNG còn là enum — chúng là hàng trong CSDL mà người
   * dùng thêm / sửa / xoá được, nên API trả nguyên cả hàng. Đừng dịch `code`
   * sang tiếng Việt ở phía web: `name` chính là cái người dùng đã đặt.
   */
  origin: { id: string; code: string; name: string };
  originNote: string | null;
  receivedDate: string | null;
  value: number | null;
  purpose: { id: string; code: string; name: string };
  trackingType: KieuQuanLy;
  condition: TinhTrang;
  allocationStatus: TrangThaiPhanBo;
  dueReturnAt: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; code: string; name: string };
  productLine: { id: string; code: string; name: string } | null;
  currentLocation: { id: string; code: string; name: string; type: LoaiDiemLuuTru } | null;
  holder: { id: string; fullName: string; email: string } | null;
}

export interface DongLichSu {
  id: string;
  type: LoaiDiChuyen;
  quantity: number;
  conditionBefore: TinhTrang | null;
  conditionAfter: TinhTrang | null;
  performedAt: string;
  note: string | null;
  fromLocation: { id: string; name: string } | null;
  toLocation: { id: string; name: string } | null;
  performedBy: { id: string; fullName: string } | null;
  request: { id: string; code: string; type: LoaiYeuCau } | null;
}

export interface ChiTietThietBi {
  ok: true;
  thietBi: ThietBi;
  tonKho: {
    tongTon: number;
    theoDiaDiem: Array<{ locationId: string; tenDiaDiem: string; ton: number }>;
  };
  lichSu: DongLichSu[];
}

export interface DongYeuCau {
  id: string;
  quantity: number;
  note: string | null;
  asset: {
    id: string;
    code: string;
    name: string;
    trackingType: KieuQuanLy;
    condition: TinhTrang;
    allocationStatus: TrangThaiPhanBo;
    currentLocation: { id: string; name: string } | null;
    /** `yeuCauQuetMa` quyết định dòng này phải quét mã hay khai tên + số lượng. */
    category: { id: string; name: string; yeuCauQuetMa: boolean };
  };
}

export interface YeuCau {
  id: string;
  code: string;
  type: LoaiYeuCau;
  status: TrangThaiYeuCau;
  reason: string;
  destinationNote: string | null;
  expectedReturnAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectionNote: string | null;
  issuedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string; email: string; role: VaiTro; department: string | null };
  approvedBy: { id: string; fullName: string } | null;
  fromLocation: { id: string; code: string; name: string; type: LoaiDiemLuuTru } | null;
  toLocation: { id: string; code: string; name: string; type: LoaiDiemLuuTru } | null;
  items: DongYeuCau[];
}

export interface CanhBao {
  id: string;
  type: LoaiCanhBao;
  severity: MucDoCanhBao;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  asset: { id: string; code: string; name: string } | null;
  request: { id: string; code: string } | null;
  resolvedBy: { id: string; fullName: string } | null;
}

export interface DongNhatKy {
  id: string;
  actorEmail: string | null;
  actorRole: VaiTro | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  photoIds: unknown;
  ip: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
  note: string | null;
  createdAt: string;
}

/* ──────────── GĐ5: biên bản bàn giao, kiểm kê, báo hỏng ──────────── */

export interface MucBienBan {
  id: string;
  /** Ảnh chụp lúc lập biên bản — KHÔNG đọc lại từ thiết bị, để làm bằng chứng. */
  assetCodeSnapshot: string;
  assetNameSnapshot: string;
  quantity: number;
  conditionSnapshot: TinhTrang;
  note: string | null;
  sortOrder: number;
  asset: { id: string; currentLocationId: string | null };
}

export interface BienBan {
  id: string;
  code: string;
  status: TrangThaiBBBG;
  giverName: string;
  giverTitle: string | null;
  giverOrg: string;
  receiverOrg: string;
  receiverName: string;
  receiverTitle: string | null;
  receiverPhone: string | null;
  issuedDate: string | null;
  commitment: string | null;
  note: string | null;
  rejectionNote: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; fullName: string; email: string };
  confirmedBy: { id: string; fullName: string } | null;
  receiverLocation: { id: string; code: string; name: string; type: LoaiDiemLuuTru } | null;
  request: { id: string; code: string; type: LoaiYeuCau; status: TrangThaiYeuCau; reason: string } | null;
  items: MucBienBan[];
}

export interface PhieuKiemKe {
  id: string;
  code: string;
  name: string;
  status: TrangThaiKiemKe;
  startedAt: string | null;
  closedAt: string | null;
  note: string | null;
  createdAt: string;
  location: { id: string; code: string; name: string; type: LoaiDiemLuuTru };
  createdBy: { id: string; fullName: string } | null;
  closedBy: { id: string; fullName: string } | null;
  items: Array<{
    id: string;
    systemQuantity: number;
    systemCondition: TinhTrang;
    countedQuantity: number | null;
    countedCondition: TinhTrang | null;
    countedAt: string | null;
    adjustedAt: string | null;
    note: string | null;
    countedBy: { id: string; fullName: string } | null;
    asset: {
      id: string;
      code: string;
      name: string;
      trackingType: KieuQuanLy;
      category: { name: string };
    };
    photos: Array<{ id: string; kind: LoaiAnh }>;
  }>;
}

/** Dòng báo cáo kiểm kê — server tính chênh lệch khi đọc, không lưu cột. */
export interface DongBaoCaoKiemKe {
  id: string;
  code: string;
  name: string;
  loai: string;
  heThong: number;
  thucDem: number | null;
  chenhLech: number | null;
  tinhTrangHeThong: TinhTrang;
  tinhTrangThucTe: TinhTrang | null;
  doiTinhTrang: boolean;
  daDem: boolean;
  soAnh: number;
  note: string | null;
  nguoiDem: string | null;
}

export interface TongHopKiemKe {
  tongDong: number;
  daDem: number;
  chuaDem: number;
  soChenhLech: number;
  thieu: number;
  thua: number;
  doiTinhTrang: number;
}

export interface BaoCaoKiemKe {
  dong: DongBaoCaoKiemKe[];
  tongHop: TongHopKiemKe;
}

/** Phiếu báo hỏng dùng lại bảng yêu cầu với type = BAO_HONG. */
export interface PhieuBaoHong {
  id: string;
  code: string;
  status: TrangThaiYeuCau;
  reason: string;
  createdAt: string;
  completedAt: string | null;
  rejectionNote: string | null;
  createdBy: { id: string; fullName: string; email: string; role: VaiTro };
  approvedBy: { id: string; fullName: string } | null;
  items: Array<{
    asset: {
      id: string;
      code: string;
      name: string;
      condition: TinhTrang;
      currentLocation: { id: string; name: string } | null;
    };
  }>;
  photos: Array<{ id: string; kind: LoaiAnh; createdAt: string }>;
}

/* ──────────── Linh kiện thay thế ──────────── */

/** Một phiếu lấy linh kiện ra khỏi kho, luôn gắn với một phiếu báo hỏng. */
export interface PhieuLinhKien {
  id: string;
  code: string;
  quantity: number;
  /** Tên tự nhập — chỉ có với linh kiện không có mã trong kho. */
  partName: string | null;
  /** Mã của hãng cung cấp — chỉ có với linh kiện không có mã trong kho. */
  vendorCode: string | null;
  note: string | null;
  issuedAt: string;
  /** Null = linh kiện không có mã trong kho. */
  asset: { id: string; code: string; name: string } | null;
  reason: { id: string; name: string };
  fromLocation: { id: string; name: string } | null;
  issuedBy: { id: string; fullName: string; email: string };
  request: {
    id: string;
    code: string;
    status: TrangThaiYeuCau;
    items: Array<{
      asset: {
        id: string;
        code: string;
        name: string;
        currentLocation: { id: string; name: string } | null;
      };
    }>;
  };
  photos: Array<{ id: string; kind: LoaiAnh }>;
}

/* ──────────── Lịch sử sửa chữa theo điểm ──────────── */

/** Một dòng trong bảng tổng hợp lịch sử sửa chữa. */
export interface DongLichSuDiem {
  diaDiemId: string;
  ten: string;
  loai: string;
  soBaoHong: number;
  soBaoHongDangMo: number;
  soPhieuLinhKien: number;
  /** Tổng số linh kiện đã thay — cộng số lượng, không phải số phiếu. */
  tongLinhKien: number;
  lanCuoi: string | null;
}

/** Một mốc trong dòng thời gian của một điểm. */
export interface MocLichSu {
  loai: 'BAO_HONG' | 'LINH_KIEN';
  id: string;
  code: string;
  luc: string;
  maThietBi: string;
  tenThietBi: string;
  noiDung: string;
  lyDo: string | null;
  soLuong: number | null;
  nguoi: string;
  trangThai: string | null;
  soAnh: number;
}

/* ──────────── GĐ6: dashboard, kiosk, màn hình tablet ──────────── */

export interface SoLieuNhanh {
  soMa: number;
  donViTaiKho: number;
  donViOTruong: number;
  maChoMuon: number;
  maQuaHan: number;
  maHong: number;
  maCanBaoTri: number;
  yeuCauChoDuyet: number;
  yeuCauChoXuat: number;
  bienBanChoXacNhan: number;
}

export interface DongDem {
  ma: string;
  nhan: string;
  so: number;
}

export interface DongRaVao {
  ngay: string;
  vao: number;
  ra: number;
}

export interface DuLieuDashboard {
  ok: true;
  soLieu: SoLieuNhanh;
  theoLoai: DongDem[];
  theoDongGiaiPhap: DongDem[];
  theoDiaDiem: DongDem[];
  raVao: DongRaVao[];
  quaHan: Array<{
    id: string;
    code: string;
    name: string;
    dueReturnAt: string;
    soNgayQuaHan: number;
    noiDat: string | null;
    nguoiGiu: string | null;
  }>;
  thietBiHong: Array<{
    id: string;
    code: string;
    name: string;
    condition: TinhTrang;
    noiDat: string | null;
  }>;
  kiemKeGanNhat: {
    id: string;
    code: string;
    name: string;
    diaDiem: string;
    closedAt: string | null;
    soMaLech: number;
    tongThieu: number;
    tongThua: number;
  } | null;
}

/** Số liệu trang "Tổng thể" — cả guồng vận hành, không chỉ tài sản. */
export interface DuLieuTongThe {
  ok: true;
  soNgay: number;
  tuNgay: string;
  soLieu: SoLieuNhanh;
  /** Theo ĐÚNG thứ tự quy trình — đừng sắp lại theo giá trị. */
  yeuCauTheoBuoc: DongDem[];
  yeuCauTheoLoai: DongDem[];
  yeuCauBiTuChoi: number;
  gioDuyetTrungBinh: number | null;
  baoHong: {
    dangMo: number;
    moTrongKy: number;
    dongTrongKy: number;
    gioXuLyTrungBinh: number | null;
  };
  baoHongTheoNgay: Array<{ ngay: string; moMoi: number; daDong: number }>;
  linhKien: {
    soPhieu: number;
    tongLinhKien: number;
    soPhieuKhongMa: number;
    theoLyDo: DongDem[];
  };
  diemCanDeMat: Array<{
    diaDiemId: string;
    ten: string;
    loai: string;
    soBaoHong: number;
    soBaoHongDangMo: number;
    soPhieuLinhKien: number;
    tongLinhKien: number;
    lanCuoi: string | null;
  }>;
  dangCho: {
    yeuCauChoDuyet: number;
    yeuCauChoXuat: number;
    bienBanChoXacNhan: number;
    kiemKeDangMo: number;
    baoHongDangMo: number;
    thietBiQuaHan: number;
  };
}

// --- Thư viện wiki thiết bị -------------------------------------------------

export interface DichWiki {
  id: string;
  asset: { id: string; code: string; name: string } | null;
  category: { id: string; name: string } | null;
  productLine: { id: string; name: string } | null;
}

export interface MucWiki {
  id: string;
  loai: LoaiMucWiki;
  tieuDe: string;
  noiDung: string | null;
  soLuong: number | null;
  donVi: string | null;
  mucDo: MucDoLuuY | null;
  assetId: string | null;
  thuTu: number;
  asset: { id: string; code: string; name: string; isActive: boolean } | null;
}

export interface TaiLieuWiki {
  id: string;
  loai: LoaiTaiLieuWiki;
  tieuDe: string;
  moTa: string | null;
  fileName: string | null;
  mimeType: string | null;
  byteSize: number | null;
  lienKetNgoai: string | null;
  thuTu: number;
  createdAt: string;
  uploadedBy: { fullName: string } | null;
}

/** Dòng rút gọn ở trang thư viện và ở các khối gợi ý. */
export interface BaiWikiTomTat {
  id: string;
  slug: string;
  tieuDe: string;
  tomTat: string | null;
  status: TrangThaiWiki;
  updatedAt: string;
  coverPhotoId: string | null;
  updatedBy: { fullName: string } | null;
  _count: { docs: number; links: number; items: number };
}

export interface BaiWiki {
  id: string;
  slug: string;
  tieuDe: string;
  tomTat: string | null;
  moTa: string | null;
  huongDan: string | null;
  status: TrangThaiWiki;
  coverPhotoId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { fullName: string } | null;
  updatedBy: { fullName: string } | null;
  links: DichWiki[];
  items: MucWiki[];
  docs: TaiLieuWiki[];
  _count: { revisions: number };
}

export interface ChiTietBaiWiki {
  ok: true;
  bai: BaiWiki;
  /** Bài này đang áp dụng cho bao nhiêu mã thiết bị. */
  soMa: number;
}

export interface WikiTheoThietBi {
  ok: true;
  thietBi: { id: string; code: string; name: string };
  rieng: BaiWikiTomTat[];
  theoDong: BaiWikiTomTat[];
  theoLoai: BaiWikiTomTat[];
  chung: BaiWikiTomTat[];
  canhBao: Array<{
    id: string;
    tieuDe: string;
    mucDo: MucDoLuuY;
    article: { slug: string; tieuDe: string };
  }>;
}

export interface PhienBanWiki {
  id: string;
  phienBan: number;
  lyDo: string | null;
  createdAt: string;
  anhChup: unknown;
  suaBoi: { fullName: string } | null;
}

export interface CaiDatKiosk {
  backgroundKey: AnhNenKiosk | null;
  backgroundPhotoId: string | null;
  updatedAt: string | null;
}

export interface ViecChoXuLy {
  ok: true;
  yeuCau: Array<{
    id: string;
    code: string;
    type: LoaiYeuCau;
    status: TrangThaiYeuCau;
    createdAt: string;
    createdBy: { fullName: string };
    toLocation: { name: string } | null;
    _count: { items: number };
  }>;
  bienBan: Array<{
    id: string;
    code: string;
    createdAt: string;
    receiverOrg: string;
    receiverLocation: { name: string } | null;
    _count: { items: number };
  }>;
}

/** Thiết bị nhóm "Cố định tại kho" cho màn hình tablet, kèm lần mượn gần nhất. */
export interface TabletTaiKho {
  id: string;
  code: string;
  name: string;
  serialNumber: string | null;
  condition: TinhTrang;
  allocationStatus: TrangThaiPhanBo;
  dueReturnAt: string | null;
  category: { name: string };
  currentLocation: { id: string; name: string } | null;
  holder: { id: string; fullName: string; department: string | null } | null;
  movements: Array<{
    id: string;
    type: LoaiDiChuyen;
    performedAt: string;
    note: string | null;
    performedBy: { fullName: string } | null;
    request: { id: string; code: string; createdBy: { fullName: string } } | null;
  }>;
}
