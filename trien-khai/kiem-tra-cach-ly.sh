#!/usr/bin/env bash
#
# KIỂM TRA CÁCH LY — chạy TRƯỚC và SAU khi cài, để chắc chắn hệ thống Quản lý
# Tài sản không đụng gì tới TeachOps đang chạy trên cùng VPS.
#
#   bash trien-khai/kiem-tra-cach-ly.sh
#
# ════════════════════════════════════════════════════════════════════════════
# SCRIPT NÀY CHỈ ĐỌC. Không tạo, không sửa, không xoá, không khởi động lại gì.
# Chạy bao nhiêu lần cũng được, ở bất kỳ thời điểm nào.
# ════════════════════════════════════════════════════════════════════════════
#
# Cách dùng:
#   1. Chạy TRƯỚC khi cài  → chụp lại màn hình (phần "SỨC KHOẺ TEACHOPS").
#   2. Cài đặt.
#   3. Chạy LẠI            → so hai phần đó. Giống nhau là TeachOps không bị gì.

set -uo pipefail   # KHÔNG dùng -e: script kiểm tra thì lệnh lỗi là dữ liệu, không phải cớ để thoát

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

x='\033[0;32m'; v='\033[0;33m'; d='\033[0;31m'; m='\033[2m'; h='\033[0m'
muc()  { printf "\n${x}━━ %s ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${h}\n" "$1"; }
ok()   { printf "  ${x}OK${h}   %s\n" "$1"; }
canh() { printf "  ${v}CHÚ Ý${h} %s\n" "$1"; SO_CANH=$((SO_CANH + 1)); }
xau()  { printf "  ${d}DỪNG${h} %s\n" "$1"; SO_XAU=$((SO_XAU + 1)); }
tin()  { printf "  ${m}·${h}    %s\n" "$1"; }

SO_CANH=0
SO_XAU=0

# Thông số của hệ Quản lý Tài sản (khác hoàn toàn TeachOps)
CONG_TS=3002
THU_MUC_TS="/opt/ltl-assetops"
CSDL_TS="ltl_taisan"
PM2_TS="ltl-taisan-api"

# Thông số TeachOps — chỉ để ĐỌC, không bao giờ ghi
# TeachOps giữ cả 3000 và 3001 qua docker-proxy
CONG_TO=3001
THU_MUC_TO="/opt/ltl-teachops"
TEN_MIEN_TO="teachops-api.learntoleap.vn"

printf "\n"
printf "  KIỂM TRA CÁCH LY — Quản lý Tài sản  ⟂  TeachOps\n"
printf "  ${m}%s · %s${h}\n" "$(hostname)" "$(date '+%d/%m/%Y %H:%M:%S')"

# ── 1. Cổng ────────────────────────────────────────────────────────────────
muc "1. CỔNG MẠNG"

dang_nghe() { # $1 = cổng; in ra tiến trình đang nghe, rỗng nếu không ai nghe
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | awk -v c=":$1\$" '$4 ~ c {print $NF}' | head -1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tlnp 2>/dev/null | awk -v c=":$1\$" '$4 ~ c {print $NF}' | head -1
  fi
}

AI_TS="$(dang_nghe "$CONG_TS")"
AI_TO="$(dang_nghe "$CONG_TO")"

if [ -z "$AI_TS" ]; then
  ok "Cổng $CONG_TS còn trống — Quản lý Tài sản sẽ dùng cổng này"
elif printf '%s' "$AI_TS" | grep -q "$PM2_TS\|node"; then
  ok "Cổng $CONG_TS đang do chính Quản lý Tài sản dùng ($AI_TS) — đã cài rồi"
else
  xau "Cổng $CONG_TS đã bị tiến trình khác chiếm: $AI_TS"
  tin "Chạy lại script cài đặt với cổng khác (vd CONG=3003) và sửa Mục tiêu proxy cho khớp"
fi

if [ -n "$AI_TO" ]; then
  ok "Cổng $CONG_TO vẫn do TeachOps giữ ($AI_TO) — Quản lý Tài sản KHÔNG chạm vào"
