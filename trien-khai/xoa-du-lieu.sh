#!/usr/bin/env bash
#
# XOÁ DỮ LIỆU để nhập bộ dữ liệu thật. Chạy TRÊN VPS:
#
#   bash trien-khai/xoa-du-lieu.sh nghiep-vu
#   bash trien-khai/xoa-du-lieu.sh tru-tai-khoan
#   bash trien-khai/xoa-du-lieu.sh toan-bo
#
# Ba mức, chọn đúng mức mình cần:
#
#   nghiep-vu      (mặc định, an toàn nhất)
#                  Xoá: thiết bị, nhật ký di chuyển, yêu cầu, ảnh, tài liệu,
#                  biên bản, kiểm kê, báo hỏng, phiếu linh kiện, wiki, audit.
#                  GIỮ: tài khoản, điểm lưu trữ, danh mục, lý do thay linh kiện.
#                  → Dùng khi danh mục và điểm trường đã đúng, chỉ cần thay
#                    danh sách thiết bị.
#
#   tru-tai-khoan  Xoá thêm: điểm lưu trữ, danh mục, dòng giải pháp, lý do.
#                  GIỮ: tài khoản (để còn đăng nhập được).
#                  → Dùng khi muốn dựng lại danh mục từ đầu theo dữ liệu của mình.
#
#   toan-bo        Xoá sạch mọi bảng, KỂ CẢ tài khoản, rồi tự nạp lại bộ nền
#                  (danh mục + điểm lưu trữ + 5 tài khoản mẫu) để không bị khoá
#                  cửa — hệ thống KHÔNG có trang tự đăng ký, mất hết tài khoản
#                  là không còn đường vào.
#
# Script BẮT BUỘC có bản sao lưu mới trước khi xoá, và bắt gõ đúng tên CSDL.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"
do_xanh='\033[0;32m'; do_vang='\033[0;33m'; do_do='\033[0;31m'; do_het='\033[0m'
buoc() { printf "\n${do_xanh}▶ %s${do_het}\n" "$1"; }
canh() { printf "${do_vang}! %s${do_het}\n" "$1"; }
loi()  { printf "${do_do}✗ %s${do_het}\n" "$1" >&2; }

MUC="${1:-nghiep-vu}"
case "$MUC" in
  nghiep-vu|tru-tai-khoan|toan-bo) ;;
  *) loi "Mức không hợp lệ: $MUC. Nhận: nghiep-vu | tru-tai-khoan | toan-bo"; exit 1 ;;
esac

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
sql() { mysql --defaults-extra-file="$CAU_HINH" "$DB_NAME" "$@"; }

# ------------------------------------------------------- bảng theo từng mức
# Thứ tự không quan trọng vì tắt kiểm khoá ngoại rồi TRUNCATE, nhưng vẫn xếp
# theo nghiệp vụ cho người đọc dễ soát.
BANG_NGHIEP_VU=(
  audit_logs alerts
  wiki_revisions wiki_docs wiki_items wiki_links wiki_articles
  part_issues
  inventory_count_items inventory_counts
  handover_note_items handover_notes
  request_items requests
  movements
  photos kiosk_settings
  assets
  document_sequences
  refresh_tokens gps_override_codes
)
BANG_DANH_MUC=(locations asset_categories product_lines part_replacement_reasons)
BANG_TAI_KHOAN=(users)

case "$MUC" in
  nghiep-vu)     BANG=("${BANG_NGHIEP_VU[@]}") ;;
  tru-tai-khoan) BANG=("${BANG_NGHIEP_VU[@]}" "${BANG_DANH_MUC[@]}") ;;
  toan-bo)       BANG=("${BANG_NGHIEP_VU[@]}" "${BANG_DANH_MUC[@]}" "${BANG_TAI_KHOAN[@]}") ;;
esac

