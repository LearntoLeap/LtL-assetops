/**
 * Cấp và kiểm tra JWT.
 *   - Access token: ngắn hạn, gửi trong header Authorization: Bearer.
 *   - Refresh token: dài hạn, LƯU HASH ở bảng refresh_tokens để thu hồi được.
 *
 * Hai token dùng hai khoá bí mật KHÁC NHAU, nên access token không thể bị dùng
 * thay refresh token và ngược lại.
 */
import { createHash, randomBytes } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../env.js';
import { loi401 } from './loi-http.js';

export interface NoiDungAccess {
  /** id người dùng */
  sub: string;
  email: string;
  role: UserRole;
  /** id điểm lưu trữ gắn với tài khoản (KHO → kho, TRUONG → điểm trường). */
  locationId: string | null;
  loai: 'access';
}

export interface NoiDungRefresh {
  sub: string;
  /** Mã ngẫu nhiên nhận diện đúng một bản ghi refresh_tokens. */
  jti: string;
  loai: 'refresh';
}

function khoaAccess(): string {
  const k = env.JWT_ACCESS_SECRET;
  if (!k) throw new Error('Chưa đặt JWT_ACCESS_SECRET trong api/.env — xem api/.env.example.');
  return k;
}

function khoaRefresh(): string {
  const k = env.JWT_REFRESH_SECRET;
  if (!k) throw new Error('Chưa đặt JWT_REFRESH_SECRET trong api/.env — xem api/.env.example.');
  return k;
}

/** Kiểm tra cấu hình khoá ngay lúc khởi động, đừng để tới lúc ai đó đăng nhập. */
export function kiemTraCauHinhKhoa(): void {
  khoaAccess();
  khoaRefresh();
}

/**
 * `expiresIn` của jsonwebtoken là kiểu template literal hẹp. env.ts đã kiểm
 * định dạng bằng regex nên ép kiểu ở đây là an toàn (không dùng `any`).
 */
type HanDung = NonNullable<SignOptions['expiresIn']>;

export function capAccessToken(noiDung: Omit<NoiDungAccess, 'loai'>): string {
  const tuyChon: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as HanDung };
  return jwt.sign({ ...noiDung, loai: 'access' } satisfies NoiDungAccess, khoaAccess(), tuyChon);
}

export interface RefreshDaCap {
  token: string;
  jti: string;
  tokenHash: string;
  hetHanLuc: Date;
}

export function capRefreshToken(userId: string): RefreshDaCap {
  const jti = randomBytes(24).toString('base64url');
  const tuyChon: SignOptions = { expiresIn: env.JWT_REFRESH_TTL as HanDung };
  const token = jwt.sign(
    { sub: userId, jti, loai: 'refresh' } satisfies NoiDungRefresh,
    khoaRefresh(),
    tuyChon,
  );
  const daGiai = jwt.decode(token) as JwtPayload | null;
  const hetHan = daGiai?.exp;
  if (typeof hetHan !== 'number') {
    throw new Error('Không đọc được thời điểm hết hạn của refresh token vừa cấp.');
  }
  return { token, jti, tokenHash: bamToken(token), hetHanLuc: new Date(hetHan * 1000) };
}

/** Hash refresh token trước khi lưu — CSDL bị đọc cũng không dùng lại được token. */
export function bamToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function laNoiDungAccess(giaTri: unknown): giaTri is NoiDungAccess {
  if (typeof giaTri !== 'object' || giaTri === null) return false;
  const o = giaTri as Record<string, unknown>;
  return (
    o['loai'] === 'access' &&
    typeof o['sub'] === 'string' &&
    typeof o['email'] === 'string' &&
    typeof o['role'] === 'string' &&
    (typeof o['locationId'] === 'string' || o['locationId'] === null)
  );
}

function laNoiDungRefresh(giaTri: unknown): giaTri is NoiDungRefresh {
  if (typeof giaTri !== 'object' || giaTri === null) return false;
  const o = giaTri as Record<string, unknown>;
  return o['loai'] === 'refresh' && typeof o['sub'] === 'string' && typeof o['jti'] === 'string';
}

export function docAccessToken(token: string): NoiDungAccess {
  let noiDung: unknown;
  try {
    noiDung = jwt.verify(token, khoaAccess());
  } catch {
    throw loi401('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  }
  if (!laNoiDungAccess(noiDung)) throw loi401('Access token không đúng định dạng.');
  return noiDung;
}

export function docRefreshToken(token: string): NoiDungRefresh {
  let noiDung: unknown;
  try {
    noiDung = jwt.verify(token, khoaRefresh());
  } catch {
    throw loi401('Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (!laNoiDungRefresh(noiDung)) throw loi401('Refresh token không đúng định dạng.');
  return noiDung;
}
