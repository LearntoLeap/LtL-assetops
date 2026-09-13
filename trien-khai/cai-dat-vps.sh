#!/usr/bin/env bash
#
# Cài đặt API Quản lý Tài sản lên VPS (Ubuntu/Debian + aaPanel).
# Chạy TRÊN VPS, từ thư mục taisan/:
#
#   bash trien-khai/cai-dat-vps.sh
#
# Script này:
#   - kiểm tra Node, npm, MySQL, pm2;
#   - tạo api/.env (tự sinh khoá JWT) nếu chưa có — KHÔNG ghi đè file sẵn có;
#   - tạo CSDL và user MySQL nếu chưa có;
#   - build, chạy migration, nạp dữ liệu (tuỳ chọn), khởi động pm2;
#   - in ra cấu hình reverse proxy để dán vào aaPanel.
#
# Chạy lại được nhiều lần. KHÔNG bao giờ xoá dữ liệu đang có.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"

do_xanh='\033[0;32m'; do_vang='\033[0;33m'; do_do='\033[0;31m'; do_het='\033[0m'
buoc()   { printf "\n${do_xanh}▶ %s${do_het}\n" "$1"; }
canh()   { printf "${do_vang}  ! %s${do_het}\n" "$1"; }
loi()    { printf "${do_do}  ✗ %s${do_het}\n" "$1" >&2; exit 1; }
xong()   { printf "  ✓ %s\n" "$1"; }
hoi()    { local bien="$1" nhan="$2" mac_dinh="${3:-}" tra_loi
           if [ -n "$mac_dinh" ]; then read -r -p "  $nhan [$mac_dinh]: " tra_loi || true
                                       tra_loi="${tra_loi:-$mac_dinh}"
           else                         read -r -p "  $nhan: " tra_loi || true; fi
           printf -v "$bien" '%s' "$tra_loi"; }
hoi_kin() { local bien="$1" nhan="$2" tra_loi
            read -r -s -p "  $nhan: " tra_loi || true; echo
            printf -v "$bien" '%s' "$tra_loi"; }
co_khong() { local nhan="$1" mac_dinh="${2:-k}" tra_loi
             read -r -p "  $nhan (c/k) [$mac_dinh]: " tra_loi || true
             [[ "${tra_loi:-$mac_dinh}" =~ ^[cCyY] ]]; }

# ── 1. Kiểm tra công cụ ────────────────────────────────────────────────────
buoc "Kiểm tra môi trường"
command -v node >/dev/null || loi "Chưa có Node. Cài Node 20+ rồi chạy lại."
PHIEN_BAN_NODE="$(node -p 'process.versions.node.split(".")[0]')"
[ "$PHIEN_BAN_NODE" -ge 20 ] || loi "Cần Node 20 trở lên (đang có $(node -v))."
xong "Node $(node -v)"
command -v npm >/dev/null || loi "Chưa có npm."
xong "npm $(npm -v)"
command -v mysql >/dev/null || canh "Không thấy lệnh mysql — nếu CSDL nằm ở máy khác thì bỏ qua."
if ! command -v pm2 >/dev/null; then
  canh "Chưa có pm2."
  if co_khong "Cài pm2 toàn cục bằng npm?" c; then
    npm install -g pm2
  else
    loi "Cần pm2 để chạy API lâu dài."
  fi
fi
xong "pm2 $(pm2 -v 2>/dev/null | tail -1)"

