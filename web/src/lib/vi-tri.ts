/**
 * Lấy toạ độ từ trình duyệt cho tài khoản KHO.
 *
 * LƯU Ý: quyết định cho/không cho đăng nhập là của SERVER. Hàm này chỉ đi lấy
 * toạ độ; web không tự kết luận gì về việc có ở trong kho hay không.
 * navigator.geolocation chỉ hoạt động trên HTTPS (hoặc localhost).
 */
export interface ViTri {
  latitude: number;
  longitude: number;
  doChinhXacM?: number;
}

export class LoiViTri extends Error {
  readonly maLoi: string;
  constructor(thongDiep: string, maLoi: string) {
    super(thongDiep);
    this.name = 'LoiViTri';
    this.maLoi = maLoi;
  }
}

export function trinhDuyetHoTroViTri(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export async function layViTri(hetHanMs = 15_000): Promise<ViTri> {
  if (!trinhDuyetHoTroViTri()) {
    throw new LoiViTri(
      'Trình duyệt này không hỗ trợ định vị. Máy kho cần dùng trình duyệt hiện đại qua HTTPS.',
      'KHONG_HO_TRO',
    );
  }

  return new Promise<ViTri>((thanhCong, thatBai) => {
    navigator.geolocation.getCurrentPosition(
      (viTri) => {
        thanhCong({
          latitude: viTri.coords.latitude,
          longitude: viTri.coords.longitude,
          ...(Number.isFinite(viTri.coords.accuracy)
            ? { doChinhXacM: Math.round(viTri.coords.accuracy) }
            : {}),
        });
      },
      (loi) => {
        if (loi.code === loi.PERMISSION_DENIED) {
          thatBai(
            new LoiViTri(
              'Bạn đã từ chối quyền truy cập vị trí. Máy kho buộc phải cho phép định vị mới đăng nhập được.',
              'TU_CHOI_QUYEN',
            ),
          );
          return;
        }
        if (loi.code === loi.TIMEOUT) {
          thatBai(
            new LoiViTri('Quá thời gian chờ định vị. Hãy thử lại gần cửa sổ.', 'QUA_HAN'),
          );
          return;
        }
        thatBai(
          new LoiViTri(
            'Không lấy được vị trí. Kiểm tra đã bật định vị và đang dùng HTTPS.',
            'KHONG_LAY_DUOC',
          ),
        );
      },
      { enableHighAccuracy: true, timeout: hetHanMs, maximumAge: 0 },
    );
  });
}
