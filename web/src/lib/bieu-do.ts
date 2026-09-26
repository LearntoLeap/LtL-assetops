/**
 * Tiện ích dùng chung cho biểu đồ. Không dùng thư viện vẽ biểu đồ: hai dạng cần
 * ở giai đoạn 6 (thanh ngang và cột theo thời gian) vẽ bằng HTML và SVG thuần,
 * nên gói web không phình thêm và biểu đồ đổi màu theo giao diện sáng/tối sẵn.
 */

/**
 * Mốc trục tròn số (0 / 5 / 10 …) phủ hết khoảng giá trị.
 *
 * Luôn là số NGUYÊN: mọi con số trên các biểu đồ ở đây đều là số đếm thiết bị,
 * mốc "0,5 thiết bị" thì không có nghĩa gì.
 */
export function mocTruc(lonNhat: number, soMoc = 4): number[] {
  if (lonNhat <= 0) return [0];
  const buocTho = lonNhat / soMoc;
  const bac = 10 ** Math.floor(Math.log10(buocTho));
  const tho = [1, 2, 2.5, 5, 10].map((h) => h * bac).find((b) => b >= buocTho) ?? bac * 10;
  const buoc = Math.max(1, Math.round(tho));
  const moc: number[] = [];
  for (let v = 0; v <= lonNhat + 0.001; v += buoc) moc.push(v);
  return moc;
}

const SO = new Intl.NumberFormat('vi-VN');

export function so(n: number): string {
  return SO.format(n);
}

const THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** "Thứ ba, 15/03/2026" — dùng cho đồng hồ kiosk và nhãn biểu đồ. */
export function thuNgayDayDu(d: Date): string {
  const ngay = String(d.getDate()).padStart(2, '0');
  const thang = String(d.getMonth() + 1).padStart(2, '0');
  return `${THU[d.getDay()] ?? ''}, ${ngay}/${thang}/${d.getFullYear()}`;
}

/** "15/03" cho nhãn trục ngày. */
export function ngayThang(iso: string): string {
  const [, thang, ngay] = iso.split('-');
  return `${ngay}/${thang}`;
}

/**
 * Màu của từng TÌNH TRẠNG thiết bị.
 *
 * Để ở một chỗ vì tình trạng phải giữ nguyên màu ở mọi biểu đồ: xanh lá luôn là
 * "tốt", đỏ luôn là "hỏng". Dải này đã qua bộ kiểm màu (xem chú thích trong
 * `index.css`) và không được dùng lại làm màu chuỗi dữ liệu bất kỳ.
 */
export const MAU_TINH_TRANG: Record<string, string> = {
  TOT: 'var(--viz-tt-tot)',
  DANG_SU_DUNG: 'var(--viz-tt-dang-dung)',
  CAN_BAO_TRI: 'var(--viz-tt-bao-tri)',
  DANG_BAO_HANH: 'var(--viz-tt-bao-hanh)',
  HONG: 'var(--viz-tt-hong)',
  MAT: 'var(--viz-tt-mat)',
};
