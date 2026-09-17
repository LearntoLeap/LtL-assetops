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

## 0. Chạy thử trên máy mình (trước khi lên VPS)

Cần sẵn Node 20+ và MySQL 8 (hoặc MariaDB 10.6+) đang chạy. Một lệnh — chạy
được trên **Windows (cmd/PowerShell), macOS và Linux**:

```
node trien-khai/chay-thu.mjs
```

Không cần `bash`, không cần lệnh `mysql` trong PATH: cơ sở dữ liệu do Prisma tự
tạo. Script tự thử mật khẩu rỗng rồi `root` cho user `root` của MySQL; nếu máy
đặt mật khẩu khác thì truyền vào:

| Hệ điều hành | Lệnh |
|---|---|
| Windows (cmd) | `set MYSQL_ROOT_PW=matkhau && node trien-khai/chay-thu.mjs` |
| Windows (PowerShell) | `$env:MYSQL_ROOT_PW="matkhau"; node trien-khai/chay-thu.mjs` |
| macOS / Linux | `MYSQL_ROOT_PW=matkhau node trien-khai/chay-thu.mjs` |

Đổi được cả `MYSQL_ROOT_USER`, `MYSQL_HOST`, `MYSQL_PORT` theo cùng cách.
(`bash trien-khai/chay-thu-may-minh.sh` vẫn dùng được — nó chỉ gọi lại tệp trên.)

Script tự tạo CSDL riêng `ltl_taisan_thu`, sinh khoá JWT, nạp 5 tài khoản và 30
thiết bị mẫu, rồi bật API ở cổng 3001 và web ở cổng 5173. Mở
<http://localhost:5173>, đăng nhập bằng một trong năm tài khoản dưới — cả năm
dùng chung mật khẩu **`LtL@2026Test`**:

| Email | Vai trò |
|---|---|
| `admin@learntoleap.vn` | Quản trị — toàn quyền |
| `vanhanh@learntoleap.vn` | Vận hành — duyệt yêu cầu |
| `kho@learntoleap.vn` | Kho — xuất/nhập, màn hình kho |
| `nhansu@learntoleap.vn` | Nhân sự — tạo yêu cầu mượn |
| `truong.minhkhai@learntoleap.vn` | Điểm trường — chỉ dữ liệu trường mình |

`Ctrl+C` để tắt. Chạy lại được nhiều lần, không ghi đè `api/.env` sẵn có.

> Tài khoản **kho** bị khoá theo GPS nên ở máy mình thường bị chặn (toạ độ mẫu
> đặt ở Hà Nội). Đăng nhập bằng `admin`, vào *Thêm → Khoá vị trí kho* để sửa toạ
> độ kho về vị trí của anh/chị, hoặc cấp mã vượt quyền dùng một lần.

## 0b. Cách ly với TeachOps trên cùng VPS

Hai hệ thống chạy song song trên `14.225.206.251` và dùng riêng từng thứ:

| Hạng mục | TeachOps | Quản lý Tài sản |
|---|---|---|
| Thư mục | `/opt/ltl-teachops` | `/opt/ltl-assetops` |
| Cổng nội bộ | `3000` | `3001` |
| Cách chạy tiến trình | Docker compose | pm2 (`ltl-taisan-api`) |
| Cơ sở dữ liệu | PostgreSQL trong container | MySQL của aaPanel (`ltl_taisan`) |
| Tên miền API | `teachops-api.learntoleap.vn` | `api-taisan.learntoleap.vn` |
| Site trong aaPanel | site riêng | site riêng |
| Project Vercel | `ltl-teachops` | `ltl-assetops` |

Dùng chung đúng ba thứ: **đĩa**, **RAM**, và **Nginx cổng 80/443** (aaPanel chia
theo từng site). Toàn bộ repo này không có một lệnh `docker`, `systemctl`,
`apt`, `rm -rf`, `DROP`, hay `prisma migrate reset` nào; bốn thứ duy nhất chạm
ra ngoài thư mục repo là `npm install -g pm2`, `pm2 startup`, `pm2 save`, và —
chỉ khi người dùng chủ động chọn "c" — các câu `CREATE DATABASE`/`CREATE USER`.

Chạy script kiểm tra **trước và sau** khi cài, rồi so phần "SỨC KHOẺ TEACHOPS":

```bash
bash trien-khai/kiem-tra-cach-ly.sh
```

Script **chỉ đọc**, không tạo/sửa/xoá/khởi động lại gì. Nó thoát với mã 1 nếu
gặp xung đột thật (cổng 3001 bị chiếm, thiếu đĩa, thiếu RAM) để chặn lại trước
khi kịp cài.

## 1. API trên VPS

Lần đầu:

