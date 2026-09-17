#!/usr/bin/env bash
#
# MỘT LỆNH LÊN VPS — làm trọn từ đầu đến cuối, không hỏi câu nào.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/LearntoLeap/LtL-assetops/main/trien-khai/mot-lenh-len-vps.sh)
#
# hoặc, nếu đã clone repo:
#   bash trien-khai/mot-lenh-len-vps.sh
#
# Làm những việc sau, theo thứ tự, và DỪNG NGAY nếu gặp lỗi thật:
#   1. Soát môi trường + ghi lại sức khoẻ TeachOps TRƯỚC khi làm gì
#   2. Cài Node 20+ nếu thiếu, cài pm2 nếu thiếu
#   3. Clone (hoặc pull) mã nguồn về /opt/ltl-assetops
#   4. Tạo CSDL MySQL + user riêng, sinh mật khẩu ngẫu nhiên
#   5. Viết api/.env, sinh khoá JWT và mật khẩu quản trị
#   6. Build, tạo bảng, nạp tài khoản khởi tạo
#   7. Khởi động pm2 + cài dịch vụ tự bật sau reboot
#   8. Vá cấu hình Nginx của site api-taisan (Socket.IO + giới hạn ảnh),
#      CÓ nginx -t và TỰ HOÀN TÁC nếu cấu hình sai
#   9. Kiểm chứng lại, đo sức khoẻ TeachOps SAU, in báo cáo
#
# CAM KẾT VỚI TEACHOPS: script không có lệnh docker nào, không đụng
# /opt/ltl-teachops, không sửa file cấu hình của site nào khác, không bao giờ
# DROP/xoá cơ sở dữ liệu. Nếu nginx -t thất bại, cấu hình được trả về nguyên
# trạng trước khi reload — Nginx không bao giờ bị để ở trạng thái lỗi.
#
# Chạy lại được nhiều lần. Đã có api/.env thì giữ nguyên, không ghi đè.
#
# Đổi được bằng biến môi trường, ví dụ:
#   TEN_MIEN_API=https://api-taisan.learntoleap.vn \
#   ADMIN_EMAIL=tri@learntoleap.vn \
#   bash trien-khai/mot-lenh-len-vps.sh

set -uo pipefail

# ── Thông số ───────────────────────────────────────────────────────────────
THU_MUC="${THU_MUC:-/opt/ltl-assetops}"
REPO="${REPO:-https://github.com/LearntoLeap/LtL-assetops.git}"
# VPS của LtL: Docker đã chiếm CẢ 3000 và 3001 (TeachOps), nên mặc định 3002.
CONG="${CONG:-3002}"
TEN_CSDL="${TEN_CSDL:-ltl_taisan}"
USER_CSDL="${USER_CSDL:-ltl_taisan}"
TEN_MIEN_API="${TEN_MIEN_API:-https://api-taisan.learntoleap.vn}"
TEN_MIEN_WEB="${TEN_MIEN_WEB:-https://ltl-assetops.vercel.app,https://assetops.learntoleap.vn,https://taisan.learntoleap.vn}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@learntoleap.vn}"
PM2_TEN="ltl-taisan-api"

# TeachOps — chỉ ĐỌC để so trước/sau, không bao giờ ghi
# TeachOps chiếm 3000 VÀ 3001 qua docker-proxy; /api/health nằm ở 3001.
CONG_TEACHOPS=3001
TEN_MIEN_TEACHOPS="teachops-api.learntoleap.vn"

HOST_API="$(printf '%s' "$TEN_MIEN_API" | sed -e 's#^https\?://##' -e 's#/.*$##')"
CONF_NGINX="${CONF_NGINX:-/www/server/panel/vhost/nginx/${HOST_API}.conf}"

# ── In ra màn hình ─────────────────────────────────────────────────────────
x='\033[0;32m'; v='\033[0;33m'; d='\033[0;31m'; m='\033[2m'; h='\033[0m'
BUOC=0
buoc() { BUOC=$((BUOC + 1)); printf "\n${x}▶ [%d/10] %s${h}\n" "$BUOC" "$1"; }
ok()   { printf "  ${x}✓${h} %s\n" "$1"; }
canh() { printf "  ${v}!${h} %s\n" "$1"; }
tin()  { printf "  ${m}·${h} %s\n" "$1"; }
loi()  { printf "\n  ${d}✗ DỪNG: %s${h}\n" "$1" >&2
         shift; for l in "$@"; do printf "    %s\n" "$l" >&2; done
         printf "\n  Dán toàn bộ màn hình này cho Claude để được chỉ tiếp.\n\n" >&2
         exit 1; }

