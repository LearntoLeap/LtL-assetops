#!/usr/bin/env bash
#
# Cập nhật API lên phiên bản mới. Chạy TRÊN VPS, từ thư mục gốc của repo:
#
#   bash trien-khai/cap-nhat-vps.sh
#
# KHÔNG chạy seed, KHÔNG chạm vào api/.env, KHÔNG xoá ảnh trong api/uploads/.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"
do_xanh='\033[0;32m'; do_het='\033[0m'
buoc() { printf "\n${do_xanh}▶ %s${do_het}\n" "$1"; }

[ -f api/.env ] || { echo "Chưa có api/.env — chạy trien-khai/cai-dat-vps.sh trước." >&2; exit 1; }

buoc "Lấy mã nguồn mới"
git fetch origin
NHANH="$(git rev-parse --abbrev-ref HEAD)"
git pull --ff-only origin "$NHANH"
echo "  ✓ $(git log --oneline -1)"

buoc "Cài phụ thuộc và build"
npm install
npm run build

buoc "Áp migration còn thiếu"
npm run migrate:deploy

buoc "Ghi dấu phiên bản"
# Để /api/health nói rõ đang chạy bản nào — khỏi phải đoán "đã cập nhật chưa".
export APP_COMMIT="$(git rev-parse --short HEAD)"
export APP_BUILT_AT="$(date '+%Y-%m-%d %H:%M:%S')"
echo "  ✓ $APP_COMMIT lúc $APP_BUILT_AT"

buoc "Nạp lại API"
cd api && pm2 reload ecosystem.config.cjs --update-env && pm2 save && cd "$GOC"

buoc "Kiểm tra"
MA=000
for _ in $(seq 1 30); do
  sleep 1
  MA="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/api/dia-diem || echo 000)"
  [ "$MA" = "401" ] && break
done
if [ "$MA" = "401" ]; then
  echo "  ✓ API đã chạy (401 cho request chưa đăng nhập)"
else
  echo "  ! API trả mã $MA — xem: pm2 logs ltl-taisan-api --lines 50" >&2
fi

buoc "Bản đang chạy"
curl -s http://127.0.0.1:3002/api/health || true
echo

echo
echo "────────────────────────────────────────────────────────────────"
echo "MỚI XONG NỬA VIỆC. Script này chỉ cập nhật API và cơ sở dữ liệu."
echo
echo "GIAO DIỆN WEB nằm trên Vercel, KHÔNG nằm trên máy chủ này. Mọi thay"
echo "đổi về nút bấm, trang mới, biểu đồ… chỉ lên khi Vercel build lại từ"
echo "nhánh main của repo LearntoLeap/LtL-assetops."
echo
echo "Kiểm tra nhanh xem giao diện đã mới chưa:"
echo "  vào https://assetops.learntoleap.vn/api/health và xem trường"
echo "  \"banDangChay\" — phải trùng với $(git rev-parse --short HEAD)"
echo "────────────────────────────────────────────────────────────────"
