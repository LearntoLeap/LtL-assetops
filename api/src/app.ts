import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { nguoiDungRouter } from './modules/nguoi-dung/nguoi-dung.routes.js';
import { diaDiemRouter } from './modules/dia-diem/dia-diem.routes.js';
import { vuotQuyenGpsRouter } from './modules/vuot-quyen-gps/vuot-quyen-gps.routes.js';
import { danhMucRouter } from './modules/danh-muc/danh-muc.routes.js';
import { thietBiRouter } from './modules/thiet-bi/thiet-bi.routes.js';
import { nhapXuatRouter } from './modules/nhap-xuat/nhap-xuat.routes.js';
import { anhRouter } from './modules/anh/anh.routes.js';
import { yeuCauRouter } from './modules/yeu-cau/yeu-cau.routes.js';
import { nhatKyRouter } from './modules/nhat-ky/nhat-ky.routes.js';
import { bbbgRouter } from './modules/bbbg/bbbg.routes.js';
import { kiemKeRouter } from './modules/kiem-ke/kiem-ke.routes.js';
import { baoHongRouter } from './modules/bao-hong/bao-hong.routes.js';
import { linhKienRouter } from './modules/linh-kien/linh-kien.routes.js';
import { baoCaoRouter } from './modules/bao-cao/bao-cao.routes.js';
import { kioskRouter } from './modules/kiosk/kiosk.routes.js';
import { wikiRouter } from './modules/wiki/wiki.routes.js';
import { caiDatRouter } from './modules/cai-dat/cai-dat.routes.js';
import { khongTimThayRoute, xuLyLoi } from './middleware/loi.js';

export function dungApp(): Express {
  const app = express();

  app.set('trust proxy', 1); // aaPanel reverse proxy đứng trước
  app.disable('x-powered-by');
  // Không tiết lộ ETag của phản hồi JSON có dữ liệu nhạy cảm
  app.set('etag', false);

  app.use(
    helmet({
      // Ảnh phục vụ qua API và web nằm ở origin khác
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Không có Origin (curl, app nội bộ) thì cho qua
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/nguoi-dung', nguoiDungRouter);
  app.use('/api/dia-diem', diaDiemRouter);
  app.use('/api/vuot-quyen-gps', vuotQuyenGpsRouter);
  app.use('/api/danh-muc', danhMucRouter);
  app.use('/api/thiet-bi', thietBiRouter);
  app.use('/api/nhap-xuat', nhapXuatRouter);
  app.use('/api/anh', anhRouter);
  app.use('/api/yeu-cau', yeuCauRouter);
  app.use('/api/nhat-ky', nhatKyRouter);
  app.use('/api/bbbg', bbbgRouter);
  app.use('/api/bao-cao', baoCaoRouter);
  app.use('/api/wiki', wikiRouter);
  app.use('/api/kiosk', kioskRouter);
  app.use('/api/kiem-ke', kiemKeRouter);
  app.use('/api/bao-hong', baoHongRouter);
  app.use('/api/linh-kien', linhKienRouter);
  app.use('/api/cai-dat', caiDatRouter);

  app.use(khongTimThayRoute);
  app.use(xuLyLoi);

  return app;
}