ma_http() {
  local ma
  ma="$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$1" 2>/dev/null)"
  printf '%s' "${ma:-000}"
}

ngau_nhien() { # $1 = số byte
  head -c "$1" /dev/urandom | base64 | tr -d '/+=\n' | head -c "$(( $1 * 3 / 2 ))"
}

printf "\n  ════════════════════════════════════════════════════════════════\n"
printf "   LtL AssetOps → VPS   ·   %s\n" "$(date '+%d/%m/%Y %H:%M')"
printf "  ════════════════════════════════════════════════════════════════\n"

# ══════════════════════════════════════════════════════════════════════════
buoc "Soát môi trường và chụp ảnh TeachOps trước khi làm gì"

[ "$(id -u)" = "0" ] || loi "Phải chạy bằng root." \
  "Trong Terminal của aaPanel thì đã là root rồi." "Nếu không: sudo bash $0"

for lenh in git curl; do
  command -v "$lenh" >/dev/null || loi "Thiếu lệnh '$lenh'." \
    "Cài: apt-get install -y $lenh   (hoặc yum install -y $lenh)"
done
ok "root, git, curl — đủ"

DIA_MB="$(df -Pm /opt 2>/dev/null | awk 'NR==2 {print $4}')"
[ -n "${DIA_MB:-}" ] && [ "$DIA_MB" -lt 3000 ] && loi "Chỉ còn ${DIA_MB}MB trống ở /opt, cần ≥ 3000MB." \
  "Đĩa đầy là CẢ TeachOps cũng hỏng. Dọn trước rồi chạy lại:" \
  "  docker image prune -af"
ok "Đĩa còn ${DIA_MB:-?}MB trống ở /opt"

RAM_MB="$(free -m 2>/dev/null | awk '/^Mem:/ {print $7}')"
if [ -n "${RAM_MB:-}" ] && [ "$RAM_MB" -lt 400 ]; then
  loi "Chỉ còn ${RAM_MB}MB RAM khả dụng, cần ≥ 400MB." \
    "Thiếu RAM thì nhân hệ điều hành sẽ tự kết liễu tiến trình nặng nhất —" \
    "có thể chính là container TeachOps. Bật swap hoặc nâng RAM trước."
fi
ok "RAM khả dụng ${RAM_MB:-?}MB"

AI_CONG="$(ss -tlnp 2>/dev/null | awk -v c=":$CONG\$" '$4 ~ c {print $NF}' | head -1)"
if [ -n "$AI_CONG" ] && ! printf '%s' "$AI_CONG" | grep -q 'node'; then
  loi "Cổng $CONG đã bị tiến trình khác chiếm: $AI_CONG" \
    "Chạy lại với cổng khác, ví dụ:  CONG=3002 bash $0"
fi
ok "Cổng $CONG dùng được"

TO_TRUOC_NOI_BO="$(ma_http "http://127.0.0.1:$CONG_TEACHOPS/api/health")"
TO_TRUOC_CONG_KHAI="$(ma_http "https://$TEN_MIEN_TEACHOPS/api/health")"
tin "TeachOps TRƯỚC — nội bộ: HTTP $TO_TRUOC_NOI_BO · công khai: HTTP $TO_TRUOC_CONG_KHAI"

# ══════════════════════════════════════════════════════════════════════════
buoc "Node 20+ và pm2"

can_cai_node=1
if command -v node >/dev/null 2>&1; then
  PB="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$PB" -ge 20 ] 2>/dev/null && { can_cai_node=0; ok "Node $(node -v) — dùng được"; }
fi

if [ "$can_cai_node" = "1" ]; then
  canh "Chưa có Node 20+ — đang cài Node 22 (không đụng Docker của TeachOps)"
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 \
      && apt-get install -y nodejs >/dev/null 2>&1
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 \
      && yum install -y nodejs >/dev/null 2>&1
  fi
  command -v node >/dev/null 2>&1 || loi "Cài Node thất bại." \
    "Thử cài qua aaPanel: sidebar → Node → cài phiên bản 22, rồi chạy lại."
  ok "Đã cài Node $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2 >/dev/null 2>&1 || loi "Cài pm2 thất bại. Thử: npm install -g pm2"
  ok "Đã cài pm2 $(pm2 -v 2>/dev/null | tail -1)"
