#!/usr/bin/env bash
#
# NẠP một bản kết xuất AssetOps vào CSDL của máy này. Chạy TRÊN VPS:
#
#   bash trien-khai/nap-csdl.sh /duong/dan/csdl.sql.gz
#   bash trien-khai/nap-csdl.sh /duong/dan/csdl.sql
#
# Dùng khi đã nhập liệu ở một bản AssetOps khác và muốn đẩy toàn bộ sang đây.
#
# QUAN TRỌNG: bản kết xuất thay THẤY TOÀN BỘ các bảng, kể cả `users`. Sau khi
# nạp, tài khoản đăng nhập là tài khoản CỦA BẢN KẾT XUẤT, không phải tài khoản
# đang có trên máy này. Không nhớ mật khẩu bên đó thì dùng:
#   bash trien-khai/dat-lai-mat-khau.sh <email>
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"
do_xanh='\033[0;32m'; do_vang='\033[0;33m'; do_do='\033[0;31m'; do_het='\033[0m'
buoc() { printf "\n${do_xanh}▶ %s${do_het}\n" "$1"; }
canh() { printf "${do_vang}! %s${do_het}\n" "$1"; }
loi()  { printf "${do_do}✗ %s${do_het}\n" "$1" >&2; }

TEP="${1:-}"
[ -n "$TEP" ] || { loi "Thiếu đường dẫn file. Dùng: bash trien-khai/nap-csdl.sh <file.sql hoặc .sql.gz>"; exit 1; }
[ -f "$TEP" ] || { loi "Không thấy file: $TEP"; exit 1; }
[ -f api/.env ] || { loi "Chưa có api/.env."; exit 1; }

# Đọc file nén hay không nén đều được.
case "$TEP" in
  *.gz) DOC=(gunzip -c "$TEP") ;;
  *)    DOC=(cat "$TEP") ;;
esac

# ------------------------------------------------- soi bản kết xuất TRƯỚC khi nạp
buoc "Soi bản kết xuất"
BANG_TRONG_TEP="$("${DOC[@]}" | grep -oE 'CREATE TABLE `[A-Za-z0-9_]+`' | sed 's/CREATE TABLE //' | tr -d '`' | sort -u || true)"
SO_BANG="$(printf '%s\n' "$BANG_TRONG_TEP" | grep -c . || true)"
echo "  File     : $TEP ($(du -h "$TEP" | cut -f1))"
echo "  Số bảng  : $SO_BANG"

# Bảng dấu hiệu: không có đủ mấy bảng này thì đây không phải bản kết xuất AssetOps.
# Nạp một file lạ vào là hỏng CSDL mà không biết vì sao, nên chặn ngay ở đây.
THIEU=""
for b in users assets locations movements asset_categories; do
  printf '%s\n' "$BANG_TRONG_TEP" | grep -qx "$b" || THIEU="$THIEU $b"
done
if [ -n "$THIEU" ]; then
  loi "File này không giống bản kết xuất AssetOps — thiếu bảng:$THIEU"
  echo "  Các bảng tìm thấy trong file:" >&2
  printf '%s\n' "$BANG_TRONG_TEP" | sed 's/^/    /' >&2
  exit 1
fi
echo "  ✓ có đủ các bảng dấu hiệu của AssetOps"

if printf '%s\n' "$BANG_TRONG_TEP" | grep -qx "_prisma_migrations"; then
  echo "  ✓ có _prisma_migrations — sẽ tự áp các migration còn thiếu sau khi nạp"
  CO_MIGRATION=1
else
  canh "Không có _prisma_migrations. Nếu bản kết xuất cũ hơn mã nguồn hiện tại thì"
  canh "sẽ thiếu bảng mới (wiki…). Sau khi nạp hãy chạy: npm run migrate:deploy"
  CO_MIGRATION=0
fi

