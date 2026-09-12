/** Đọc & kiểm tra biến môi trường một lần lúc khởi động — sai thì dừng ngay. */
import { config as napEnv } from 'dotenv';
import { z } from 'zod';

napEnv();

const soNguyenDuong = (macDinh: number) =>
  z.coerce.number().int().positive().default(macDinh);

const luocDo = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: soNguyenDuong(3001),

  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL — xem api/.env.example'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET phải dài ít nhất 32 ký tự').optional(),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET phải dài ít nhất 32 ký tự').optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_BYTES: soNguyenDuong(10 * 1024 * 1024),
  UPLOAD_MAX_EDGE: soNguyenDuong(1600),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  GPS_DEFAULT_RADIUS_M: soNguyenDuong(150),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

const ketQua = luocDo.safeParse(process.env);

if (!ketQua.success) {
  const dong = ketQua.error.issues
    .map((v) => `  - ${v.path.join('.')}: ${v.message}`)
    .join('\n');
  process.stderr.write(`Cấu hình môi trường không hợp lệ:\n${dong}\n`);
  process.exit(1);
}

const tho = ketQua.data;

export const env = {
  ...tho,
  laSanXuat: tho.NODE_ENV === 'production',
  /** Danh sách origin được phép gọi API. */
  corsOrigins: tho.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
} as const;

export type Env = typeof env;