else
  ok "pm2 $(pm2 -v 2>/dev/null | tail -1)"
  DS="$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const a=JSON.parse(s);process.stdout.write(a.map(p=>p.name).filter(n=>n!=='$PM2_TEN').join(', '))}catch{process.stdout.write('')}})" 2>/dev/null)"
  [ -n "$DS" ] && canh "pm2 đang quản lý app khác: $DS — 'pm2 save' sẽ ghi lại cả chúng"
fi

# ══════════════════════════════════════════════════════════════════════════
buoc "Mã nguồn về $THU_MUC"

if [ -d "$THU_MUC/.git" ]; then
  git -C "$THU_MUC" fetch origin --quiet 2>/dev/null
  git -C "$THU_MUC" pull --ff-only origin main --quiet 2>/dev/null \
    && ok "Đã cập nhật: $(git -C "$THU_MUC" log --oneline -1)" \
    || canh "Không pull được (có thay đổi cục bộ?) — dùng mã đang có"
else
  [ -e "$THU_MUC" ] && loi "$THU_MUC đã tồn tại nhưng không phải repo git." \
    "Đổi tên nó rồi chạy lại, hoặc chạy với THU_MUC=/opt/ltl-assetops-2"
  mkdir -p "$(dirname "$THU_MUC")"
  git clone --quiet "$REPO" "$THU_MUC" || loi "git clone thất bại. Kiểm tra mạng của VPS."
  ok "Đã clone: $(git -C "$THU_MUC" log --oneline -1)"
fi
cd "$THU_MUC" || loi "Không vào được $THU_MUC"

# ══════════════════════════════════════════════════════════════════════════
buoc "Cơ sở dữ liệu MySQL"

if [ -f api/.env ] && grep -q '^DATABASE_URL' api/.env; then
  ok "api/.env đã có DATABASE_URL — giữ nguyên, bỏ qua bước tạo CSDL"

elif [ -n "${DB_PASS:-}" ]; then
  # CSDL đã được tạo sẵn trong aaPanel → CHỈ DÙNG, không cần quyền root chút nào.
  # Nhánh này là lý do tồn tại của DB_PASS: aaPanel không cho script đọc mật
  # khẩu root, nên người dùng tạo CSDL bằng giao diện rồi đưa mật khẩu vào đây.
  MK_CSDL="$DB_PASS"
  if command -v mysql >/dev/null 2>&1; then
    mysql -u"$USER_CSDL" -p"$MK_CSDL" -h 127.0.0.1 -e "SELECT 1" "$TEN_CSDL" >/dev/null 2>&1 \
      || mysql -u"$USER_CSDL" -p"$MK_CSDL" -e "SELECT 1" "$TEN_CSDL" >/dev/null 2>&1 \
      || loi "Không đăng nhập được CSDL '$TEN_CSDL' bằng user '$USER_CSDL'." \
           "Kiểm tra lại trong aaPanel → Cơ sở dữ liệu:" \
           "  · Tên CSDL và tên người dùng đều phải là: $TEN_CSDL" \
           "  · Mật khẩu truyền qua DB_PASS phải khớp mật khẩu của CSDL đó" \
           "  · Mật khẩu chứa dấu nháy đơn (') thì hãy sinh lại mật khẩu khác" \
           "" \
           "Tên CSDL/user khác thì truyền thêm, ví dụ:" \
           "  TEN_CSDL=ten_csdl USER_CSDL=ten_user DB_PASS='matkhau' bash $0"
    ok "Đăng nhập được CSDL '$TEN_CSDL' bằng user '$USER_CSDL' — dùng CSDL tạo sẵn trong aaPanel"
  else
    ok "Dùng CSDL '$TEN_CSDL' tạo sẵn trong aaPanel (không có lệnh mysql để thử trước)"
  fi