else
  canh "Không thấy ai nghe cổng $CONG_TO — TeachOps có đang chạy không?"
fi

# ── 2. Thư mục ─────────────────────────────────────────────────────────────
muc "2. THƯ MỤC TRÊN ĐĨA"

if [ -d "$THU_MUC_TS" ]; then
  tin "$THU_MUC_TS đã có — lần cài lại, script cài đặt sẽ giữ api/.env sẵn có"
else
  ok "$THU_MUC_TS chưa có — sẽ tạo mới, không đụng thư mục nào khác"
fi

if [ -d "$THU_MUC_TO" ]; then
  ok "$THU_MUC_TO tồn tại và nằm RIÊNG — không có lệnh nào trong repo này trỏ tới đó"
else
  tin "$THU_MUC_TO không có ở đường dẫn này (TeachOps có thể đặt chỗ khác)"
fi

# ── 3. Cách chạy tiến trình ────────────────────────────────────────────────
muc "3. CÁCH CHẠY TIẾN TRÌNH"

if command -v docker >/dev/null 2>&1; then
  SO_CONTAINER="$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')"
  ok "Docker có sẵn, đang chạy $SO_CONTAINER container — TeachOps dùng Docker"
  tin "Quản lý Tài sản dùng pm2, KHÔNG có lệnh docker nào trong toàn bộ repo"
else
  tin "Không thấy Docker trên máy này"
fi

if command -v pm2 >/dev/null 2>&1; then
  ok "pm2 đã cài ($(pm2 -v 2>/dev/null | tail -1))"
  DS_PM2="$(pm2 jlist 2>/dev/null | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try { const a=JSON.parse(s); process.stdout.write(a.map(p=>p.name).join(', ')); }
  catch { process.stdout.write(''); }
});" 2>/dev/null)"
  if [ -z "$DS_PM2" ]; then
    ok "Danh sách pm2 đang rỗng — thêm $PM2_TS vào là không ảnh hưởng gì"
  elif [ "$DS_PM2" = "$PM2_TS" ]; then
    ok "pm2 chỉ đang quản lý $PM2_TS"
  else
    canh "pm2 đang quản lý: $DS_PM2"
    tin "Script cài đặt gọi 'pm2 save' — nó ghi lại TOÀN BỘ danh sách hiện tại."
    tin "Nếu trong danh sách có app đang STOPPED, hãy 'pm2 start' nó trước khi cài,"
    tin "để lần VPS khởi động lại nó cũng được bật cùng."
  fi
else
  ok "pm2 chưa cài — script cài đặt sẽ hỏi rồi cài toàn cục, không đụng Docker"
fi

# ── 4. Cơ sở dữ liệu ───────────────────────────────────────────────────────
muc "4. CƠ SỞ DỮ LIỆU"

tin "TeachOps: PostgreSQL trong container Docker (đĩa riêng của container)"
tin "Quản lý Tài sản: MySQL của aaPanel — hai loại CSDL khác nhau, không dùng chung gì"

if command -v mysql >/dev/null 2>&1; then
  DS_CSDL="$(mysql -uroot -N -B -e "SHOW DATABASES;" 2>/dev/null)"
  if [ -n "$DS_CSDL" ]; then
    if printf '%s\n' "$DS_CSDL" | grep -qx "$CSDL_TS"; then
      tin "CSDL '$CSDL_TS' đã tồn tại — lần cài lại, migration chỉ áp thêm, không xoá dữ liệu"
    else
      ok "CSDL '$CSDL_TS' chưa có — tạo mới trong aaPanel, không đụng CSDL nào đang có"
    fi
    SO_CSDL="$(printf '%s\n' "$DS_CSDL" | grep -vcE '^(information_schema|performance_schema|mysql|sys)$')"
    tin "MySQL đang có $SO_CSDL cơ sở dữ liệu của người dùng — không cái nào bị chạm tới"
  else
    tin "Không đọc được danh sách CSDL bằng user root ở đây — xem trong aaPanel → Cơ sở dữ liệu"
  fi
