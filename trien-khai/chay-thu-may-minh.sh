#!/usr/bin/env bash
#
# CHẠY THỬ TRÊN MÁY MÌNH — dùng để test trước khi đưa lên VPS.
#
#   bash trien-khai/chay-thu-may-minh.sh
#
# Khác với cai-dat-vps.sh: không cần pm2, không cần nginx, không cần tên miền.
# Script tự tạo CSDL, nạp dữ liệu mẫu, rồi mở API + web ở cổng localhost.
#
# Cần sẵn: Node 20+ và MySQL 8 (hoặc MariaDB 10.6+) đang chạy ở máy.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"

x='\033[0;32m'; v='\033[0;33m'; d='\033[0;31m'; h='\033[0m'
buoc() { printf "\n${x}▶ %s${h}\n" "$1"; }
canh() { printf "${v}  ! %s${h}\n" "$1"; }
loi()  { printf "${d}  ✗ %s${h}\n" "$1" >&2; exit 1; }
xong() { printf "  ✓ %s\n" "$1"; }

# Thông số dùng thử ở máy mình — cố định để anh/chị không phải nhập gì.
TEN_CSDL="ltl_taisan_thu"
MK_THU="LtL@2026Test"
CONG_API=3001
CONG_WEB=5173

buoc "Kiểm tra máy"
command -v node >/dev/null || loi "Chưa có Node. Cài Node 20+ tại https://nodejs.org rồi chạy lại."
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || loi "Cần Node 20+ (đang có $(node -v))."
xong "Node $(node -v)"

MYSQL_CMD=""
for thu in "mysql -uroot" "mysql -uroot -proot" "sudo mysql -uroot"; do
  if $thu -e "SELECT 1" >/dev/null 2>&1; then MYSQL_CMD="$thu"; break; fi
done
if [ -z "$MYSQL_CMD" ]; then
  canh "Không tự vào được MySQL bằng user root."
  canh "Nếu root có mật khẩu, chạy lại kèm biến môi trường, ví dụ:"
  canh '  MYSQL_ROOT_PW="matkhaucuaban" bash trien-khai/chay-thu-may-minh.sh'
  if [ -n "${MYSQL_ROOT_PW:-}" ]; then
    mysql -uroot -p"$MYSQL_ROOT_PW" -e "SELECT 1" >/dev/null 2>&1 \
      && MYSQL_CMD="mysql -uroot -p$MYSQL_ROOT_PW" \
      || loi "Mật khẩu root MySQL không đúng."
  else
    loi "Chưa kết nối được MySQL. Kiểm tra MySQL đã chạy chưa (macOS: brew services start mysql)."
  fi
fi
xong "MySQL kết nối được"

buoc "Tạo cơ sở dữ liệu thử: $TEN_CSDL"
$MYSQL_CMD -e "CREATE DATABASE IF NOT EXISTS \`$TEN_CSDL\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$MYSQL_CMD -e "CREATE USER IF NOT EXISTS 'ltl_thu'@'127.0.0.1' IDENTIFIED BY '$MK_THU';
               GRANT ALL PRIVILEGES ON \`$TEN_CSDL\`.* TO 'ltl_thu'@'127.0.0.1'; FLUSH PRIVILEGES;"
xong "CSDL và user đã sẵn sàng"

buoc "Tạo tệp cấu hình"
if [ -f api/.env ]; then
  canh "api/.env đã có — giữ nguyên, không ghi đè"
else
  umask 077
  cat > api/.env <<ENV
PORT=$CONG_API
NODE_ENV=development
DATABASE_URL="mysql://ltl_thu:$MK_THU@127.0.0.1:3306/$TEN_CSDL"
JWT_ACCESS_SECRET=$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))')
JWT_REFRESH_SECRET=$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))')
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
UPLOAD_DIR=./uploads
UPLOAD_MAX_BYTES=10485760
UPLOAD_MAX_EDGE=1600
CORS_ORIGINS=http://localhost:$CONG_WEB,http://127.0.0.1:$CONG_WEB
GPS_DEFAULT_RADIUS_M=150
SEED_ADMIN_EMAIL=admin@learntoleap.vn
SEED_ADMIN_PASSWORD=$MK_THU
ENV
  xong "api/.env (mật khẩu dùng thử: $MK_THU)"
fi
printf 'VITE_API_URL=http://localhost:%s\n' "$CONG_API" > web/.env
xong "web/.env → API ở http://localhost:$CONG_API"
mkdir -p api/uploads api/logs

buoc "Cài phụ thuộc (lần đầu hơi lâu)"
npm install
xong "Đã cài xong"

buoc "Tạo 19 bảng"
npm run migrate:deploy >/dev/null
xong "Xong"

buoc "Nạp dữ liệu mẫu"
SO_TK="$(cd api && node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.user.count().then((n) => process.stdout.write(String(n)))
 .catch(() => process.stdout.write("?")).finally(() => p.$disconnect());
' 2>/dev/null || echo '?')"
if [ "$SO_TK" = "0" ] || [ "$SO_TK" = "?" ]; then
  (cd api && npm run seed)
  xong "Đã nạp 5 tài khoản và 30 thiết bị mẫu"
else
  xong "CSDL đã có $SO_TK tài khoản — bỏ qua seed"
fi

buoc "Bật API và web"
cleanup() { [ -n "${PID_API:-}" ] && kill "$PID_API" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
npm run dev:api > api/logs/chay-thu-api.log 2>&1 &
PID_API=$!
for i in $(seq 1 40); do
  MA="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$CONG_API/api/dia-diem" 2>/dev/null || echo 000)"
  [ "$MA" = "401" ] && break
  sleep 1
done
[ "${MA:-000}" = "401" ] || { canh "API chưa lên. Xem api/logs/chay-thu-api.log"; }
xong "API đã chạy ở http://localhost:$CONG_API"

cat <<HD

════════════════════════════════════════════════════════════════════
  MỞ TRÌNH DUYỆT:  http://localhost:$CONG_WEB

  Tài khoản dùng thử — cả 5 dùng chung mật khẩu:  $MK_THU

    admin@learntoleap.vn             Quản trị — toàn quyền
    vanhanh@learntoleap.vn           Vận hành — duyệt yêu cầu
    kho@learntoleap.vn               Kho — xuất/nhập, màn hình kho
    nhansu@learntoleap.vn            Nhân sự — tạo yêu cầu mượn
    truong.minhkhai@learntoleap.vn   Điểm trường — chỉ dữ liệu trường mình

  LƯU Ý tài khoản kho: bị khoá theo GPS. Ở máy mình, trình duyệt sẽ
  hỏi quyền vị trí và máy chủ so với toạ độ kho trong dữ liệu mẫu
  (Hà Nội) nên thường sẽ BỊ CHẶN. Cách thử: đăng nhập bằng admin,
  vào "Thêm → Khoá vị trí kho", sửa toạ độ kho về vị trí của anh/chị
  hoặc cấp mã vượt quyền dùng một lần.

  Bấm Ctrl+C để tắt cả hai.
════════════════════════════════════════════════════════════════════

HD

npm run dev:web
