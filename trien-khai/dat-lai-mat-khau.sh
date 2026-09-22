#!/usr/bin/env bash
#
# Đặt lại mật khẩu một tài khoản khi không ai đăng nhập được nữa. Chạy TRÊN VPS:
#
#   bash trien-khai/dat-lai-mat-khau.sh                        # xem danh sách
#   bash trien-khai/dat-lai-mat-khau.sh admin@learntoleap.vn 'MatKhauMoi2026'
#
# Hệ thống không có "quên mật khẩu" qua email, và endpoint đặt lại trong trang
# quản trị đòi đăng nhập được trước — nên đây là lối vào cuối cùng.
set -euo pipefail
GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"
[ -f api/.env ] || { echo "Chưa có api/.env." >&2; exit 1; }
# Prisma Client đọc biến môi trường, không tự nạp api/.env.
set -a
# shellcheck disable=SC1091
. api/.env
set +a
exec node trien-khai/dat-lai-mat-khau.mjs "$@"
