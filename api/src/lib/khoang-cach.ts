/**
 * Khoảng cách giữa hai toạ độ theo công thức haversine (mét).
 * Dùng cho khoá đăng nhập theo vị trí của vai trò KHO — tính ở SERVER,
 * không bao giờ tin số client gửi lên.
 */
const BAN_KINH_TRAI_DAT_M = 6_371_008.8;

export interface ToaDo {
  latitude: number;
  longitude: number;
}

function radian(do_: number): number {
  return (do_ * Math.PI) / 180;
}

/** Khoảng cách giữa hai điểm, làm tròn xuống mét. */
export function khoangCachM(a: ToaDo, b: ToaDo): number {
  const dLat = radian(b.latitude - a.latitude);
  const dLon = radian(b.longitude - a.longitude);
  const lat1 = radian(a.latitude);
  const lat2 = radian(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * BAN_KINH_TRAI_DAT_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Toạ độ hợp lệ trên Trái Đất (chặn số rác trước khi tính). */
export function toaDoHopLe(toaDo: ToaDo): boolean {
  const { latitude: vd, longitude: kd } = toaDo;
  return (
    Number.isFinite(vd) &&
    Number.isFinite(kd) &&
    vd >= -90 &&
    vd <= 90 &&
    kd >= -180 &&
    kd <= 180
  );
}