else
  # Tìm cách vào MySQL bằng root. Thử lần lượt, KHÔNG in mật khẩu ra màn hình.
  MYSQL_ROOT=""
  thu_mysql() { $1 -e "SELECT 1" >/dev/null 2>&1 && MYSQL_ROOT="$1"; }
  thu_mysql "mysql -uroot"
  [ -z "$MYSQL_ROOT" ] && thu_mysql "mysql"
  if [ -z "$MYSQL_ROOT" ] && [ -n "${MYSQL_ROOT_PW:-}" ]; then
    thu_mysql "mysql -uroot -p$MYSQL_ROOT_PW"
  fi
  # aaPanel lưu mật khẩu root MySQL ở một trong các đường dẫn sau
  if [ -z "$MYSQL_ROOT" ]; then
    for tep in /www/server/panel/config/mysql_root.pwd /www/server/panel/data/mysql_root.pwd; do
      [ -r "$tep" ] || continue
      thu_mysql "mysql -uroot -p$(tr -d '\r\n' < "$tep")"
      [ -n "$MYSQL_ROOT" ] && break
    done
  fi

  [ -n "$MYSQL_ROOT" ] || loi "Không dò được mật khẩu root MySQL — chuyện bình thường với aaPanel." \
    "CÁCH NÊN DÙNG — tạo cơ sở dữ liệu bằng giao diện aaPanel:" \
    "" \
    "  1. Sidebar → Cơ sở dữ liệu → Thêm CSDL" \
    "  2. Tên CSDL      : $TEN_CSDL" \
    "     Tên người dùng: $TEN_CSDL     (giống tên CSDL)" \
    "     Mật khẩu      : bấm nút sinh ngẫu nhiên rồi CHÉP LẠI" \
    "     Bảng mã       : utf8mb4       (KHÔNG chọn utf8)" \
    "  3. Chạy lại lệnh này, thay matkhau bằng mật khẩu vừa chép:" \
    "" \
    "     DB_PASS='matkhau' bash $0" \
    "" \
    "  Nhánh DB_PASS KHÔNG cần quyền root — nó chỉ dùng CSDL đã có." \
    "" \
    "Cách khác, nếu anh/chị biết mật khẩu root MySQL:" \
    "     MYSQL_ROOT_PW='matkhau-root' bash $0"

  MK_CSDL="${DB_PASS:-$(ngau_nhien 18)}"
  # CHỈ CREATE/GRANT. Không có DROP ở bất kỳ đâu trong script này.
  $MYSQL_ROOT <<SQL || loi "Tạo CSDL thất bại — xem thông báo của MySQL ở trên."
