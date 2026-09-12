/** Băm và kiểm tra mật khẩu bằng bcrypt. */
import { compare, hash } from 'bcryptjs';
import { loi400 } from './loi-http.js';

const SO_VONG = 12;
export const DAI_TOI_THIEU = 8;
/** bcrypt chỉ dùng 72 byte đầu — chặn sớm để người dùng không bị bất ngờ. */
const DAI_TOI_DA = 72;

/**
 * Chính sách mật khẩu: tối thiểu 8 ký tự, có cả chữ và số.
 * Ném LoiHttp 400 kèm thông điệp tiếng Việt nếu không đạt.
 */
export function kiemTraDoManh(matKhau: string): void {
  if (matKhau.length < DAI_TOI_THIEU) {
    throw loi400(`Mật khẩu phải có ít nhất ${DAI_TOI_THIEU} ký tự.`, 'MAT_KHAU_YEU');
  }
  if (Buffer.byteLength(matKhau, 'utf8') > DAI_TOI_DA) {
    throw loi400(`Mật khẩu không được dài quá ${DAI_TOI_DA} byte.`, 'MAT_KHAU_QUA_DAI');
  }
  if (!/[0-9]/.test(matKhau) || !/[A-Za-zÀ-ỹ]/.test(matKhau)) {
    throw loi400('Mật khẩu phải có cả chữ và số.', 'MAT_KHAU_YEU');
  }
}

export async function bamMatKhau(matKhau: string): Promise<string> {
  return hash(matKhau, SO_VONG);
}

export async function khopMatKhau(matKhau: string, bam: string): Promise<boolean> {
  return compare(matKhau, bam);
}
