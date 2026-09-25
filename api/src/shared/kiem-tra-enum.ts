/**
 * Chốt cửa biên dịch: enum trong prisma/schema.prisma và tập giá trị trong
 * @ltl/taisan-shared phải TRÙNG KHỚP HAI CHIỀU.
 *
 * Thêm/bớt/đổi tên một giá trị ở một bên mà quên bên kia ⇒ `npm run build`
 * của api báo lỗi ngay, không để lệch âm thầm xuống tới lúc chạy. Thông báo
 * lỗi TS2344 nêu thẳng giá trị đang lệch và dòng nào bị lệch.
 *
 * File này chỉ chứa khai báo kiểu, không sinh mã lúc chạy.
 */
import type { $Enums } from '@prisma/client';
import type {
  KieuQuanLy,
  LoaiAnh,
  LoaiCanhBao,
  LoaiDiChuyen,
  LoaiDiemLuuTru,
  LoaiYeuCau,
  MucDoCanhBao,
  TinhTrang,
  TrangThaiBBBG,
  TrangThaiKiemKe,
  TrangThaiPhanBo,
  TrangThaiYeuCau,
  VaiTro,
} from '@ltl/taisan-shared';

/**
 * Chỉ nhận `never`. Truyền vào một union khác rỗng ⇒ lỗi TS2344 nêu đúng
 * những giá trị đang thừa/thiếu.
 */
type PhaiRong<_T extends never> = true;

/** Prisma có mà shared thiếu (cột trái) — shared có mà Prisma thiếu (cột phải). */
export type DanhSachKiemTraEnum = [
  // UserRole ↔ VaiTro
  PhaiRong<Exclude<$Enums.UserRole, VaiTro>>,
  PhaiRong<Exclude<VaiTro, $Enums.UserRole>>,
  // LocationType ↔ LoaiDiemLuuTru
  PhaiRong<Exclude<$Enums.LocationType, LoaiDiemLuuTru>>,
  PhaiRong<Exclude<LoaiDiemLuuTru, $Enums.LocationType>>,
  // TrackingType ↔ KieuQuanLy
  PhaiRong<Exclude<$Enums.TrackingType, KieuQuanLy>>,
  PhaiRong<Exclude<KieuQuanLy, $Enums.TrackingType>>,
  // Nguồn gốc và mục đích sử dụng KHÔNG có ở đây nữa: từ 25/09/2026 chúng là
  // bảng tra cứu (`asset_origins`, `asset_purposes`) chứ không còn là enum, nên
  // không có hai danh sách cố định nào để đối chiếu.
  // AssetCondition ↔ TinhTrang
  PhaiRong<Exclude<$Enums.AssetCondition, TinhTrang>>,
  PhaiRong<Exclude<TinhTrang, $Enums.AssetCondition>>,
  // AllocationStatus ↔ TrangThaiPhanBo
  PhaiRong<Exclude<$Enums.AllocationStatus, TrangThaiPhanBo>>,
  PhaiRong<Exclude<TrangThaiPhanBo, $Enums.AllocationStatus>>,
  // RequestType ↔ LoaiYeuCau
  PhaiRong<Exclude<$Enums.RequestType, LoaiYeuCau>>,
  PhaiRong<Exclude<LoaiYeuCau, $Enums.RequestType>>,
  // RequestStatus ↔ TrangThaiYeuCau
  PhaiRong<Exclude<$Enums.RequestStatus, TrangThaiYeuCau>>,
  PhaiRong<Exclude<TrangThaiYeuCau, $Enums.RequestStatus>>,
  // MovementType ↔ LoaiDiChuyen
  PhaiRong<Exclude<$Enums.MovementType, LoaiDiChuyen>>,
  PhaiRong<Exclude<LoaiDiChuyen, $Enums.MovementType>>,
  // PhotoKind ↔ LoaiAnh
  PhaiRong<Exclude<$Enums.PhotoKind, LoaiAnh>>,
  PhaiRong<Exclude<LoaiAnh, $Enums.PhotoKind>>,
  // HandoverStatus ↔ TrangThaiBBBG
  PhaiRong<Exclude<$Enums.HandoverStatus, TrangThaiBBBG>>,
  PhaiRong<Exclude<TrangThaiBBBG, $Enums.HandoverStatus>>,
  // InventoryCountStatus ↔ TrangThaiKiemKe
  PhaiRong<Exclude<$Enums.InventoryCountStatus, TrangThaiKiemKe>>,
  PhaiRong<Exclude<TrangThaiKiemKe, $Enums.InventoryCountStatus>>,
  // AlertType ↔ LoaiCanhBao
  PhaiRong<Exclude<$Enums.AlertType, LoaiCanhBao>>,
  PhaiRong<Exclude<LoaiCanhBao, $Enums.AlertType>>,
  // AlertSeverity ↔ MucDoCanhBao
  PhaiRong<Exclude<$Enums.AlertSeverity, MucDoCanhBao>>,
  PhaiRong<Exclude<MucDoCanhBao, $Enums.AlertSeverity>>,
];

/** Đánh dấu đã đối chiếu xong. File nằm trong `include` của tsconfig nên luôn được biên dịch. */
export const ENUM_DA_DOI_CHIEU = true;
