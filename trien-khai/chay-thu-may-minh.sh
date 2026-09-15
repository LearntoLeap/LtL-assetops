#!/usr/bin/env bash
#
# CHẠY THỬ TRÊN MÁY MÌNH — bản bọc ngoài cho trien-khai/chay-thu.mjs.
#
#   bash trien-khai/chay-thu-may-minh.sh
#
# Toàn bộ việc thật nằm trong chay-thu.mjs (viết bằng Node nên chạy được cả
# trên Windows, không cần bash và không cần lệnh `mysql`). Tệp này chỉ giữ lại
# cho quen tay; trên Windows hãy gọi trực tiếp:
#
#   node trien-khai/chay-thu.mjs
set -euo pipefail
GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$GOC/trien-khai/chay-thu.mjs" "$@"
