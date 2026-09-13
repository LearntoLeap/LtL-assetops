/** Kiểu dữ liệu API dùng chung cho các trang. */
import type {
  KieuQuanLy,
  LoaiAnh,
  LoaiCanhBao,
  MucDoCanhBao,
  TrangThaiYeuCau,
  LoaiDiChuyen,
  LoaiDiemLuuTru,
  LoaiYeuCau,
  MucDichSuDung,
  NguonGoc,
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
  note: string | null;
  sortOrder: number;
  isActive: boolean;
  defaultTrackingType?: KieuQuanLy;
  _count?: { assets: number };
}

export interface ThietBi {
  id: string;
  code: string;
  name: string;
  serialNumber: string | null;
  origin: NguonGoc;
  originNote: string | null;
  receivedDate: string | null;
  value: number | null;
  purpose: MucDichSuDung;
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
