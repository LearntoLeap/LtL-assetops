/**
 * Cấu hình pm2 cho API. Chạy trên VPS từ thư mục api/ của repo:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup      # tự chạy lại sau khi VPS khởi động
 *   pm2 logs ltl-taisan-api
 *
 * Biến môi trường đọc từ api/.env (file này KHÔNG chứa bí mật).
 */
module.exports = {
  apps: [
    {
      name: 'ltl-taisan-api',
      script: 'dist/src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork', // Socket.IO ở giai đoạn 4 cần dính phiên — không dùng cluster
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      max_memory_restart: '512M',
      kill_timeout: 12000, // chờ server đóng kết nối êm (xem src/server.ts)
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/pm2-loi.log',
      out_file: 'logs/pm2-ra.log',
      merge_logs: true,
      time: false, // log đã có trường thoiDiem dạng ISO
    },
  ],
};