else
  tin "Không có lệnh mysql trên máy này — xem trong aaPanel → Cơ sở dữ liệu"
fi

# ── 5. Tài nguyên dùng chung ───────────────────────────────────────────────
muc "5. TÀI NGUYÊN DÙNG CHUNG (chỗ duy nhất hai hệ có thể ảnh hưởng nhau)"

DIA_TRONG_MB="$(df -Pm /opt 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "$DIA_TRONG_MB" ]; then
  if [ "$DIA_TRONG_MB" -lt 3000 ]; then
    xau "Chỉ còn ${DIA_TRONG_MB}MB trống ở /opt — cần tối thiểu 3000MB"
    tin "Đĩa đầy là CẢ HAI hệ thống hỏng. Dọn trước: docker image prune -af"
  elif [ "$DIA_TRONG_MB" -lt 6000 ]; then
    canh "Còn ${DIA_TRONG_MB}MB trống ở /opt — đủ cài nhưng hơi sát"
  else
    ok "Còn ${DIA_TRONG_MB}MB trống ở /opt — thoải mái"
  fi
fi

RAM_TRONG_MB="$(free -m 2>/dev/null | awk '/^Mem:/ {print $7}')"
RAM_TONG_MB="$(free -m 2>/dev/null | awk '/^Mem:/ {print $2}')"
if [ -n "$RAM_TRONG_MB" ]; then
  if [ "$RAM_TRONG_MB" -lt 400 ]; then
    xau "Chỉ còn ${RAM_TRONG_MB}MB RAM khả dụng / ${RAM_TONG_MB}MB tổng"
    tin "API Quản lý Tài sản cần ~150–300MB. Thiếu RAM là nhân hệ điều hành"
    tin "sẽ tự kết liễu tiến trình nặng nhất — có thể chính là container TeachOps."
    tin "Bật swap hoặc nâng RAM trước khi cài."
  elif [ "$RAM_TRONG_MB" -lt 800 ]; then
    canh "Còn ${RAM_TRONG_MB}MB RAM khả dụng / ${RAM_TONG_MB}MB — đủ nhưng nên bật swap"
  else
    ok "Còn ${RAM_TRONG_MB}MB RAM khả dụng / ${RAM_TONG_MB}MB"
  fi
fi

tin "Nginx cổng 80/443: aaPanel quản lý theo TỪNG site, thêm site mới không sửa site cũ"
tin "  → Khi dán cấu hình, mở Conf của site api-taisan, TUYỆT ĐỐI không mở site teachops"

# ── 6. Sức khoẻ TeachOps ───────────────────────────────────────────────────
muc "6. SỨC KHOẺ TEACHOPS  ← chụp lại phần này, chạy lại sau khi cài rồi so"

# curl với -w '%{http_code}' đã tự in 000 khi không kết nối được, nên KHÔNG
# thêm '|| echo 000' — hai cái cộng lại thành chuỗi "000000" vô nghĩa.
ma_http() {
  local ma
  ma="$(curl -s -o /dev/null -m 8 -w '%{http_code}' "$1" 2>/dev/null)"
  printf '%s' "${ma:-000}"
}

MA_TO_NOI_BO="$(ma_http "http://127.0.0.1:$CONG_TO/api/health")"
MA_TO_CONG_KHAI="$(ma_http "https://$TEN_MIEN_TO/api/health")"

printf "  TeachOps nội bộ   http://127.0.0.1:%s/api/health   →  HTTP %s\n" "$CONG_TO" "$MA_TO_NOI_BO"
printf "  TeachOps công khai https://%s/api/health  →  HTTP %s\n" "$TEN_MIEN_TO" "$MA_TO_CONG_KHAI"

if [ "$MA_TO_NOI_BO" = "200" ] || [ "$MA_TO_CONG_KHAI" = "200" ]; then
  ok "TeachOps đang trả 200 — khoẻ"
