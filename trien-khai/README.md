# Triển khai

Kiến trúc chạy thật — hai nơi, vì API cần thứ mà máy chủ serverless không có:

```
Người dùng ──► Vercel (web tĩnh)  ──HTTPS──►  VPS: API (pm2) ─► MySQL
                                                      └──────► api/uploads/ (ảnh)
```

| Phần | Chạy ở đâu | Vì sao |
|---|---|---|
| `web/` | Vercel (hoặc VPS) | Bản build tĩnh, chỉ cần `VITE_API_URL` trỏ đúng API |
| `api/` | VPS + pm2 | Socket.IO cần kết nối sống lâu (`exec_mode: fork`) |
| Ảnh | đĩa VPS `api/uploads/` | Đĩa của serverless là tạm, deploy lại là mất ảnh |
| MySQL | VPS | Prisma cần CSDL kết nối được, có sao lưu |

## 1. API trên VPS

Lần đầu:

```bash
git clone https://github.com/LearntoLeap/ltl-taisan.git
cd ltl-taisan
bash trien-khai/cai-dat-vps.sh
```

Script sẽ hỏi tên CSDL, user/mật khẩu MySQL, hai tên miền, email và mật khẩu quản
trị; tự sinh hai khoá JWT; build; tạo bảng; hỏi có nạp dữ liệu mẫu không; rồi
khởi động pm2. **Chạy lại được nhiều lần** và không bao giờ ghi đè `api/.env`
hay xoá dữ liệu đang có.

Sau đó vào aaPanel: reverse proxy tên miền API về `http://127.0.0.1:3001`, dán
thêm phần trong [`nginx-api.conf`](./nginx-api.conf) — **thiếu ba dòng
Upgrade/Connection là Socket.IO không nối được** — rồi bật SSL.

Lần sau, mỗi khi có mã mới:

```bash
bash trien-khai/cap-nhat-vps.sh
```

## 2. Web trên Vercel

`vercel.json` ở gốc repo đã cấu hình sẵn. Trong Vercel, tạo project từ repo
`LearntoLeap/ltl-taisan` với:

| Mục | Giá trị |
|---|---|
| Root Directory | để trống (gốc repo) |
| Framework Preset | Other |
| Build Command | `npm run build:web` (đã có trong `vercel.json`) |
| Output Directory | `web/dist` (đã có trong `vercel.json`) |
| Biến môi trường | không cần đặt — `VITE_API_URL` nằm sẵn trong `vercel.json` |

### Tên miền đang dùng

| Vai trò | Tên miền | Trỏ về |
|---|---|---|
| API | `api-taisan.learntoleap.vn` | bản ghi A → IP của VPS |
| Web | `ltl-assetops.vercel.app` (tạm) và `taisan.learntoleap.vn` | Vercel |

`VITE_API_URL` đặt trong `build.env` của `vercel.json`, không phải biến môi
trường trên dashboard — giá trị này không phải bí mật (Vite nhúng thẳng vào
bundle công khai), nên để trong mã nguồn là đúng chỗ và đổi tên miền chỉ cần sửa
một dòng rồi push. Đổi xong **phải deploy lại** vì biến `VITE_` được nhúng lúc
build.

Muốn dùng `taisan.learntoleap.vn`: vào Vercel → project `ltl-assetops` →
Settings → Domains → thêm tên miền, rồi tạo bản ghi DNS theo hướng dẫn Vercel
hiện ra.

`CORS_ORIGINS` trong `api/.env` phải chứa **đúng** origin của web (script đã để
sẵn cả hai). Sai origin là trình duyệt chặn mọi lời gọi API, dù API vẫn chạy.

## Kiểm tra sau khi lên

```bash
curl -i https://api.tenmien.vn/api/dia-diem     # phải là 401
pm2 logs ltl-taisan-api --lines 30
```

Rồi mở web, đăng nhập bằng tài khoản quản trị vừa đặt.

> **Tài khoản kho bị khoá theo vị trí.** Vào *Thêm → Khoá vị trí kho* bằng tài
> khoản quản trị để đặt toạ độ và bán kính của kho thật trước khi giao máy cho
> nhân viên kho. Máy chủ tính khoảng cách và quyết định, không phải trình duyệt.
