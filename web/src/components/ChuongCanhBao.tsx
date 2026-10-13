import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { goiApi } from '@/lib/api';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';

/**
 * CHUÔNG CẢNH BÁO cho quản trị / vận hành.
 *
 * Bỏ bước duyệt thì quản trị không còn "đi qua" từng phiếu nữa — cần một chỗ
 * nhìn là biết có người vừa tự xuất / nhập kho. Con số là cảnh báo đang mở; bấm
 * vào mở Nhật ký, ưu tiên lọc đúng loại xuất / nhập trực tiếp khi có.
 *
 * API cũ chưa có `/canh-bao/dem` thì chuông chỉ hiện biểu tượng, không số —
 * không làm hỏng thanh đầu trang.
 */
export function ChuongCanhBao() {
  const [dem, datDem] = useState<{ chuaXuLy: number; xuatNhapTrucTiep: number } | null>(null);

  const tai = useCallback(async () => {
    try {
      const kq = await goiApi<{ ok: true; chuaXuLy: number; xuatNhapTrucTiep: number }>(
        '/api/nhat-ky/canh-bao/dem',
      );
      datDem({ chuaXuLy: kq.chuaXuLy, xuatNhapTrucTiep: kq.xuatNhapTrucTiep });
    } catch {
      datDem(null);
    }
  }, []);

  useEffect(() => {
    void tai();
    // Dự phòng khi mất kết nối realtime: tự nạp lại mỗi 2 phút.
    const hen = setInterval(() => void tai(), 120_000);
    return () => clearInterval(hen);
  }, [tai]);
  useRealtime([SU_KIEN.CANH_BAO_MOI, SU_KIEN.KHO_DOI], () => void tai());

  const so = dem?.chuaXuLy ?? 0;
  const duongDan =
    dem && dem.xuatNhapTrucTiep > 0 ? '/nhat-ky?loai=XUAT_NHAP_TRUC_TIEP' : '/nhat-ky';
  const nhan =
    so > 0
      ? `${so} cảnh báo đang mở${dem && dem.xuatNhapTrucTiep > 0 ? `, ${dem.xuatNhapTrucTiep} lần xuất / nhập kho không qua duyệt` : ''}`
      : 'Không có cảnh báo đang mở';

  return (
    <Button variant="outline" size="icon" asChild title={nhan} className="relative">
      <Link to={duongDan} aria-label={nhan}>
        <Bell aria-hidden />
        {so > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-semibold leading-5 text-destructive-foreground tabular-nums">
            {so > 99 ? '99+' : so}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