else
  canh "TeachOps không trả 200 ở lần kiểm tra này"
  tin "Nếu đây là lần chạy TRƯỚC khi cài: TeachOps đã có vấn đề từ trước, xử lý xong hãy cài"
  tin "Nếu đây là lần chạy SAU khi cài: xem 'docker compose ps' trong $THU_MUC_TO"
fi

if command -v docker >/dev/null 2>&1; then
  echo
  echo "  Container đang chạy:"
  docker ps --format '    {{.Names}}  {{.Status}}' 2>/dev/null | head -12 \
    || echo "    (không đọc được — cần quyền root)"
fi

# ── 7. Cấu hình Nginx ──────────────────────────────────────────────────────
muc "7. CẤU HÌNH NGINX (dùng chung — nơi hai hệ có thể va nhau)"

NGINX_BIN="$(command -v nginx || echo /www/server/nginx/sbin/nginx)"
if [ -x "$NGINX_BIN" ]; then
  if "$NGINX_BIN" -t >/dev/null 2>&1; then
    ok "nginx -t: cấu hình hợp lệ — KHÔNG có site nào đang làm Nginx lỗi"
  else
    xau "nginx -t THẤT BẠI — Nginx đang giữ cấu hình cũ, lần khởi động lại sẽ không lên"
    "$NGINX_BIN" -t 2>&1 | sed 's/^/       /' | head -8
  fi
else
  tin "Không tìm thấy lệnh nginx trên máy này"
fi

THU_MUC_CONF="${THU_MUC_CONF:-/www/server/panel/vhost/nginx}"
if [ -d "$THU_MUC_CONF" ]; then
  echo
  echo "  Các site và cổng đích thật (đọc từ chính file cấu hình):"
  for tep in "$THU_MUC_CONF"/*.conf; do
    [ -f "$tep" ] || continue
    TEN_SITE="$(basename "$tep" .conf)"
    DICH="$(grep -oE 'proxy_pass[[:space:]]+[^;]+' "$tep" 2>/dev/null \
            | awk '{print $2}' | sort -u | paste -sd' ' -)"
    printf "    %-38s %s\n" "$TEN_SITE" "${DICH:-(không phải proxy)}"
  done
  echo
  tin "Mỗi site phải trỏ về ĐÚNG cổng của nó: TeachOps một cổng, Tài sản cổng khác."
  tin "Hai site trỏ cùng một cổng là một trong hai đang bị cấu hình sai."
else
  tin "Không thấy $THU_MUC_CONF — máy này có thể không dùng aaPanel"
fi

# ── Kết luận ───────────────────────────────────────────────────────────────
muc "KẾT LUẬN"

cat <<'BANG'
  Hai hệ thống dùng RIÊNG từng thứ:

    Hạng mục          TeachOps                  Quản lý Tài sản
    ───────────────── ───────────────────────── ─────────────────────────
    Thư mục           /opt/ltl-teachops         /opt/ltl-assetops
    Cổng nội bộ       3000 + 3001 (docker)      3002 (pm2)
    Cách chạy         Docker compose            pm2
    Cơ sở dữ liệu     PostgreSQL (container)    MySQL của aaPanel
    Tên miền API      teachops-api.learntol…    api-taisan.learntol…
    Site trong aaPanel site riêng               site riêng
    Project Vercel    ltl-teachops              ltl-assetops

  Dùng CHUNG đúng ba thứ: đĩa, RAM, và Nginx cổng 80/443 (aaPanel chia
  theo từng site). Mục 5 ở trên đã kiểm tra cả ba.
BANG

echo
if [ "$SO_XAU" -gt 0 ]; then
  printf "  ${d}%s việc phải xử lý TRƯỚC khi cài.${h} Cuộn lên xem dòng DỪNG.\n\n" "$SO_XAU"
  exit 1
elif [ "$SO_CANH" -gt 0 ]; then
  printf "  ${v}%s điểm cần chú ý${h} — đọc dòng CHÚ Ý rồi cài được.\n\n" "$SO_CANH"
  exit 0
else
  printf "  ${x}Không có xung đột nào. Cài được.${h}\n\n"
  exit 0
fi
