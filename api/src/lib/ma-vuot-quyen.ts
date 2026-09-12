/**
 * Sinh và chuẩn hoá mã vượt quyền GPS dùng một lần.
 *
 * Bộ ký tự bỏ 0/O/1/I/L để đọc qua điện thoại không nhầm. 8 ký tự trên bộ 32
 * ký tự ≈ 40 bit, đủ cho mã dùng một lần có thời hạn ngắn.
 */
import { randomInt } from 'node:crypto';

const BO_KY_TU = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DO_DAI = 8;

/** Chuẩn hoá mã người dùng nhập: bỏ dấu cách/gạch, đổi sang chữ hoa. */
export function chuanHoaMa(ma: string): string {
  return ma.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Sinh mã mới. Trả về cả dạng đã chuẩn hoá (để băm) và dạng hiển thị. */
export function sinhMa(): { maChuan: string; maHienThi: string } {
  let maChuan = '';
  for (let i = 0; i < DO_DAI; i += 1) {
    maChuan += BO_KY_TU[randomInt(BO_KY_TU.length)];
  }
  return { maChuan, maHienThi: `${maChuan.slice(0, 4)}-${maChuan.slice(4)}` };
}

/** 4 ký tự đầu — lưu kèm để tra cứu nhanh mà không cần biết cả mã. */
export function tienToMa(maChuan: string): string {
  return maChuan.slice(0, 4);
}
