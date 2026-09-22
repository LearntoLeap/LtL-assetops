#!/usr/bin/env bash
#
# HOÀN TÁC — trả CSDL và ảnh về đúng trạng thái một bản sao lưu.
#
#   bash trien-khai/hoan-tac.sh                  # xem các bản có sẵn
#   bash trien-khai/hoan-tac.sh 20260922-101530   # trả về bản này
#
# Trước khi ghi đè, script tự sao lưu trạng thái HIỆN TẠI một lần nữa — nên
# hoàn tác cũng hoàn tác lại được, không có nước đi nào một chiều.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"
do_xanh='\033[0;32m'; do_vang='\033[0;33m'; do_do='\033[0;31m'; do_het='\033[0m'
buoc() { printf "\n${do_xanh}▶ %s${do_het}\n" "$1"; }
canh() { printf "${do_vang}! %s${do_het}\n" "$1"; }
loi()  { printf "${do_do}✗ %s${do_het}\n" "$1" >&2; }

BAN="${1:-}"
if [ -z "$BAN" ]; then
  echo "Các bản sao lưu có sẵn:"
  if [ -d sao-luu ]; then
    for d in $(ls -1 sao-luu 2>/dev/null | sort -r); do
      [ -f "sao-luu/$d/csdl.sql.gz" ] || continue
      printf '  %-20s %8s   %s\n' "$d" \
        "$(du -h "sao-luu/$d/csdl.sql.gz" | cut -f1)" \
        "$(head -1 "sao-luu/$d/thong-tin.txt" 2>/dev/null || echo '')"
    done
  else
    echo "  (chưa có bản nào)"
  fi
  echo
  echo "Dùng:  bash trien-khai/hoan-tac.sh <mốc-thời-gian>"
  exit 0
fi

NGUON="$GOC/sao-luu/$BAN"
[ -f "$NGUON/csdl.sql.gz" ] || { loi "Không thấy $NGUON/csdl.sql.gz"; exit 1; }

[ -f api/.env ] || { loi "Chưa có api/.env."; exit 1; }
URL="$(grep -E '^DATABASE_URL=' api/.env | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
KHONG_SCHEME="${URL#mysql://}"; KHONG_SCHEME="${KHONG_SCHEME%%\?*}"
THONG_TIN_DN="${KHONG_SCHEME%@*}"; MAY_VA_DB="${KHONG_SCHEME##*@}"
DB_USER="${THONG_TIN_DN%%:*}"; DB_PASS="${THONG_TIN_DN#*:}"
DB_HOST="${MAY_VA_DB%%:*}"; CON_LAI="${MAY_VA_DB#*:}"
DB_PORT="${CON_LAI%%/*}"; DB_NAME="${CON_LAI##*/}"
DB_PASS="$(printf '%b' "${DB_PASS//%/\\x}")"

THU_MUC_ANH="$(grep -E '^UPLOAD_DIR=' api/.env | head -1 | cut -d= -f2- | tr -d '"'"'"'' || true)"
THU_MUC_ANH="${THU_MUC_ANH:-./uploads}"
case "$THU_MUC_ANH" in /*) DUONG_ANH="$THU_MUC_ANH" ;; *) DUONG_ANH="$GOC/api/${THU_MUC_ANH#./}" ;; esac

CAU_HINH="$(mktemp)"; chmod 600 "$CAU_HINH"
trap 'rm -f "$CAU_HINH"' EXIT
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' \
  "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" > "$CAU_HINH"

buoc "Sắp hoàn tác"
echo "  Về bản  : $BAN"
echo "  CSDL    : $DB_NAME @ $DB_HOST:$DB_PORT"
sed -n '1,4p' "$NGUON/thong-tin.txt" 2>/dev/null | sed 's/^/  /'
echo
printf "  Gõ đúng tên CSDL '%s' để hoàn tác (Enter để thôi): " "$DB_NAME"
read -r TRA_LOI
[ "$TRA_LOI" = "$DB_NAME" ] || { loi "Không khớp — KHÔNG thay đổi gì."; exit 1; }

buoc "Sao lưu trạng thái hiện tại trước khi ghi đè"
bash trien-khai/sao-luu.sh >/dev/null
TRUOC_DO="$(ls -1 sao-luu | sort | tail -1)"
echo "  ✓ trạng thái trước khi hoàn tác đã lưu ở sao-luu/$TRUOC_DO"

buoc "Nạp lại CSDL"
# Bản kết xuất đã có sẵn DROP TABLE cho từng bảng nên nạp thẳng là đủ; tắt kiểm
# khoá ngoại để thứ tự bảng trong file không thành vấn đề.
{
  echo "SET FOREIGN_KEY_CHECKS = 0;"
  echo "SET UNIQUE_CHECKS = 0;"
  gunzip -c "$NGUON/csdl.sql.gz"
  echo "SET UNIQUE_CHECKS = 1;"
  echo "SET FOREIGN_KEY_CHECKS = 1;"
} | mysql --defaults-extra-file="$CAU_HINH" --default-character-set=utf8mb4 "$DB_NAME"
echo "  ✓ đã nạp csdl.sql.gz"

buoc "Nạp lại ảnh và tài liệu"
if [ -f "$NGUON/uploads.tgz" ]; then
  mkdir -p "$DUONG_ANH"
  # Dọn thư mục hiện tại trước, không trộn file của hai thời điểm.
  rm -rf "${DUONG_ANH:?}"/*
  tar -xzf "$NGUON/uploads.tgz" -C "$(dirname "$DUONG_ANH")"
  echo "  ✓ đã nạp uploads.tgz"
else
  canh "Bản này không có uploads.tgz — giữ nguyên ảnh hiện tại."
fi

buoc "Xong"
mysql --defaults-extra-file="$CAU_HINH" -N -B "$DB_NAME" -e "
  SELECT CONCAT('  users=', (SELECT COUNT(*) FROM users),
                '  assets=', (SELECT COUNT(*) FROM assets),
                '  locations=', (SELECT COUNT(*) FROM locations),
                '  categories=', (SELECT COUNT(*) FROM asset_categories));"
echo
echo "  Nạp lại API:"
echo "    cd api && pm2 reload ecosystem.config.cjs --update-env && cd .."
echo
echo "  Muốn quay lại trạng thái TRƯỚC khi hoàn tác:"
echo "    bash trien-khai/hoan-tac.sh $TRUOC_DO"