# ---------------------------------------------------------------- đọc cấu hình
URL="$(grep -E '^DATABASE_URL=' api/.env | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
KHONG_SCHEME="${URL#mysql://}"; KHONG_SCHEME="${KHONG_SCHEME%%\?*}"
THONG_TIN_DN="${KHONG_SCHEME%@*}"; MAY_VA_DB="${KHONG_SCHEME##*@}"
DB_USER="${THONG_TIN_DN%%:*}"; DB_PASS="${THONG_TIN_DN#*:}"
DB_HOST="${MAY_VA_DB%%:*}"; CON_LAI="${MAY_VA_DB#*:}"
DB_PORT="${CON_LAI%%/*}"; DB_NAME="${CON_LAI##*/}"
DB_PASS="$(printf '%b' "${DB_PASS//%/\\x}")"

CAU_HINH="$(mktemp)"; chmod 600 "$CAU_HINH"
trap 'rm -f "$CAU_HINH"' EXIT
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' \
  "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" > "$CAU_HINH"
sql() { mysql --defaults-extra-file="$CAU_HINH" "$DB_NAME" "$@"; }

buoc "Trạng thái hiện tại của $DB_NAME (sẽ bị THAY HẾT)"
sql -N -B -e "
  SELECT CONCAT('  users=', (SELECT COUNT(*) FROM users),
                '  assets=', (SELECT COUNT(*) FROM assets),
                '  locations=', (SELECT COUNT(*) FROM locations));" 2>/dev/null || echo "  (CSDL còn trống)"
echo
echo "  Tài khoản đang có trên máy này:"
sql -N -B -e "SELECT CONCAT('    ', email, '  [', role, ']') FROM users ORDER BY role;" 2>/dev/null || true

canh "Bản kết xuất sẽ thay TOÀN BỘ các bảng, kể cả tài khoản."
canh "Sau khi nạp, đăng nhập bằng tài khoản CỦA BẢN KẾT XUẤT."

# ------------------------------------------------------- sao lưu rồi xác nhận
buoc "Sao lưu trạng thái hiện tại (đường lùi)"
bash trien-khai/sao-luu.sh >/dev/null
LUI_VE="$(ls -1 sao-luu | sort | tail -1)"
echo "  ✓ đã lưu ở sao-luu/$LUI_VE"

buoc "Xác nhận"
echo "  Nạp xong, lùi lại bằng:  bash trien-khai/hoan-tac.sh $LUI_VE"
echo
printf "  Gõ đúng tên CSDL '%s' để nạp (Enter để thôi): " "$DB_NAME"
read -r TRA_LOI
[ "$TRA_LOI" = "$DB_NAME" ] || { loi "Không khớp — KHÔNG nạp gì cả."; exit 1; }

# ------------------------------------------------------------------ nạp
# XOÁ SẠCH BẢNG CŨ TRƯỚC KHI NẠP — không được bỏ bước này.
#
# mysqldump chỉ sinh `DROP TABLE` cho những bảng CÓ TRONG file. Bảng nào đang
# tồn tại ở đây mà file không có thì sống sót, và hậu quả không chỉ là dữ liệu
# cũ lẫn vào:
#
#   Nạp một bản kết xuất cũ (chưa có nhóm bảng wiki) vào máy đã có wiki →
#   5 bảng wiki còn nguyên, nhưng `_prisma_migrations` lấy theo file lại ghi là
#   migration wiki CHƯA chạy → `migrate deploy` đi tạo `wiki_articles` → lỗi
#   1050 "Table already exists" → CSDL rơi vào trạng thái migration THẤT BẠI,
#   chặn mọi lần cập nhật về sau.
#
# Đã dựng lại đúng lỗi này rồi mới thêm bước xoá. Sau khi xoá sạch, file tự dựng
# lại đúng các bảng của nó, `_prisma_migrations` khớp với lược đồ thật, và
# `migrate deploy` áp đúng những migration còn thiếu.
buoc "Xoá bảng cũ để nạp vào lược đồ trống"
BANG_DANG_CO="$(mysql --defaults-extra-file="$CAU_HINH" -N -B "$DB_NAME" -e "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE';" || true)"
SO_XOA="$(printf '%s\n' "$BANG_DANG_CO" | grep -c . || true)"
if [ "$SO_XOA" -gt 0 ]; then
  {
    echo "SET FOREIGN_KEY_CHECKS = 0;"
    for b in $BANG_DANG_CO; do echo "DROP TABLE IF EXISTS \`$b\`;"; done
    echo "SET FOREIGN_KEY_CHECKS = 1;"
  } | mysql --defaults-extra-file="$CAU_HINH" "$DB_NAME"
  echo "  ✓ đã xoá $SO_XOA bảng cũ (đã có bản sao lưu ở trên)"
else
  echo "  (CSDL đang trống)"
fi

buoc "Nạp bản kết xuất"
{
  echo "SET FOREIGN_KEY_CHECKS = 0;"
  echo "SET UNIQUE_CHECKS = 0;"
  "${DOC[@]}"
  echo "SET UNIQUE_CHECKS = 1;"
  echo "SET FOREIGN_KEY_CHECKS = 1;"
} | mysql --defaults-extra-file="$CAU_HINH" --default-character-set=utf8mb4 "$DB_NAME"
echo "  ✓ đã nạp"

buoc "Áp migration còn thiếu (bản kết xuất có thể cũ hơn mã nguồn)"
if [ "$CO_MIGRATION" = 1 ]; then
  npm run migrate:deploy
else
  canh "Bỏ qua vì file không mang _prisma_migrations — chạy tay nếu cần:"
  canh "  npm run migrate:deploy"
fi

buoc "Kết quả"
sql -N -B -e "
  SELECT CONCAT('  users=', (SELECT COUNT(*) FROM users),
                '  assets=', (SELECT COUNT(*) FROM assets),
                '  locations=', (SELECT COUNT(*) FROM locations),
                '  categories=', (SELECT COUNT(*) FROM asset_categories));"
SO_TK="$(sql -N -B -e "SELECT COUNT(*) FROM users;")"
echo
echo "  Tài khoản đăng nhập được sau khi nạp:"
sql -N -B -e "SELECT CONCAT('    ', email, '  [', role, ']') FROM users ORDER BY role;"

if [ "$SO_TK" = "0" ]; then
  canh "BẢN KẾT XUẤT KHÔNG CÓ TÀI KHOẢN NÀO — không đăng nhập được."
  canh "Nạp lại bộ nền:  SEED_CHI_NEN=1 npm run seed"
fi

echo
echo "  Không nhớ mật khẩu bên bản kết xuất:"
echo "    bash trien-khai/dat-lai-mat-khau.sh <email>"
echo
echo "  Nạp lại API:"
echo "    cd api && pm2 reload ecosystem.config.cjs --update-env && cd .."
echo
echo "  LÙI LẠI:  bash trien-khai/hoan-tac.sh $LUI_VE"
