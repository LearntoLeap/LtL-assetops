import type { TrangThaiYeuCau } from '@ltl/taisan-shared';
import type { BadgeProps } from '@/components/ui/badge';

type MauBadge = NonNullable<BadgeProps['variant']>;

export const MAU_TRANG_THAI: Record<TrangThaiYeuCau, MauBadge> = {
  BAN_NHAP: 'muted',
  CHO_DUYET: 'warning',
  DA_DUYET: 'default',
  TU_CHOI: 'destructive',
  DA_XUAT: 'accent',
  DA_HOAN_TAT: 'success',
};
