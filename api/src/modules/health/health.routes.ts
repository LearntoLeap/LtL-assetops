import { Router } from 'express';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { log, moTaLoi } from '../../lib/ghi-log.js';

export const healthRouter = Router();

/**
 * DẤU PHIÊN BẢN — đọc từ biến môi trường do `cap-nhat-vps.sh` ghi vào lúc triển khai.
 *
 * Có cái này vì đã mất mấy lượt trao đổi chỉ để trả lời câu "máy chủ đã cập nhật
 * chưa?": mã nguồn có tính năng mới, mà máy chủ vẫn chạy bản cũ, nên nhìn màn
 * hình thì tưởng lập trình sai. Giờ mở /api/health là biết ngay đang chạy bản nào.
 */
const BAN_DANG_CHAY = process.env['APP_COMMIT'] ?? 'chưa ghi dấu';
const LUC_TRIEN_KHAI = process.env['APP_BUILT_AT'] ?? 'chưa rõ';

/** API còn sống — không chạm CSDL. Dùng cho pm2 và reverse proxy. */
healthRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    ungDung: 'LtL Quản lý Tài sản',
    moiTruong: env.NODE_ENV,
    banDangChay: BAN_DANG_CHAY,
    lucTrienKhai: LUC_TRIEN_KHAI,
    thoiDiem: new Date().toISOString(),
  });
});

/**
 * API sẵn sàng phục vụ — có chạm CSDL.
 * Trả 503 (chứ không phải 500) khi chưa nối được CSDL, để công cụ giám sát
 * phân biệt được "chưa sẵn sàng" với "lỗi lập trình".
 */
healthRouter.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, csdl: 'ket_noi_duoc' });
  } catch (loi) {
    log.warn('Kiểm tra sẵn sàng: chưa nối được CSDL', moTaLoi(loi));
    res.status(503).json({
      ok: false,
      maLoi: 'CSDL_CHUA_SAN_SANG',
      thongDiep:
        'Chưa kết nối được cơ sở dữ liệu. Kiểm tra DATABASE_URL trong api/.env và dịch vụ MySQL.',
    });
  }
});
