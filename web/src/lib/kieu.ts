/** Kiểu dữ liệu API dùng chung cho các trang. */
import type { LoaiDiemLuuTru, VaiTro } from '@ltl/taisan-shared';

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