```bash
git clone https://github.com/LearntoLeap/LtL-assetops.git
cd LtL-assetops
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
`LearntoLeap/LtL-assetops` với:

| Mục | Giá trị |
|---|---|
| Root Directory | để trống (gốc repo) |
| Framework Preset | Other |
| Build Command | `npm run build:web` (đã có trong `vercel.json`) |
| Output Directory | `web/dist` (đã có trong `vercel.json`) |
| Biến môi trường | không cần đặt — `VITE_API_URL` nằm sẵn trong `vercel.json` |

### Ba project Vercel bị cấu hình sai — và hai tệp vercel.json lồng nhau

Lúc nối repo với Vercel lần đầu đã sinh ra **bốn** project trỏ vào cùng repo này:

| Project | Root Directory | Trạng thái |
|---|---|---|
| `ltl-assetops` | gốc repo | **đúng, đang chạy** |
| `api` | `api` | sai — fail mọi lần push |
| `lt-l-assetops-api` | `api` | sai — fail mọi lần push |
| `web` | `web` | sai — fail mọi lần push |

Ba project sai đặt Build Command là `npm run build:web`, nhưng script đó nằm ở
`package.json` **gốc** repo, không có trong `api/`. Log build nói đúng điều đó:

```
npm error location /vercel/path0/api
npm error Missing script: "build:web"
```

**Cách sửa thật: xoá ba project đó** (project → Settings → cuối trang → Delete
Project). Gói Hobby không cho `pause`, và API không có lệnh xoá project, nên
việc này phải làm trong dashboard.

Trong lúc chưa xoá, `api/vercel.json` và `web/vercel.json` chặn sẵn:

```json
{ "git": { "deploymentEnabled": { "main": false } } }
```

Vercel chỉ đọc **một** `vercel.json` — cái nằm ở Root Directory của project đó.
`ltl-assetops` có Root Directory là gốc repo nên nó đọc `/vercel.json` và
**không** đọc hai tệp trên; ba project sai thì đọc và ngừng deploy. Xoá ba
project rồi thì hai tệp này thành vô hại, xoá đi cũng được.

### Tên miền đang dùng

| Vai trò | Tên miền | Trỏ về |
|---|---|---|
| API | `api-taisan.learntoleap.vn` | bản ghi A → IP của VPS |
| Web | `assetops.learntoleap.vn` (chính) và `ltl-assetops.vercel.app` | Vercel |

`VITE_API_URL` đặt trong `build.env` của `vercel.json`, không phải biến môi
trường trên dashboard — giá trị này không phải bí mật (Vite nhúng thẳng vào
bundle công khai), nên để trong mã nguồn là đúng chỗ và đổi tên miền chỉ cần sửa
một dòng rồi push. Đổi xong **phải deploy lại** vì biến `VITE_` được nhúng lúc
build.

Tên miền web chính là `assetops.learntoleap.vn`: đã thêm vào Vercel (project
`ltl-assetops` → Settings → Domains), và ở PA Vietnam có bản ghi **CNAME** tên
`assetops` trỏ về `cname.vercel-dns.com`.

Lưu ý mỗi project Vercel có một giá trị CNAME riêng — `teacher` trỏ về
`b183fe68714cdcbb.vercel-dns-017.com`, `muahang` trỏ về
`52b97ed206e792cd.vercel-dns-017.com`. **Đừng chép giá trị của project khác.**
`cname.vercel-dns.com` dùng được cho mọi project vì Vercel định tuyến theo
header `Host` chứ không theo đích CNAME.

`taisan.learntoleap.vn` vẫn giữ trong `CORS_ORIGINS` làm dự phòng, nhưng chưa
gắn vào Vercel nên chưa dùng được.

#### Vercel báo "Verification Required" — đừng đi tìm bản ghi TXT

Lần gắn `assetops.learntoleap.vn` đầu tiên, Vercel để trạng thái
`verified: false` kèm yêu cầu một bản ghi TXT tên `_vercel.learntoleap.vn`.
**Bản ghi đó không cần thiết.** Chỉ cần bấm **Refresh** ở dòng tên miền trong
Vercel → project → Domains là Vercel kiểm lại và xác thực qua chính CNAME đang
có. Nguyên nhân: lúc thêm tên miền thì CNAME chưa tồn tại, Vercel kiểm ngay tại
thời điểm đó rồi rơi vào diện phải chứng minh quyền sở hữu.

Đừng mất thời gian với TXT, vì PA Vietnam **không phát được** bản ghi TXT ở host
bắt đầu bằng dấu gạch dưới: bảng điều khiển nhận và hiển thị dòng đó, nhưng hỏi
thẳng hai máy chủ gốc `ns1.pavietnam.vn` (112.213.89.3) và `ns2.pavietnam.vn`
(222.255.121.247) thì `_vercel.learntoleap.vn` trả `NOERROR` với **0 bản ghi ở
mọi loại** — nhãn có trong vùng nhưng rỗng — trong khi nhãn không tồn tại thật
(vd `vercel.learntoleap.vn`) trả `NXDOMAIN`. Tức là hệ thống tạo nhãn mà không
ghi giá trị.

Thứ tự đúng cho tên miền mới: tạo CNAME ở PA Vietnam **trước**, đợi phân giải
được, **rồi** mới thêm tên miền vào Vercel. Làm ngược thì phải bấm Refresh.

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
