import { dungApp } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';
import { log, moTaLoi } from './lib/ghi-log.js';

const app = dungApp();
const server = app.listen(env.PORT, () => {
  log.info('API đã khởi động', { cong: env.PORT, moiTruong: env.NODE_ENV });
});

async function dungHan(tinHieu: string): Promise<void> {
  log.info('Nhận tín hiệu dừng, đang đóng kết nối', { tinHieu });
  server.close(() => {
    void prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch((loi: unknown) => {
        log.error('Đóng kết nối CSDL thất bại', moTaLoi(loi));
        process.exit(1);
      });
  });
  // Quá 10 giây chưa đóng xong thì thoát cứng để pm2 khởi động lại
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void dungHan('SIGTERM'));
process.on('SIGINT', () => void dungHan('SIGINT'));
process.on('unhandledRejection', (ly) => {
  log.error('Promise bị từ chối mà không bắt', moTaLoi(ly));
});
process.on('uncaughtException', (loi) => {
  log.error('Ngoại lệ không bắt được — thoát để pm2 khởi động lại', moTaLoi(loi));
  process.exit(1);
});