CREATE DATABASE IF NOT EXISTS \`${TEN_CSDL}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${USER_CSDL}'@'localhost' IDENTIFIED BY '${MK_CSDL}';
CREATE USER IF NOT EXISTS '${USER_CSDL}'@'127.0.0.1' IDENTIFIED BY '${MK_CSDL}';
ALTER USER '${USER_CSDL}'@'localhost' IDENTIFIED BY '${MK_CSDL}';
ALTER USER '${USER_CSDL}'@'127.0.0.1' IDENTIFIED BY '${MK_CSDL}';
GRANT ALL PRIVILEGES ON \`${TEN_CSDL}\`.* TO '${USER_CSDL}'@'localhost';
GRANT ALL PRIVILEGES ON \`${TEN_CSDL}\`.* TO '${USER_CSDL}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  ok "CSDL '$TEN_CSDL' và user '$USER_CSDL' đã sẵn sàng (không đụng CSDL nào khác)"
fi

# ══════════════════════════════════════════════════════════════════════════
buoc "Tệp cấu hình api/.env"

if [ -f api/.env ]; then
  ok "api/.env đã có — giữ nguyên, KHÔNG ghi đè"
  MK_ADMIN="(giữ nguyên từ lần cài trước)"
else
  MK_ADMIN="${ADMIN_PASS:-$(ngau_nhien 12)}"
  umask 077
  cat > api/.env <<ENV
PORT=$CONG
NODE_ENV=production

DATABASE_URL="mysql://${USER_CSDL}:${MK_CSDL}@127.0.0.1:3306/${TEN_CSDL}"

JWT_ACCESS_SECRET=$(ngau_nhien 48)
JWT_REFRESH_SECRET=$(ngau_nhien 48)
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

UPLOAD_DIR=./uploads
UPLOAD_MAX_BYTES=10485760
UPLOAD_MAX_EDGE=1600

CORS_ORIGINS=${TEN_MIEN_WEB}

GPS_DEFAULT_RADIUS_M=150

SEED_ADMIN_EMAIL=${ADMIN_EMAIL}
SEED_ADMIN_PASSWORD=${MK_ADMIN}
ENV
  chmod 600 api/.env
  ok "Đã tạo api/.env (quyền 600, khoá JWT sinh ngẫu nhiên)"
fi

[ -f web/.env ] || printf 'VITE_API_URL=%s\n' "$TEN_MIEN_API" > web/.env
mkdir -p api/uploads api/logs
chmod 750 api/uploads
ok "api/uploads và api/logs đã có"

# ══════════════════════════════════════════════════════════════════════════
buoc "Cài phụ thuộc và build (lâu nhất, 3–8 phút)"

npm install >/dev/null 2>&1 || loi "npm install thất bại." \
  "Chạy tay để xem lỗi:  cd $THU_MUC && npm install"
ok "Đã cài phụ thuộc"

npm run prisma:generate >/dev/null 2>&1 || loi "prisma generate thất bại."
npm run build >/dev/null 2>&1 || loi "Build thất bại." \
  "Chạy tay để xem lỗi:  cd $THU_MUC && npm run build"
ok "Đã build shared → api → web"

# ══════════════════════════════════════════════════════════════════════════
buoc "Tạo bảng và tài khoản khởi tạo"

npm run migrate:deploy >/dev/null 2>&1 || loi "Tạo bảng thất bại." \
  "Gần như luôn là DATABASE_URL sai. Kiểm tra:  grep DATABASE_URL $THU_MUC/api/.env" \
  "Chạy tay để xem lỗi:  cd $THU_MUC && npm run migrate:deploy"
ok "19 bảng đã sẵn sàng"

# Prisma CLIENT không tự đọc .env (chỉ Prisma CLI đọc) — phải gọi dotenv.
SO_TK="$(cd api && node -e '
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.user.count().then((n) => process.stdout.write(String(n)))
 .catch(() => process.stdout.write("?")).finally(() => p.$disconnect());
' 2>/dev/null || echo '?')"

if [ "$SO_TK" = "0" ] || [ "$SO_TK" = "?" ]; then
  (cd api && npm run seed:prod >/dev/null 2>&1) || loi "Nạp tài khoản khởi tạo thất bại." \
    "Chạy tay để xem lỗi:  cd $THU_MUC/api && npm run seed:prod"
  ok "Đã nạp 5 tài khoản và 30 thiết bị mẫu"
else
  ok "CSDL đã có $SO_TK tài khoản — bỏ qua seed để không đụng dữ liệu thật"
fi

# ══════════════════════════════════════════════════════════════════════════
buoc "Khởi động bằng pm2"

cd api
if pm2 describe "$PM2_TEN" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env >/dev/null 2>&1 && ok "Đã nạp lại $PM2_TEN"
else
  pm2 start ecosystem.config.cjs >/dev/null 2>&1 && ok "Đã khởi động $PM2_TEN"
fi
cd "$THU_MUC"

# pm2 save ghi danh sách; CHỈ pm2 startup mới tạo dịch vụ systemd bật lại
# danh sách đó. Thiếu bước này là VPS reboot xong API chết im.
pm2 startup >/dev/null 2>&1 && ok "Đã cài dịch vụ systemd (tự bật sau reboot)" \
  || canh "Không cài được dịch vụ tự khởi động — chạy tay: pm2 startup"
pm2 save >/dev/null 2>&1

MA_API=000
for _ in $(seq 1 60); do
  sleep 1
  MA_API="$(ma_http "http://127.0.0.1:$CONG/api/dia-diem")"
  [ "$MA_API" = "401" ] && break
done
[ "$MA_API" = "401" ] || {
  printf "\n  ${d}Nhật ký API 30 dòng cuối:${h}\n"
  pm2 logs "$PM2_TEN" --lines 30 --nostream 2>/dev/null | tail -35
  loi "API không lên (trả mã $MA_API thay vì 401)." \
    "Nhật ký ở trên. Dán cho Claude để được chỉ tiếp."
}
ok "API trả 401 cho request chưa đăng nhập — đúng như mong đợi"

# ══════════════════════════════════════════════════════════════════════════
buoc "Vá cấu hình Nginx cho $HOST_API"

CAN_THEM=""
DA_VA="khong"
if [ ! -f "$CONF_NGINX" ]; then
  canh "Chưa có site '$HOST_API' trong aaPanel — bỏ qua bước này"
  tin "Tạo trước: Trang web → Thêm proxy (Dự án proxy ngược), KHÔNG phải Dự án PHP"
  tin "  Tên miền: $HOST_API      Mục tiêu: http://127.0.0.1:$CONG"
  tin "Rồi chạy lại đúng lệnh này — script sẽ tự vá."
elif grep -qi 'teachops' "$CONF_NGINX"; then
  canh "File $CONF_NGINX có chữ 'teachops' — KHÔNG sửa, để an toàn tuyệt đối"
else
  # Thiếu dòng nào thì thêm ĐÚNG dòng đó vào trong khối location / ĐÃ CÓ.
  # Không bao giờ tạo khối location / thứ hai: nginx sẽ báo duplicate location
  # và TOÀN BỘ Nginx không nạp được — teachops sập theo.
  grep -q 'proxy_http_version' "$CONF_NGINX"        || CAN_THEM="$CAN_THEM|proxy_http_version 1.1;"
  grep -q 'proxy_set_header Upgrade' "$CONF_NGINX"  || CAN_THEM="$CAN_THEM|proxy_set_header Upgrade \$http_upgrade;"
  grep -q 'proxy_set_header Connection' "$CONF_NGINX" || CAN_THEM="$CAN_THEM|proxy_set_header Connection \"upgrade\";"
  grep -q 'client_max_body_size' "$CONF_NGINX"      || CAN_THEM="$CAN_THEM|client_max_body_size 60m;"
  grep -q 'proxy_buffering' "$CONF_NGINX"           || CAN_THEM="$CAN_THEM|proxy_buffering off;"
  grep -q 'proxy_read_timeout' "$CONF_NGINX"        || CAN_THEM="$CAN_THEM|proxy_read_timeout 3600s;"

  if [ -z "$CAN_THEM" ]; then
    ok "Cấu hình đã đủ cả 6 chỉ thị — không cần sửa gì"
  elif ! grep -qE '^[[:space:]]*location[[:space:]]*/[[:space:]]*\{' "$CONF_NGINX"; then
    canh "Không tìm thấy khối 'location / {' trong $CONF_NGINX — không tự sửa"
    tin "Dán file đó cho Claude, tôi sẽ chỉ chỗ thêm."
  else
    SAO_LUU="${CONF_NGINX}.bak-$(date +%Y%m%d%H%M%S)"
    cp -p "$CONF_NGINX" "$SAO_LUU"
    tin "Đã sao lưu: $SAO_LUU"

    NGINX_BIN="$(command -v nginx || echo /www/server/nginx/sbin/nginx)"
    [ -x "$NGINX_BIN" ] || loi "Không tìm thấy lệnh nginx để kiểm tra cấu hình." \
      "Bỏ bước vá đi cũng được — sửa tay theo trien-khai/nginx-api.conf." \
      "Sao lưu vẫn còn nguyên tại $SAO_LUU"

    printf '%s' "$CAN_THEM" | tr '|' '\n' | grep -v '^$' > /tmp/ltl-them-nginx.txt
    awk '
      BEGIN { xong = 0 }
      { print }
      xong == 0 && /^[[:space:]]*location[[:space:]]*\/[[:space:]]*\{/ {
        while ((getline dong < "/tmp/ltl-them-nginx.txt") > 0) print "    " dong
        close("/tmp/ltl-them-nginx.txt")
        xong = 1
      }
    ' "$SAO_LUU" > "$CONF_NGINX"
    rm -f /tmp/ltl-them-nginx.txt

    if "$NGINX_BIN" -t >/dev/null 2>&1; then
      "$NGINX_BIN" -s reload >/dev/null 2>&1 || systemctl reload nginx >/dev/null 2>&1
      if "$NGINX_BIN" -t >/dev/null 2>&1; then
        DA_VA="roi"
        ok "Đã thêm $(printf '%s' "$CAN_THEM" | tr -cd '|' | wc -c | tr -d ' ') chỉ thị và nạp lại Nginx"
      fi
    else
      cp -p "$SAO_LUU" "$CONF_NGINX"
      canh "nginx -t THẤT BẠI — đã trả cấu hình về nguyên trạng, KHÔNG reload"
      tin "Nginx vẫn đang chạy cấu hình cũ, teachops không bị ảnh hưởng."
      printf "\n  Lỗi nginx báo:\n"
      "$NGINX_BIN" -t 2>&1 | sed 's/^/    /' | head -10
      tin "Dán phần lỗi trên cho Claude."
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════
buoc "Kiểm chứng và so sức khoẻ TeachOps"

MA_SOCKET="$(ma_http "http://127.0.0.1:$CONG/socket.io/?EIO=4&transport=polling")"
[ "$MA_SOCKET" = "200" ] && ok "Socket.IO bắt tay được (200)" \
  || canh "Socket.IO trả $MA_SOCKET thay vì 200"

MA_CONG_KHAI="$(ma_http "$TEN_MIEN_API/api/dia-diem")"
case "$MA_CONG_KHAI" in
  401) ok "Qua tên miền công khai: 401 — CẢ CHUỖI ĐÃ THÔNG" ;;
  502) canh "Qua tên miền: 502 — proxy đã có nhưng chưa trỏ đúng cổng $CONG" ;;
  000) canh "Qua tên miền: chưa gọi được — thiếu DNS hoặc chưa bật SSL (việc còn lại bên dưới)" ;;
  *)   canh "Qua tên miền: HTTP $MA_CONG_KHAI" ;;
esac

TO_SAU_NOI_BO="$(ma_http "http://127.0.0.1:$CONG_TEACHOPS/api/health")"
TO_SAU_CONG_KHAI="$(ma_http "https://$TEN_MIEN_TEACHOPS/api/health")"

printf "\n  ${m}TeachOps — nội bộ %s → %s   ·   công khai %s → %s${h}\n" \
  "$TO_TRUOC_NOI_BO" "$TO_SAU_NOI_BO" "$TO_TRUOC_CONG_KHAI" "$TO_SAU_CONG_KHAI"
if [ "$TO_TRUOC_NOI_BO" = "$TO_SAU_NOI_BO" ] && [ "$TO_TRUOC_CONG_KHAI" = "$TO_SAU_CONG_KHAI" ]; then
  ok "TeachOps y nguyên trước và sau — không bị ảnh hưởng gì"
else
  canh "Mã HTTP của TeachOps có thay đổi — kiểm tra: docker ps"
fi

# ══════════════════════════════════════════════════════════════════════════
printf "\n  ════════════════════════════════════════════════════════════════\n"
printf "   XONG PHẦN TRÊN VPS\n"
printf "  ════════════════════════════════════════════════════════════════\n\n"
printf "   Tài khoản quản trị — CHÉP LẠI NGAY:\n"
printf "     Email     %s\n" "$ADMIN_EMAIL"
printf "     Mật khẩu  %s\n\n" "$MK_ADMIN"
printf "   Cả 5 tài khoản mẫu dùng chung mật khẩu này. Đăng nhập xong vào\n"
printf "   Thêm → Đổi mật khẩu để đổi lại từng tài khoản.\n\n"

printf "   Còn lại, làm trong aaPanel / DNS:\n"
[ "$MA_CONG_KHAI" = "401" ] || printf "     · DNS: bản ghi A  %s  →  IP của VPS\n" "$(printf '%s' "$HOST_API" | cut -d. -f1)"
[ -f "$CONF_NGINX" ] || printf "     · Trang web → Thêm proxy: %s → http://127.0.0.1:%s\n" "$HOST_API" "$CONG"
[ "$DA_VA" = "roi" ] && printf "     · Cấu hình Nginx: script đã vá xong\n"
printf "     · SSL: site %s → SSL → Let's Encrypt → bật Buộc HTTPS\n" "$HOST_API"
printf "     · Mở web: https://ltl-assetops.vercel.app\n\n"

printf "   Lệnh hay dùng:\n"
printf "     pm2 logs %s --lines 50\n" "$PM2_TEN"
printf "     pm2 status\n"
printf "     cd %s && bash trien-khai/cap-nhat-vps.sh    # lấy mã mới\n" "$THU_MUC"
printf "     cd %s && bash trien-khai/kiem-tra-cach-ly.sh\n\n" "$THU_MUC"
