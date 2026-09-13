import { createServer } from 'node:http';
import { dungApp } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';
import { log, moTaLoi } from './lib/ghi-log.js';
import { kiemTraCauHinhKhoa } from './lib/jwt.js';
import { dongRealtime, dungRealtime } from './realtime.js';

// Thiếu khoá JWT thì dừng ngay lúc khởi động, đừng để tới lúc ai đó đăng nhập.
try {
  kiemTraCauHinhKhoa();
} catch (loi) {
  log.error('Cấu hình JWT không hợp lệ — dừng khởi động', moTaLoi(loi));
  process.exit(1);
}

const app = dungApp();
const server = createServer(app);
// Socket.IO dùng chung cổng với API — aaPanel chỉ phải reverse proxy một cổng.
dungRealtime(server);

server.listen(env.PORT, () => {
  log.info('API đã khởi động', { cong: env.PORT, moiTruong: env.NODE_ENV });
});

async function dungHan(tinHieu: string): Promise<void> {
  log.info('Nhận tín hiệu dừng, đang đóng kết nối', { tinHieu });
  void dongRealtime().finally(() => {
    server.close(() => {
      void prisma
        .$disconnect()
        .then(() => process.exit(0))
        .catch((loi: unknown) => {
          log.error('Đóng kết nối CSDL thất bại', moTaLoi(loi));
          process.exit(1);
        });
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
