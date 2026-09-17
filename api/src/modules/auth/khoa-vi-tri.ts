/**
 * GHI NHẬT KÝ VỊ TRÍ ĐĂNG NHẬP — không còn chặn.
 *
 * Trước đây đây là chốt KHOÁ ĐĂNG NHẬP theo vị trí cho vai trò KHO: server
 * tính khoảng cách và từ chối nếu ngoài bán kính. LtL đã quyết định BỎ HẲN
 * việc xác nhận bằng GPS — lý do đo được từ thực tế: GPS trong nhà lệch
 * 50-200m mà kho nằm trong toà nhà, nên chốt này chặn oan nhân viên đứng ngay
 * trong kho nhiều hơn là chặn được người ở xa; người ra vào kho đã kiểm soát
 * bằng cửa.
 *
 * Giữ lại đúng phần CÓ ÍCH: nếu máy đăng nhập có gửi toạ độ thì ghi vào nhật
 * ký kèm khoảng cách tới kho, để sau còn truy được ai đăng nhập từ đâu. Hàm
 * này KHÔNG BAO GIỜ ném lỗi — thiếu toạ độ, thiếu kho, toạ độ sai, tất cả đều
 * chỉ là "không ghi được khoảng cách", không phải lý do từ chối đăng nhập.
 */
import { prisma } from '../../prisma.js';
import { khoangCachM, toaDoHopLe, type ToaDo } from '../../lib/khoang-cach.js';
import { ghiAuditKhongChan, type NguoiThaoTac } from '../../lib/audit.js';

export interface ThamSoGhiViTri {
  nguoiDung: NguoiThaoTac & { locationId: string | null };
  toaDo: ToaDo | null;
  boiCanh: { ip: string | null; userAgent: string | null };
}

/**
 * Ghi nhật ký vị trí đăng nhập của tài khoản kho. Trả về khoảng cách tới kho
 * (mét) nếu tính được, null nếu không — dùng cho bản ghi audit chính.
 */
export async function ghiViTriDangNhapKho(
  thamSo: ThamSoGhiViTri,
): Promise<{ khoangCachM: number | null; tenKho: string | null }> {
  const { nguoiDung, toaDo, boiCanh } = thamSo;

  if (!nguoiDung.locationId) return { khoangCachM: null, tenKho: null };

  const kho = await prisma.location.findUnique({
    where: { id: nguoiDung.locationId },
    select: { id: true, name: true, latitude: true, longitude: true },
  });
  if (!kho) return { khoangCachM: null, tenKho: null };

  const coToaDo = toaDo !== null && toaDoHopLe(toaDo);
  const cachKho =
    coToaDo && kho.latitude !== null && kho.longitude !== null
      ? khoangCachM(toaDo, { latitude: Number(kho.latitude), longitude: Number(kho.longitude) })
      : null;

  await ghiAuditKhongChan({
    actor: nguoiDung,
    action: 'auth.login.vi_tri_kho',
    entityType: 'location',
    entityId: kho.id,
    ...boiCanh,
    ...(coToaDo ? { latitude: toaDo.latitude, longitude: toaDo.longitude } : {}),
    ...(cachKho === null ? {} : { distanceM: cachKho }),
    note:
      cachKho === null
        ? `Đăng nhập kho ${kho.name} — máy không gửi toạ độ (xác nhận GPS đã bỏ).`
        : `Đăng nhập kho ${kho.name} — máy cách kho ${cachKho}m (xác nhận GPS đã bỏ).`,
  });

  return { khoangCachM: cachKho, tenKho: kho.name };
}
