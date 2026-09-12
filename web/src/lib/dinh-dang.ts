/** Định dạng ngày/giờ và số theo tiếng Việt. */
const NGAY_GIO = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const NGAY = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function ngayGio(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : NGAY_GIO.format(d);
}

export function ngay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : NGAY.format(d);
}

/** "còn 45 phút" / "đã hết hạn" — cho mã vượt quyền GPS. */
export function conLai(iso: string): string {
  const con = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(con)) return '—';
  if (con <= 0) return 'đã hết hạn';
  const phut = Math.round(con / 60_000);
  if (phut < 60) return `còn ${phut} phút`;
  const gio = Math.floor(phut / 60);
  return `còn ${gio} giờ ${phut % 60} phút`;
}
