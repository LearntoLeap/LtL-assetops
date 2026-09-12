/** Một PrismaClient dùng chung cho cả tiến trình. */
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { log } from './lib/ghi-log.js';

export const prisma = new PrismaClient({
  // Đưa log của Prisma qua logger có cấu trúc thay vì để nó tự in ra stderr.
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
    ...(env.laSanXuat ? [] : ([{ emit: 'event', level: 'query' }] as const)),
  ],
});

prisma.$on('warn', (su) => {
  log.warn('Prisma cảnh báo', { thongDiepPrisma: su.message });
});

prisma.$on('error', (su) => {
  log.error('Prisma lỗi', { thongDiepPrisma: su.message });
});

if (!env.laSanXuat) {
  prisma.$on('query', (su) => {
    log.debug('Prisma truy vấn', { sql: su.query, thoiGianMs: su.duration });
  });
}

/** Kiểu transaction của Prisma — dùng cho các service ghi nhiều bảng cùng lúc. */
export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function dongKetNoi(): Promise<void> {
  await prisma.$disconnect();
}
