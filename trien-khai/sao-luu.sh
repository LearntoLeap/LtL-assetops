#!/usr/bin/env bash
#
# SAO LƯU toàn bộ dữ liệu — chạy TRƯỚC mọi thao tác xoá.
#
#   bash trien-khai/sao-luu.sh
#
# Tạo một thư mục theo mốc thời gian trong sao-luu/ gồm:
#   csdl.sql.gz   — toàn bộ CSDL (mysqldump)
#   uploads.tgz   — toàn bộ ảnh và tài liệu trên đĩa
#   thong-tin.txt — số dòng từng bảng lúc sao lưu, để đối chiếu khi hoàn tác
#
# Đây là cái duy nhất cho phép HOÀN TÁC. Không có nó thì xoá là mất thật.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"
do_xanh='\033[0;32m'; do_vang='\033[0;33m'; do_het='\033[0m'
buoc() { printf "\n${do_xanh}▶ %s${do_het}\n" "$1"; }
canh() { printf "${do_vang}! %s${do_het}\n" "$1"; }

[ -f api/.env ] || { echo "Chưa có api/.env." >&2; exit 1; }

# ---------------------------------------------------------------- đọc cấu hình
# Lấy DATABASE_URL từ api/.env mà KHÔNG source cả file (tránh chạy phải lệnh lạ).
URL="$(grep -E '^DATABASE_URL=' api/.env | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
[ -n "$URL" ] || { echo "Không đọc được DATABASE_URL trong api/.env." >&2; exit 1; }

# mysql://user:pass@host:port/db  — mật khẩu có thể chứa @ nên cắt từ dấu @ CUỐI.
KHONG_SCHEME="${URL#mysql://}"
KHONG_SCHEME="${KHONG_SCHEME%%\?*}"
THONG_TIN_DN="${KHONG_SCHEME%@*}"
MAY_VA_DB="${KHONG_SCHEME##*@}"
DB_USER="${THONG_TIN_DN%%:*}"
DB_PASS="${THONG_TIN_DN#*:}"
DB_HOST="${MAY_VA_DB%%:*}"
CON_LAI="${MAY_VA_DB#*:}"
DB_PORT="${CON_LAI%%/*}"
DB_NAME="${CON_LAI##*/}"

# URL-decode mật khẩu (Prisma đòi mã hoá %40 cho @, %23 cho #…).
DB_PASS="$(printf '%b' "${DB_PASS//%/\\x}")"

THU_MUC_ANH="$(grep -E '^UPLOAD_DIR=' api/.env | head -1 | cut -d= -f2- | tr -d '"'"'"'' || true)"
THU_MUC_ANH="${THU_MUC_ANH:-./uploads}"
case "$THU_MUC_ANH" in /*) DUONG_ANH="$THU_MUC_ANH" ;; *) DUONG_ANH="$GOC/api/${THU_MUC_ANH#./}" ;; esac

MOC="$(date +%Y%m%d-%H%M%S)"
DICH="$GOC/sao-luu/$MOC"
mkdir -p "$DICH"

echo "CSDL : $DB_NAME @ $DB_HOST:$DB_PORT"
echo "Ảnh  : $DUONG_ANH"
echo "Lưu về: $DICH"

# Truyền mật khẩu qua file cấu hình tạm, không đặt trên dòng lệnh (dòng lệnh
# hiện trong `ps` cho mọi người trên máy thấy).
CAU_HINH="$(mktemp)"
chmod 600 "$CAU_HINH"
trap 'rm -f "$CAU_HINH"' EXIT
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' \
  "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" > "$CAU_HINH"

buoc "Đếm số dòng từng bảng (để đối chiếu khi hoàn tác)"
# ĐẾM BẰNG COUNT(*), KHÔNG dùng information_schema.table_rows: với InnoDB cột đó
# chỉ là SỐ ƯỚC LƯỢNG lấy từ thống kê chỉ mục, có thể lệch cả chục phần trăm khi
# thống kê cũ. Đã gặp thật: bảng audit_logs báo 257 dòng trong khi thực có 298.
# File này dùng để đối chiếu sau khi hoàn tác nên sai một dòng là mất tác dụng.
BANG_TAT_CA="$(mysql --defaults-extra-file="$CAU_HINH" -N -B "$DB_NAME" -e "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name;")"
{
  echo "Sao lưu lúc: $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "CSDL: $DB_NAME"
  echo "Phiên bản mã nguồn: $(git log --oneline -1 2>/dev/null || echo 'không rõ')"
  echo
  printf '%-28s %10s\n' 'BẢNG' 'SỐ DÒNG'
  for bang in $BANG_TAT_CA; do
    so="$(mysql --defaults-extra-file="$CAU_HINH" -N -B "$DB_NAME" \
      -e "SELECT COUNT(*) FROM \`$bang\`;" 2>/dev/null || echo '?')"
    printf '%-28s %10s\n' "$bang" "$so"
  done
} > "$DICH/thong-tin.txt"
cat "$DICH/thong-tin.txt"

buoc "Kết xuất CSDL"
# --single-transaction: bản kết xuất nhất quán mà không khoá bảng.
# --routines --events --triggers: giữ luôn thủ tục nếu sau này có.
mysqldump --defaults-extra-file="$CAU_HINH" \
  --single-transaction --quick --routines --events --triggers \
  --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -9 > "$DICH/csdl.sql.gz"
echo "  ✓ csdl.sql.gz — $(du -h "$DICH/csdl.sql.gz" | cut -f1)"

buoc "Đóng gói ảnh và tài liệu"
if [ -d "$DUONG_ANH" ]; then
  tar -czf "$DICH/uploads.tgz" -C "$(dirname "$DUONG_ANH")" "$(basename "$DUONG_ANH")"
  echo "  ✓ uploads.tgz — $(du -h "$DICH/uploads.tgz" | cut -f1)"
else
  canh "Không thấy thư mục $DUONG_ANH — bỏ qua phần ảnh."
fi

# Bản kết xuất chứa dữ liệu thật, không để ai khác trên máy đọc được.
chmod -R go-rwx "$DICH"

buoc "Xong"
echo "  Bản sao lưu: $DICH"
echo
echo "  HOÀN TÁC bằng lệnh:"
echo "    bash trien-khai/hoan-tac.sh $MOC"
