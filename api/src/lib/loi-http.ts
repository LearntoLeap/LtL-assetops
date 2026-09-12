/** Lỗi có mã HTTP kèm theo — tầng service ném ra, middleware dịch thành phản hồi. */
export class LoiHttp extends Error {
  readonly maHttp: number;
  readonly maLoi: string;
  readonly chiTiet: Record<string, unknown> | undefined;

  constructor(
    maHttp: number,
    thongDiep: string,
    maLoi = 'LOI_CHUNG',
    chiTiet?: Record<string, unknown>,
  ) {
    super(thongDiep);
    this.name = 'LoiHttp';
    this.maHttp = maHttp;
    this.maLoi = maLoi;
    this.chiTiet = chiTiet;
  }
}

export const loi400 = (thongDiep: string, maLoi = 'DU_LIEU_KHONG_HOP_LE', chiTiet?: Record<string, unknown>) =>
  new LoiHttp(400, thongDiep, maLoi, chiTiet);

export const loi401 = (thongDiep = 'Chưa đăng nhập hoặc phiên đã hết hạn.') =>
  new LoiHttp(401, thongDiep, 'CHUA_XAC_THUC');

export const loi403 = (thongDiep = 'Bạn không có quyền thực hiện thao tác này.') =>
  new LoiHttp(403, thongDiep, 'KHONG_DU_QUYEN');

export const loi404 = (thongDiep = 'Không tìm thấy dữ liệu.') =>
  new LoiHttp(404, thongDiep, 'KHONG_TIM_THAY');

export const loi409 = (thongDiep: string, chiTiet?: Record<string, unknown>) =>
  new LoiHttp(409, thongDiep, 'XUNG_DOT', chiTiet);

/** Vi phạm nguyên tắc bất biến (thiếu ảnh, chưa được duyệt…) — 422. */
export const loi422 = (thongDiep: string, maLoi = 'VI_PHAM_QUY_TAC', chiTiet?: Record<string, unknown>) =>
  new LoiHttp(422, thongDiep, maLoi, chiTiet);