# ── 2. Tệp cấu hình ───────────────────────────────────────────────────────
buoc "Cấu hình api/.env"
if [ -f api/.env ]; then
  xong "api/.env đã có — giữ nguyên, không ghi đè"
  TEN_CSDL="$(sed -n 's#.*/\([^/?"]*\)["?].*#\1#p' <<<"$(grep '^DATABASE_URL' api/.env)")"
else
  hoi TEN_CSDL      "Tên CSDL MySQL"            "ltl_taisan"
  hoi USER_CSDL     "User MySQL"                "ltl_taisan"
  hoi_kin MK_CSDL   "Mật khẩu user MySQL"
  [ -n "$MK_CSDL" ] || loi "Mật khẩu CSDL không được để trống."
  hoi MAY_CSDL      "Địa chỉ MySQL"             "127.0.0.1:3306"
  hoi TEN_MIEN_API  "Tên miền API (https://…)"  "https://api.doimoi.edu.vn"
  hoi TEN_MIEN_WEB  "Tên miền web (https://…)"  "https://taisan.doimoi.edu.vn"
  hoi EMAIL_ADMIN   "Email tài khoản quản trị"  "admin@learntoleap.vn"
  hoi_kin MK_ADMIN  "Mật khẩu quản trị khởi tạo (≥ 8 ký tự)"
  [ "${#MK_ADMIN}" -ge 8 ] || loi "Mật khẩu quản trị phải từ 8 ký tự."

  KHOA_ACCESS="$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))')"
  KHOA_REFRESH="$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))')"

  umask 077
  cat > api/.env <<ENV
PORT=3001
NODE_ENV=production

DATABASE_URL="mysql://${USER_CSDL}:${MK_CSDL}@${MAY_CSDL}/${TEN_CSDL}"

JWT_ACCESS_SECRET=${KHOA_ACCESS}
JWT_REFRESH_SECRET=${KHOA_REFRESH}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

UPLOAD_DIR=./uploads
UPLOAD_MAX_BYTES=10485760
UPLOAD_MAX_EDGE=1600

CORS_ORIGINS=${TEN_MIEN_WEB}

GPS_DEFAULT_RADIUS_M=150

SEED_ADMIN_EMAIL=${EMAIL_ADMIN}
SEED_ADMIN_PASSWORD=${MK_ADMIN}
ENV
  chmod 600 api/.env
  xong "Đã tạo api/.env (quyền 600, khoá JWT sinh tự động)"

  if [ ! -f web/.env ]; then
    printf 'VITE_API_URL=%s\n' "$TEN_MIEN_API" > web/.env
    xong "Đã tạo web/.env → VITE_API_URL=$TEN_MIEN_API"
  fi
fi

# ── 3. CSDL ───────────────────────────────────────────────────────────────
if command -v mysql >/dev/null && [ -n "${USER_CSDL:-}" ]; then
  buoc "Tạo CSDL và user MySQL"
  canh "Bước này cần quyền root của MySQL. Bỏ qua nếu anh/chị đã tạo sẵn trong aaPanel."
  if co_khong "Tạo CSDL '$TEN_CSDL' và user '$USER_CSDL' bây giờ?" k; then
    hoi_kin MK_ROOT "Mật khẩu root MySQL"
    mysql -uroot -p"$MK_ROOT" <<SQL
CREATE DATABASE IF NOT EXISTS \`${TEN_CSDL}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${USER_CSDL}'@'localhost' IDENTIFIED BY '${MK_CSDL}';
CREATE USER IF NOT EXISTS '${USER_CSDL}'@'127.0.0.1' IDENTIFIED BY '${MK_CSDL}';
GRANT ALL PRIVILEGES ON \`${TEN_CSDL}\`.* TO '${USER_CSDL}'@'localhost';
GRANT ALL PRIVILEGES ON \`${TEN_CSDL}\`.* TO '${USER_CSDL}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
    xong "CSDL và user đã sẵn sàng"
  fi
fi

# ── 4. Cài và build ───────────────────────────────────────────────────────
buoc "Cài phụ thuộc và build"
npm install
npm run build
xong "Đã build shared → api → web"

buoc "Thư mục ảnh và log"
mkdir -p api/uploads api/logs
chmod 750 api/uploads
xong "api/uploads và api/logs đã có"

# ── 5. Migration và dữ liệu ───────────────────────────────────────────────
buoc "Tạo bảng (migration)"
npm run migrate:deploy
xong "19 bảng đã sẵn sàng"

buoc "Dữ liệu khởi tạo"
# Đếm tài khoản từ trong workspace api để Node tìm được @prisma/client
# (npm workspaces gom phụ thuộc lên node_modules ở gốc).
SO_NGUOI_DUNG="$(cd api && node -e '
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.user.count()
 .then((n) => { process.stdout.write(String(n)); })
 .catch(() => { process.stdout.write("?"); })
 .finally(() => p.$disconnect());
' 2>/dev/null || echo '?')"

case "$SO_NGUOI_DUNG" in
  0)
    canh "CSDL chưa có tài khoản nào — KHÔNG nạp thì không đăng nhập được."
    canh "Lệnh seed nạp 5 tài khoản mẫu VÀ 30 thiết bị mẫu (xoá được sau trong trang Thiết bị)."
    if co_khong "Nạp dữ liệu khởi tạo bây giờ?" c; then
      (cd api && npm run seed:prod)
      xong "Đã nạp tài khoản và dữ liệu mẫu"
    else
      canh "Chưa nạp — hệ thống hiện chưa có tài khoản nào."
      canh "Khi cần chạy: cd api && npm run seed:prod"
    fi
    ;;
  '?')
    canh "Không đọc được số tài khoản trong CSDL (kiểm tra DATABASE_URL trong api/.env)."
    if co_khong "Vẫn chạy seed? (chạy lại được, không nhân đôi dữ liệu)" c; then
      (cd api && npm run seed:prod)
      xong "Đã chạy seed"
    fi
    ;;
  *)
    xong "CSDL đã có $SO_NGUOI_DUNG tài khoản — bỏ qua seed để không đụng dữ liệu thật"
    ;;
esac

# ── 6. pm2 ────────────────────────────────────────────────────────────────
buoc "Khởi động API bằng pm2"
cd api
if pm2 describe ltl-taisan-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
  xong "Đã nạp lại tiến trình đang chạy"
else
  pm2 start ecosystem.config.cjs
  xong "Đã khởi động ltl-taisan-api"
fi
pm2 save
cd "$GOC"

buoc "Kiểm tra API"
sleep 3
# KHÔNG dùng curl -f: 401 là phản hồi ĐÚNG cho request chưa đăng nhập,
# nhưng -f lại coi đó là lỗi và bỏ qua nhánh kiểm tra.
MA_HTTP="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/dia-diem || echo 000)"
if [ "$MA_HTTP" = "401" ]; then
  xong "API trả 401 cho request chưa đăng nhập — đúng như mong đợi"
else
  canh "API trả mã $MA_HTTP, chưa đúng. Xem log: pm2 logs ltl-taisan-api --lines 50"
fi

cat <<'HD'

────────────────────────────────────────────────────────────────────────────
CÒN HAI VIỆC LÀM TRONG aaPanel
────────────────────────────────────────────────────────────────────────────

1. Reverse proxy cho API (tên miền api.…):
   Website → chọn tên miền API → Reverse Proxy → thêm, đích http://127.0.0.1:3001
   rồi mở Configuration File và dán thêm phần trong trien-khai/nginx-api.conf
   (có dòng Upgrade/Connection — thiếu là Socket.IO không nối được).

2. Bật SSL cho cả hai tên miền (Let's Encrypt trong aaPanel).

Sau đó kiểm tra:
   curl -i https://TEN_MIEN_API/api/dia-diem      → phải là 401
   pm2 logs ltl-taisan-api --lines 30

Lệnh hay dùng về sau:
   bash trien-khai/cap-nhat-vps.sh   # lấy mã mới rồi nạp lại, KHÔNG seed
   pm2 restart ltl-taisan-api
   pm2 logs ltl-taisan-api
────────────────────────────────────────────────────────────────────────────
HD
