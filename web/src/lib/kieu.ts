/** Kiểu dữ liệu API dùng chung cho các trang. */
import type {
  KieuQuanLy,
  LoaiCanhBao,
  MucDoCanhBao,
  TrangThaiYeuCau,
  LoaiDiChuyen,
  LoaiDiemLuuTru,
  LoaiYeuCau,
  MucDichSuDung,
  NguonGoc,
  TinhTrang,
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