# ---------------------------------------------------------------- xác nhận
buoc "Sắp xoá"
echo "  CSDL      : $DB_NAME @ $DB_HOST:$DB_PORT"
echo "  Mức       : $MUC"
echo "  Số bảng   : ${#BANG[@]}"
echo
printf '  Số dòng hiện có:\n'
for b in "${BANG[@]}"; do
  n="$(sql -N -B -e "SELECT COUNT(*) FROM \`$b\`;" 2>/dev/null || echo '?')"
  [ "$n" != "0" ] && printf '    %-28s %8s\n' "$b" "$n"
done
echo
case "$MUC" in
  nghiep-vu)     echo "  GIỮ LẠI   : tài khoản, điểm lưu trữ, danh mục, lý do thay linh kiện" ;;
  tru-tai-khoan) echo "  GIỮ LẠI   : tài khoản" ;;
  toan-bo)       canh "XOÁ CẢ TÀI KHOẢN — sau đó tự nạp lại bộ nền để còn đăng nhập được." ;;
esac

# --------------------------------------------------- bắt buộc có sao lưu mới
buoc "Kiểm tra bản sao lưu"
MOI_NHAT=""
if [ -d sao-luu ]; then
  MOI_NHAT="$(ls -1 sao-luu 2>/dev/null | sort | tail -1)"
fi
CAN_SAO_LUU=1
if [ -n "$MOI_NHAT" ] && [ -f "sao-luu/$MOI_NHAT/csdl.sql.gz" ]; then
  TUOI=$(( ($(date +%s) - $(stat -c %Y "sao-luu/$MOI_NHAT/csdl.sql.gz")) / 60 ))
  echo "  Bản gần nhất: $MOI_NHAT (${TUOI} phút trước)"
  [ "$TUOI" -le 30 ] && CAN_SAO_LUU=0
fi
if [ "$CAN_SAO_LUU" = 1 ]; then
  canh "Chưa có bản sao lưu nào trong 30 phút qua — sao lưu ngay bây giờ."
  bash trien-khai/sao-luu.sh
  MOI_NHAT="$(ls -1 sao-luu | sort | tail -1)"
fi
BAN_SAO_LUU="$MOI_NHAT"

# ----------------------------------------------------------------- hỏi lại
buoc "Xác nhận"
echo "  Xoá xong, hoàn tác bằng:  bash trien-khai/hoan-tac.sh $BAN_SAO_LUU"
echo
printf "  Gõ đúng tên CSDL '%s' để xoá (Enter để thôi): " "$DB_NAME"
read -r TRA_LOI
if [ "$TRA_LOI" != "$DB_NAME" ]; then
  loi "Không khớp — KHÔNG xoá gì cả."
  exit 1
fi

# ------------------------------------------------------------------- xoá
buoc "Xoá dữ liệu"
{
  echo "SET FOREIGN_KEY_CHECKS = 0;"
  for b in "${BANG[@]}"; do echo "TRUNCATE TABLE \`$b\`;"; done
  echo "SET FOREIGN_KEY_CHECKS = 1;"
} | sql
echo "  ✓ đã xoá ${#BANG[@]} bảng"

# Ảnh và tài liệu trên đĩa: DỜI sang thư mục sao lưu chứ không xoá thẳng, để
# còn đường lấy lại nếu quyết định sai.
if [ -d "$DUONG_ANH" ] && [ -n "$(ls -A "$DUONG_ANH" 2>/dev/null)" ]; then
  KHO_CU="$GOC/sao-luu/$BAN_SAO_LUU/uploads-da-doi-ra"
  mkdir -p "$KHO_CU"
  mv "$DUONG_ANH"/* "$KHO_CU"/ 2>/dev/null || true
  echo "  ✓ dời ảnh và tài liệu cũ sang $KHO_CU (chưa xoá khỏi đĩa)"
fi

# --------------------------------------------- nạp lại bộ nền nếu cần thiết
if [ "$MUC" = "toan-bo" ]; then
  buoc "Nạp lại bộ nền (không có bước này là khoá cửa vĩnh viễn)"
  # SEED_CHI_NEN=1: chỉ danh mục + điểm lưu trữ + tài khoản. KHÔNG nạp 30 thiết
  # bị mẫu — xoá sạch để nhập dữ liệu thật rồi lại đổ mẫu vào thì vô nghĩa.
  SEED_CHI_NEN=1 npm run seed
fi

buoc "Xong"
sql -N -B -e "
  SELECT CONCAT('  users=', (SELECT COUNT(*) FROM users),
                '  assets=', (SELECT COUNT(*) FROM assets),
                '  locations=', (SELECT COUNT(*) FROM locations),
                '  categories=', (SELECT COUNT(*) FROM asset_categories));"
echo
echo "  Nạp lại API cho sạch bộ nhớ đệm:"
echo "    cd api && pm2 reload ecosystem.config.cjs --update-env && cd .."
echo
echo "  HOÀN TÁC:  bash trien-khai/hoan-tac.sh $BAN_SAO_LUU"
