import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';
import { healthRouter } from './modules/health/health.routes.js';
import { khongTimThayRoute, xuLyLoi } from './middleware/loi.js';

export function dungApp(): Express {
  const app = express();

  app.set('trust proxy', 1); // aaPanel reverse proxy đứng trước
  app.disable('x-powered-by');

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

  app.use(khongTimThayRoute);
  app.use(xuLyLoi);

  return app;
}
