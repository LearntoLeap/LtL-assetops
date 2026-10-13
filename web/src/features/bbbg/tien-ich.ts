import type { TrangThaiBBBG, TrangThaiKiemKe } from '@ltl/taisan-shared';
import type { BadgeProps } from '@/components/ui/badge';

type MauBadge = NonNullable<BadgeProps['variant']>;

export const MAU_TRANG_THAI_BBBG: Record<TrangThaiBBBG, MauBadge> = {
  BAN_NHAP: 'muted',
  CHO_XAC_NHAN: 'warning',
  DA_XAC_NHAN: 'success',
  TU_CHOI: 'destructive',
  // Tự lập (máy điền, chưa ai sửa) và Đã chỉnh sửa phải khác màu nhau — nhìn
  // danh sách là biết tờ nào còn nguyên nội dung máy điền.
  TU_LAP: 'accent',
  DA_CHINH_SUA: 'default',
};

export const MAU_TRANG_THAI_KIEM_KE: Record<TrangThaiKiemKe, MauBadge> = {
  BAN_NHAP: 'muted',
  DANG_KIEM: 'accent',
  CHO_CHOT: 'warning',
  DA_CHOT: 'success',
  HUY: 'destructive',
};

/**
 * Loại yêu cầu bàn giao về trường — chỉ hai loại này mới chờ Quản trị / Vận hành
 * xác nhận bàn giao rồi mới đổi vị trí thiết bị (luồng C).
 */
export const LOAI_CAN_BBBG = new Set(['PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG']);
