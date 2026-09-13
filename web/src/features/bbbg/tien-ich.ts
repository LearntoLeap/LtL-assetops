import type { TrangThaiBBBG, TrangThaiKiemKe } from '@ltl/taisan-shared';
import type { BadgeProps } from '@/components/ui/badge';

type MauBadge = NonNullable<BadgeProps['variant']>;

export const MAU_TRANG_THAI_BBBG: Record<TrangThaiBBBG, MauBadge> = {
  BAN_NHAP: 'muted',
  CHO_XAC_NHAN: 'warning',
  DA_XAC_NHAN: 'success',
  TU_CHOI: 'destructive',
};

export const MAU_TRANG_THAI_KIEM_KE: Record<TrangThaiKiemKe, MauBadge> = {
  BAN_NHAP: 'muted',
  DANG_KIEM: 'accent',
  CHO_CHOT: 'warning',
  DA_CHOT: 'success',
  HUY: 'destructive',
};

/**
 * Loại yêu cầu bàn giao về trường — chỉ hai loại này mới chờ bên nhận xác nhận
 * rồi mới đổi vị trí thiết bị (luồng C).
 */
export const LOAI_CAN_BBBG = new Set(['PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG']);
