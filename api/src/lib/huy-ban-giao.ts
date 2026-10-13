/**
 * HUỶ BÀN GIAO phân bổ / luân chuyển — trả thiết bị về đúng trạng thái trước khi xuất.
 *
 * Lúc xuất, thiết bị (bộ, hoặc hàng lẻ xuất hết khỏi nơi gửi) bị đặt "Đang vận
 * chuyển" và gắn hạn trả của phiếu. Huỷ phiếu mà không trả lại thì thiết bị nằm
 * trong kho nhưng vẫn "Đang vận chuyển": bị loại khỏi kiểm kê, bị đếm là quá
 * hạn — đã dựng lại thật. Hàm này chạy TRONG transaction huỷ, sau khi đã khoá
 * dòng phiếu.
 */
import type { LocationType } from '@prisma/client';
import type { PrismaTx } from '../prisma.js';

const TRANG_THAI_THEO_LOAI_DIEM = {
  KHO_VAN_PHONG: 'TAI_KHO',
  KHO_SU_KIEN: 'DANG_PHUC_VU_SU_KIEN',
  DIEM_TRUONG: 'DA_PHAN_BO',
  DOI_TAC_MUON: 'CHO_MUON',
} as const satisfies Record<LocationType, string>;

export async function traTrangThaiSauHuyBanGiao(tx: PrismaTx, requestId: string): Promise<void> {
  const yc = await tx.request.findUnique({
    where: { id: requestId },
    select: {
      expectedReturnAt: true,
      fromLocation: { select: { type: true } },
      items: {
        select: {
          asset: {
            select: {
              id: true,
              allocationStatus: true,
              dueReturnAt: true,
              currentLocation: { select: { type: true } },
            },
          },
        },
      },
    },
  });
  if (!yc) return;
  for (const { asset } of yc.items) {
    if (asset.allocationStatus !== 'DANG_VAN_CHUYEN') continue;
    // Còn phiếu phân bổ / luân chuyển KHÁC đang chở chính thiết bị này thì nó vẫn
    // đang vận chuyển thật — để nguyên.
    const conPhieuKhac = await tx.requestItem.count({
      where: {
        assetId: asset.id,
        requestId: { not: requestId },
        request: {
          deletedAt: null,
          status: 'DA_XUAT',
          type: { in: ['PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG'] },
        },
      },
    });
    if (conPhieuKhac > 0) continue;
    const loai = yc.fromLocation?.type ?? asset.currentLocation?.type ?? 'KHO_VAN_PHONG';
    const hanCuaPhieu =
      yc.expectedReturnAt !== null &&
      asset.dueReturnAt !== null &&
      asset.dueReturnAt.getTime() === yc.expectedReturnAt.getTime();
    await tx.asset.update({
      where: { id: asset.id },
      data: {
        allocationStatus: TRANG_THAI_THEO_LOAI_DIEM[loai],
        // Chỉ bỏ hạn trả do CHÍNH phiếu này gắn vào.
        ...(hanCuaPhieu ? { dueReturnAt: null } : {}),
      },
    });
  }
}
