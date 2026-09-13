# LtL Quản lý Tài sản & Kho thiết bị

Hệ thống quản lý tài sản/thiết bị nội bộ — **Công ty CP Công nghệ Giáo dục Learn to Leap**.

Quản lý theo **mã thiết bị duy nhất**, mọi lần xuất/nhập kho đều phải có **yêu cầu đã duyệt**
và **ảnh chụp thực tế**, tồn kho **luôn suy ra từ nhật ký giao dịch**, mọi thay đổi đều vào
**nhật ký thao tác bất biến**.

> Đây là hệ thống **độc lập**, không liên quan tới ứng dụng LtL TeachOps ở `server/` và `web/`
> của thư mục gốc. Hai bên chạy riêng, CSDL riêng, deploy riêng.

## Kiến trúc

```
taisan/
  api/       Node.js + Express + TypeScript + Prisma (MySQL 8)   → VPS, pm2, cổng 3001
  web/       React 18 + Vite + TypeScript + Tailwind + shadcn/ui → Vercel hoặc serve tĩnh
  shared/    @ltl/taisan-shared — enum + nhãn tiếng Việt dùng chung cho api và web
```

npm workspaces: chỉ cần `npm install` một lần ở `taisan/` là đủ cho cả ba.

## Trạng thái theo giai đoạn

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 1 | Monorepo, lược đồ Prisma đầy đủ, migration, dữ liệu mẫu, README | ✅ Xong |
| 2 | Auth JWT, phân quyền middleware, quản lý người dùng, khoá GPS vai trò KHO | ✅ Xong |
| 3 | CRUD thiết bị/địa điểm, import–export Excel, sinh & quét QR | ✅ Xong |
| 4 | Yêu cầu → duyệt → xuất/nhập kho, upload ảnh, movements, audit log, Socket.IO | ✅ Xong |
| 5 | BBBG (sinh, in, PDF, xác nhận), kiểm kê, báo hỏng | ⏳ Chưa |
| 6 | Giao diện KIOSK, màn hình Tablet, dashboard, hoàn thiện UI | ⏳ Chưa |

---

## Chạy tại máy (local)

Yêu cầu: **Node ≥ 20**, **MySQL 8** đang chạy.

### 1. Tạo cơ sở dữ liệu

```sql
CREATE DATABASE ltl_taisan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ltl_taisan'@'localhost' IDENTIFIED BY 'mat_khau_cua_ban';
GRANT ALL PRIVILEGES ON ltl_taisan.* TO 'ltl_taisan'@'localhost';
FLUSH PRIVILEGES;
```

`utf8mb4` là bắt buộc — toàn bộ dữ liệu là tiếng Việt có dấu.

### 2. Cài phụ thuộc và cấu hình

```bash
cd taisan
npm install

cp api/.env.example api/.env
cp web/.env.example web/.env
```

Mở `api/.env` và điền:

- `DATABASE_URL` — chuỗi kết nối MySQL vừa tạo.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — sinh bằng:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- `SEED_ADMIN_PASSWORD` — mật khẩu khởi tạo cho 5 tài khoản mẫu (tối thiểu 8 ký tự).

### 3. Tạo bảng và nạp dữ liệu mẫu

```bash
npm run migrate:deploy    # áp migration đã có sẵn trong api/prisma/migrations
npm run seed              # 7 dòng giải pháp, 8 loại, 6 điểm lưu trữ, 5 tài khoản, 30 thiết bị
```

Lệnh `seed` **chạy lại được nhiều lần**: dữ liệu danh mục được upsert theo mã, và nhật ký di
chuyển chỉ sinh cho thiết bị chưa có nhật ký — nên chạy lại trên CSDL đã dùng thật sẽ không
làm sai tồn kho.

Cuối lệnh seed sẽ in bảng tồn kho **suy ra từ `movements`** để đối chiếu bằng mắt:

```
    - Kho văn phòng Learn to Leap: 22 mã, tổng 976 đơn vị
    - Trường Tiểu học Minh Khai:    4 mã, tổng 203 đơn vị
    - Trường THCS Quang Trung:      3 mã, tổng  22 đơn vị
    - Trường Liên cấp Sao Mai:      1 mã, tổng   1 đơn vị
    - Đối tác ADC Việt Nam:         1 mã, tổng   1 đơn vị
    - Kho sự kiện ROBOG:            1 mã, tổng   1 đơn vị
```

### 4. Chạy

```bash
npm run dev:api           # http://localhost:3001
npm run dev:web           # http://localhost:5173
```

Kiểm tra nhanh:

```bash
curl http://localhost:3001/api/health       # API còn sống
curl http://localhost:3001/api/health/db    # có nối được CSDL chưa (503 nếu chưa)
```

> **Định vị cần HTTPS.** `navigator.geolocation` của trình duyệt chỉ chạy trên
> HTTPS hoặc `localhost`. Chạy local thì dùng đúng `http://localhost:5173`
> (không phải IP LAN), còn khi deploy thật thì web **buộc phải có HTTPS**, nếu
> không tài khoản kho sẽ không lấy được vị trí để đăng nhập.

### 5. Tài khoản mẫu

Cả 5 tài khoản dùng chung mật khẩu đặt ở `SEED_ADMIN_PASSWORD`.

| Email | Vai trò | Phạm vi |
|---|---|---|
| `admin@learntoleap.vn` | `ADMIN` | Toàn quyền, kể cả tạo/khoá tài khoản và cấu hình GPS kho |
| `vanhanh@learntoleap.vn` | `VAN_HANH` | Như ADMIN, trừ tạo/xoá tài khoản và xoá dữ liệu lịch sử |
| `kho@learntoleap.vn` | `KHO` | Máy đặt tại kho; nhập liệu, quét mã, chụp ảnh, in BBBG |
| `nhansu@learntoleap.vn` | `NHAN_SU` | Tạo yêu cầu, xem thiết bị mình đang giữ, báo hỏng |
| `truong.minhkhai@learntoleap.vn` | `TRUONG` | Chỉ dữ liệu của Trường TH Minh Khai |

Đổi email tài khoản ADMIN bằng `SEED_ADMIN_EMAIL` trước khi seed.

**Không có trang/API tự đăng ký.** Mọi tài khoản do ADMIN tạo trong trang quản trị (GĐ 2).
Tài khoản mẫu được đặt `mustChangePassword = false` để kiểm thử ngay; tài khoản thật do
ADMIN tạo sẽ mặc định bắt buộc đổi mật khẩu ở lần đăng nhập đầu.

---

## Triển khai trên VPS (pm2 + aaPanel)

VPS **chưa có Docker** — toàn bộ chạy trực tiếp bằng Node + pm2.

### 1. Chuẩn bị trên VPS

```bash
node -v                       # cần ≥ 20
sudo npm install -g pm2
```

Trong aaPanel: tạo cơ sở dữ liệu MySQL `ltl_taisan` (bảng mã **utf8mb4**) và một user riêng.

### 2. Lấy mã nguồn và build

```bash
cd /www/wwwroot
git clone <repo> ltl-taisan && cd ltl-taisan/taisan
npm ci
cp api/.env.example api/.env && nano api/.env      # điền DATABASE_URL, JWT_*, SEED_ADMIN_PASSWORD
npm run build                                       # build shared → api → web
```

### 3. Tạo bảng và dữ liệu khởi tạo

```bash
npm run migrate:deploy
npm run seed
```

> `migrate:deploy` chỉ **áp thêm** migration, không bao giờ xoá dữ liệu. Không dùng
> `prisma migrate dev` hay `prisma migrate reset` trên VPS.

### 4. Thư mục ảnh

```bash
mkdir -p api/uploads && chmod 750 api/uploads
```

Ảnh lưu trong `api/uploads/<năm>/<tháng>/`, **chỉ truy cập qua API có xác thực** — không
được trỏ reverse proxy hay web server trực tiếp vào thư mục này.

### 5. Chạy bằng pm2

```bash
cd api
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # chạy dòng lệnh pm2 in ra để tự khởi động cùng VPS
pm2 logs ltl-taisan-api
```

Cập nhật về sau:

```bash
cd /www/wwwroot/ltl-taisan && git pull
cd taisan && npm ci && npm run build && npm run migrate:deploy
pm2 restart ltl-taisan-api
```

### 6. Reverse proxy trên aaPanel

Tạo site cho tên miền API (ví dụ `api.tenmiencuaban.vn`), bật SSL (Let's Encrypt), rồi vào
**Website → Site đó → Reverse proxy → Add reverse proxy**:

| Mục | Giá trị |
|---|---|
| Proxy name | `ltl-taisan-api` |
| Target URL | `http://127.0.0.1:3001` |
| Send domain | `$host` |

Trong phần cấu hình Nginx của proxy, bảo đảm có các dòng sau — cần cho IP thật khi ghi log
đăng nhập, cho upload ảnh 10MB, và cho Socket.IO ở giai đoạn 4:

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Ảnh tối đa 10MB/tệp — để dư cho nhiều ảnh một lần gửi
client_max_body_size 25m;

# WebSocket cho Socket.IO (giai đoạn 4)
proxy_http_version 1.1;
proxy_set_header Upgrade    $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 300s;
```

API đã bật `trust proxy`, nên `X-Forwarded-For` được dùng để lấy IP thật.

### 7. Cấu hình khoá vị trí cho tài khoản kho (bắt buộc)

Đăng nhập bằng tài khoản `ADMIN` → **Khoá vị trí kho** → chọn kho → bấm
*Lấy toạ độ máy này* ngay tại kho (hoặc nhập tay toạ độ) → đặt bán kính → **Lưu**.

Kho **chưa có toạ độ thì tài khoản kho của nó không đăng nhập được** — chặn chủ
động để không ai lọt qua khi thiếu cấu hình. Dữ liệu mẫu có toạ độ giả, phải
cấu hình lại theo kho thật.

GPS trong nhà thường lệch 50–200m; bán kính mặc định 150m. Khi nhân viên kho
không vào được vì GPS lệch, ADMIN cấp **mã vượt quyền dùng một lần** ở cùng
trang đó — mã chỉ hiện một lần, hệ thống chỉ lưu bản băm.

### 8. Web

**Cách A — Vercel.** Trong Vercel: *Root Directory* = `taisan`, *Build Command* =
`npm run build:web`, *Output Directory* = `web/dist`. Biến môi trường:
`VITE_API_URL = https://api.tenmiencuaban.vn`.

**Cách B — serve tĩnh trên VPS.** `npm run build:web` rồi trỏ site aaPanel vào
`taisan/web/dist`, thêm rewrite cho SPA:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### 9. Sau khi deploy, kiểm tra

```bash
curl https://api.tenmiencuaban.vn/api/health
curl https://api.tenmiencuaban.vn/api/health/db     # phải trả ok:true
```

Vào `CORS_ORIGINS` trong `api/.env` thêm tên miền web thật, rồi `pm2 restart ltl-taisan-api`.

---

## Xác thực & phân quyền (giai đoạn 2)

### Endpoint

| Method | Đường dẫn | Ai gọi được |
|---|---|---|
| POST | `/api/auth/dang-nhap` | công khai (vai trò KHO phải gửi kèm `viTri`) |
| POST | `/api/auth/lam-moi` | công khai (cần refresh token còn hiệu lực) |
| POST | `/api/auth/dang-xuat` | đã đăng nhập |
| GET | `/api/auth/toi` | đã đăng nhập |
| POST | `/api/auth/doi-mat-khau` | đã đăng nhập |
| GET | `/api/nguoi-dung` | `ADMIN`, `VAN_HANH` |
| POST | `/api/nguoi-dung` | **chỉ `ADMIN`** |
| PATCH | `/api/nguoi-dung/:id` | `ADMIN`, `VAN_HANH` (không chạm tài khoản ADMIN) |
| POST | `/api/nguoi-dung/:id/khoa` | `ADMIN`, `VAN_HANH` (không chạm tài khoản ADMIN) |
| POST | `/api/nguoi-dung/:id/dat-lai-mat-khau` | `ADMIN`, `VAN_HANH` (không chạm tài khoản ADMIN) |
| DELETE | `/api/nguoi-dung/:id` | **chỉ `ADMIN`**, và chỉ khi chưa có dữ liệu lịch sử |
| GET | `/api/dia-diem` | đã đăng nhập — **lọc theo phạm vi vai trò** |
| PATCH | `/api/dia-diem/:id/gps` | **chỉ `ADMIN`** |
| POST/GET/DELETE | `/api/vuot-quyen-gps` | **chỉ `ADMIN`** |

**Không có `POST /api/auth/dang-ky`.** Không có endpoint nào tự tạo tài khoản.

### Phạm vi dữ liệu — kiểm ở server

`api/src/lib/pham-vi.ts` dựng điều kiện `where` theo vai trò; mọi truy vấn danh
sách đều đi qua nó, nên **gọi thẳng API cũng không lấy được dữ liệu ngoài phạm vi**:

| Vai trò | Thấy gì |
|---|---|
| `ADMIN`, `VAN_HANH`, `KHO` | toàn bộ kho (KHO cần tra cứu mọi mã tại quầy) |
| `TRUONG` | chỉ điểm trường của mình |
| `NHAN_SU` | chỉ thiết bị mình đang giữ / yêu cầu mình tạo |

### Những điều đã chốt ở tầng xác thực

- **Quyền đọc lại từ CSDL mỗi lượt gọi API.** ADMIN khoá tài khoản hay đổi vai
  trò thì có hiệu lực **ngay**, không phải chờ access token hết hạn.
- **Refresh token luân chuyển.** Mỗi lần làm mới sẽ thu hồi token cũ và cấp token
  mới. Dùng lại một token đã thu hồi ⇒ coi là **dấu hiệu bị đánh cắp**, hệ thống
  thu hồi toàn bộ phiên của tài khoản đó.
- **Đổi mật khẩu / đặt lại mật khẩu / khoá tài khoản** đều thu hồi mọi phiên đang mở.
- **Access token và refresh token dùng hai khoá bí mật khác nhau**, nên không thể
  dùng token này thay token kia.
- **Không tiết lộ email có tồn tại**: email sai và mật khẩu sai trả về cùng mã lỗi,
  cùng thông điệp.
- **Chặn dò mật khẩu**: 10 lần sai trong 15 phút cho mỗi cặp (email, IP) → HTTP 429.
  Bộ đếm nằm trong bộ nhớ tiến trình — đúng với `exec_mode: fork` + `instances: 1`
  của pm2. **Nếu sau này chạy nhiều tiến trình thì phải chuyển sang Redis.**
- **Tài khoản mới và tài khoản vừa được đặt lại mật khẩu** bị chặn khỏi mọi endpoint
  nghiệp vụ cho tới khi tự đổi mật khẩu (`/api/auth/toi` và đổi mật khẩu vẫn gọi được).
- **Vai trò buộc phải khớp điểm lưu trữ**: `KHO` phải gắn điểm kho, `TRUONG` phải
  gắn điểm trường — gắn sai thì phạm vi dữ liệu sẽ sai theo, nên server từ chối.
- **Không xoá được quản trị viên hoạt động cuối cùng**, và `VAN_HANH` không thao
  tác được trên tài khoản `ADMIN`.

### Token lưu ở đâu — và đánh đổi

Access token (15 phút) và refresh token (30 ngày) trả về trong thân JSON, web lưu
ở `localStorage`.

Chọn cách này vì web deploy trên Vercel còn API trên VPS — **hai tên miền khác
nhau**, cookie `httpOnly` cross-site cần `SameSite=None` + `Secure` và thường
bị trình duyệt chặn. Đánh đổi: lỗ XSS trên web có thể lấy được token. Đã giảm
thiệt hại bằng access token ngắn hạn, refresh token luân chuyển có phát hiện
đánh cắp, và thu hồi phiên ngay khi khoá tài khoản.

**Nếu sau này web được đặt cùng tên miền gốc với API** (ví dụ `taisan.tenmien.vn`
và `api.tenmien.vn`) thì nên chuyển refresh token sang cookie `httpOnly` với
`Domain=.tenmien.vn` — an toàn hơn. Nói một tiếng là chuyển.

## Thiết bị, nhập/xuất Excel và QR (giai đoạn 3)

### Endpoint

| Method | Đường dẫn | Ai gọi được |
|---|---|---|
| GET | `/api/thiet-bi` | đã đăng nhập — **lọc theo phạm vi vai trò** |
| GET | `/api/thiet-bi/ma/:code` | đã đăng nhập — tra cứu theo MÃ (dùng cho quét QR) |
| GET | `/api/thiet-bi/:id` | đã đăng nhập — kèm tồn kho suy ra + nhật ký di chuyển |
| POST | `/api/thiet-bi` | `ADMIN`, `VAN_HANH`, `KHO` |
| PATCH | `/api/thiet-bi/:id` | `ADMIN`, `VAN_HANH`, `KHO` — **chỉ trường mô tả** |
| DELETE | `/api/thiet-bi/:id` | **chỉ `ADMIN`**, và chỉ khi chưa phát sinh nghiệp vụ |
| GET/POST/PATCH/DELETE | `/api/dia-diem` | đọc: đã đăng nhập; ghi: `ADMIN`/`VAN_HANH`; xoá: `ADMIN` |
| GET/POST/PATCH/DELETE | `/api/danh-muc/loai-tai-san` · `/api/danh-muc/dong-giai-phap` | đọc: đã đăng nhập; ghi: `ADMIN`/`VAN_HANH`; xoá: `ADMIN` |
| GET | `/api/nhap-xuat/mau/thiet-bi` · `/mau/dia-diem` | `ADMIN`, `VAN_HANH`, `KHO` |
| POST | `/api/nhap-xuat/xem-truoc/thiet-bi` · `/xem-truoc/dia-diem` | `ADMIN`, `VAN_HANH`, `KHO` |
| POST | `/api/nhap-xuat/ghi/thiet-bi` · `/ghi/dia-diem` | `ADMIN`, `VAN_HANH`, `KHO` |
| GET | `/api/nhap-xuat/xuat/thiet-bi` · `/xuat/dia-diem` | `ADMIN`, `VAN_HANH`, `KHO` |

### Sửa thiết bị KHÔNG đổi được vị trí và trạng thái

`PATCH /api/thiet-bi/:id` cố tình chỉ nhận các trường mô tả (tên, loại, dòng,
serial, nguồn gốc, giá trị, mục đích, ghi chú, ngừng theo dõi). Ba trường
`currentLocationId`, `condition`, `allocationStatus` **không sửa trực tiếp được** —
chúng chỉ đổi qua luồng yêu cầu đã duyệt (giai đoạn 4) hoặc điều chỉnh sau kiểm
kê (giai đoạn 5). Nếu cho sửa thẳng ở đây thì bất kỳ ai có quyền nhập liệu cũng
lách được nguyên tắc "không ai lấy thiết bị ra khỏi kho khi chưa được duyệt".

Tạo thiết bị — dù bằng form hay nhập hàng loạt — đều **sinh kèm một movement
`NHAP_BAN_DAU`** trong cùng transaction, nên tồn kho luôn suy ra được từ gốc.

### Nhập liệu hàng loạt: xem trước rồi mới ghi

Hai bước tách rời, và **ghi là tất cả hoặc không gì cả**:

1. `xem-truoc` đọc file, soát từng dòng, trả về danh sách lỗi `{dòng, cột, thông điệp}`.
   Bước này **không ghi gì** vào CSDL.
2. `ghi` soát lại từ đầu (dữ liệu có thể đã đổi giữa hai lần bấm) rồi chạy trong
   MỘT transaction. Còn một lỗi là **không dòng nào được ghi**, kể cả những dòng đúng.

Một dòng có **bất kỳ lỗi nào** đều không được coi là hợp lệ, nên `số dòng hợp lệ`
cộng `số dòng lỗi` luôn bằng tổng số dòng — không có dòng vừa báo lỗi vừa được ghi.

Mã trùng bị chặn ở cả hai hướng: trùng trong **chính file** (báo rõ trùng với dòng nào)
và trùng với **dữ liệu đã có** trong hệ thống.

File mẫu có sẵn sheet **Hướng dẫn** liệt kê mã loại tài sản, mã dòng giải pháp,
mã điểm lưu trữ hiện có và các giá trị hợp lệ cho từng cột chọn — người điền
không phải đoán.

Cột enum trong file nhận **nhãn tiếng Việt** ("Nhập từ IPP", "Tốt", "Theo số lượng")
và cũng nhận mã ASCII; so khớp bỏ dấu và không phân biệt hoa thường.

### Nhãn QR

Nội dung mã QR là **đúng mã thiết bị**, không nhúng URL — nhãn dán lên thiết bị
không chết khi đổi tên miền, và quét bằng app nào cũng ra mã.

Sinh QR chạy ngay trên trình duyệt (thư viện `qrcode`), nên in vài trăm nhãn cũng
không gọi server lần nào. Trang in có 3 cỡ nhãn (38×25, 50×30, 70×40mm), đặt được
số bản mỗi mã, và dùng `@media print` để chỉ in vùng nhãn trên khổ A4.

Quét QR bằng camera ưu tiên **BarcodeDetector** của trình duyệt (Chrome/Edge và
Chrome Android — đúng loại máy kiosk và tablet tại kho), tự rơi sang **jsQR** khi
trình duyệt không hỗ trợ (Safari/iOS). Camera chỉ chạy trên HTTPS hoặc `localhost`.

### Ô trống trong biểu mẫu

Biểu mẫu HTML gửi ô trống thành chuỗi rỗng chứ không bỏ trường đi, nên lược đồ
phân biệt rõ:

- khi **tạo mới**: chuỗi rỗng = "không điền";
- khi **sửa**: chuỗi rỗng = "xoá giá trị", còn bỏ hẳn trường mới là "giữ nguyên".

Nhờ vậy xoá được số điện thoại nhập nhầm, thay vì bấm lưu mà không có gì xảy ra.

## Luồng yêu cầu, xuất/nhập kho và ảnh (giai đoạn 4)

### Vòng đời một yêu cầu

```
Nháp ──gửi duyệt──► Chờ duyệt ──duyệt──► Đã duyệt ──xuất/nhập kho──► Đã hoàn tất
                        │                                │
                        └──từ chối──► Từ chối             └─(phân bổ/luân chuyển)─► Đã xuất
                                                              (chờ bên nhận xác nhận — GĐ5)
```

### Ba chốt chặn khi hoàn tất xuất/nhập kho

Cả ba đều nằm ở **service phía server**, không phải ở giao diện:

1. **Phải đã duyệt.** Yêu cầu chưa ở trạng thái `DA_DUYET` thì API trả 422
   `CHUA_DUOC_DUYET` — không thứ gì rời kho (nguyên tắc bất biến #2).
2. **Phải có ảnh chụp thực tế.** Mỗi dòng thiết bị bắt buộc ít nhất một ảnh, đúng
   loại (`ANH_XUAT` khi xuất, `ANH_NHAN` khi nhận), và **chưa dùng cho lần
   xuất/nhập nào khác** — không tái sử dụng ảnh cũ (nguyên tắc bất biến #3).
3. **Mã quét phải khớp.** Mã đọc từ nhãn (quét QR hoặc gõ tay) phải trùng mã
   thiết bị trong yêu cầu, nếu không API trả 422 `MA_KHONG_KHOP` — chặn cầm
   nhầm thiết bị.

Màn hình kho khoá nút *Hoàn tất* cho tới khi mọi dòng đủ **mã + ảnh**, nhưng đó
chỉ là tiện lợi: gọi thẳng API vẫn bị chặn y hệt.

### Endpoint

| Method | Đường dẫn | Ai gọi được |
|---|---|---|
| POST/GET | `/api/yeu-cau` | mọi vai trò (danh sách lọc theo phạm vi) |
| GET/PATCH/DELETE | `/api/yeu-cau/:id` | xem theo phạm vi; sửa/xoá chỉ khi còn Nháp |
| POST | `/api/yeu-cau/:id/gui-duyet` | người tạo (hoặc `ADMIN`) |
| POST | `/api/yeu-cau/:id/duyet` · `/tu-choi` | `ADMIN`, `VAN_HANH` — **không ai tự duyệt yêu cầu của mình** |
| POST | `/api/yeu-cau/:id/xuat-kho` · `/nhap-kho` | `ADMIN`, `VAN_HANH`, `KHO` |
| POST | `/api/anh` | đã đăng nhập (nén về WebP ≤1600px) |
| GET | `/api/anh/:id` | đã đăng nhập, **lọc theo phạm vi dữ liệu** |
| GET | `/api/nhat-ky` · `/nhat-ky/canh-bao` | `ADMIN`, `VAN_HANH` — **chỉ đọc** |
| POST | `/api/nhat-ky/canh-bao/:id/xu-ly` | `ADMIN`, `VAN_HANH` |
| GET | `/api/thiet-bi/tra-cuu/:code` | đã đăng nhập — tra cứu rút gọn để lập yêu cầu |

### Vì sao có `/tra-cuu/:code` riêng

Nhân sự phòng ban muốn **mượn** một thiết bị thì phải nhập được mã của nó, mà
thiết bị đó dĩ nhiên chưa thuộc phạm vi dữ liệu của họ. Endpoint này trả vừa đủ
để biết gõ đúng mã (tên, loại, tình trạng, đang ở đâu) — **không** trả giá trị,
tồn kho hay lịch sử, và **không** cho duyệt danh sách toàn kho.

### Thiết bị đi đâu sau khi xuất

| Loại yêu cầu | Movement | Vị trí thiết bị | Trạng thái phân bổ |
|---|---|---|---|
| Xuất kho | kho → điểm đến | đổi sang điểm đến | suy từ loại điểm đến |
| Cho mượn (đối tác) | kho → điểm đối tác | đổi sang điểm đối tác | Cho mượn |
| **Cho mượn (nhân sự)** | kho → `NULL` | **rời điểm lưu trữ**, gắn người giữ | Cho mượn |
| Phân bổ về trường | **chưa ghi** | giữ nguyên | Đang vận chuyển |
| Luân chuyển trường ↔ trường | **chưa ghi** | giữ nguyên | Đang vận chuyển |
| Nhập kho / Trả về kho | vị trí cũ → kho | đổi về kho | Tại kho |

Cho **nhân sự** mượn cũng ghi movement với `to_location_id = NULL`: thiết bị vẫn
là của công ty nhưng **đã rời mạng lưới điểm lưu trữ** — nó nằm trong tay một
người. Nhờ vậy tồn kho tại kho giảm đúng, và phiếu kiểm kê tại kho không đi tìm
một thiết bị đang ở nhà ai đó. Cột `holder_user_id` cho biết đang ở chỗ ai; lúc
trả, movement `NULL → kho` khôi phục tồn.

Phân bổ và luân chuyển **chưa ghi movement lúc xuất** (luồng C): hàng còn trên
đường, quyền sở hữu chỉ đổi khi bên nhận xác nhận biên bản bàn giao — làm ở GĐ5.

### Ảnh

- Nén về WebP, cạnh dài nhất `UPLOAD_MAX_EDGE` (mặc định 1600px), xoay theo EXIF.
  Ảnh điện thoại 4–8MB thường còn vài trăm KB mà vẫn **đọc rõ mã trên nhãn** —
  điểm mấu chốt, vì ảnh là bằng chứng.
- Lưu ở `api/uploads/<năm>/<tháng>/`, tên file ngẫu nhiên, **ngoài thư mục web
  tĩnh**. Chỉ đọc được qua `GET /api/anh/:id` có xác thực và lọc theo phạm vi.
- Web tải ảnh về dạng **blob kèm header Authorization** rồi mới gắn vào `<img>`.
  Cố tình không nhét token vào query string — nginx/aaPanel ghi nguyên URL vào
  access log, token sẽ nằm lù lù trong file log.

### Realtime (Socket.IO)

Dùng **chung cổng** với API nên aaPanel chỉ phải reverse proxy một cổng (nhớ các
dòng `proxy_set_header Upgrade` ở mục reverse proxy phía trên).

Client gửi access token lúc bắt tay; server xác thực, đọc lại vai trò từ CSDL rồi
xếp vào phòng theo vai trò. Server **chỉ phát tín hiệu** (id, mã, trạng thái),
không phát dữ liệu nghiệp vụ — màn hình nhận tín hiệu thì gọi lại API để lấy dữ
liệu đã lọc theo phạm vi. Nhờ vậy realtime không trở thành đường rò dữ liệu.

> `exec_mode: fork` + `instances: 1` trong `ecosystem.config.cjs` là **bắt buộc**
> với Socket.IO: chạy nhiều tiến trình thì sự kiện phát ở tiến trình này không
> tới được client đang nối vào tiến trình kia (cần Redis adapter).

### Cảnh báo tự sinh

| Khi nào | Loại cảnh báo |
|---|---|
| Tình trạng lúc trả khác lúc xuất | `TINH_TRANG_THAY_DOI` (mức Cao nếu Hỏng/Mất) |
| Tài khoản kho đăng nhập ngoài bán kính GPS | `DANG_NHAP_NGOAI_VUNG` |

### Tối ưu giao diện

Các màn hình được **tách gói theo route** (`React.lazy`): mở trang đăng nhập chỉ
tải phần đăng nhập, không kéo theo thư viện QR, ảnh và realtime. Gói khởi động
giảm từ ~470KB xuống ~274KB (89KB sau nén); riêng bộ giải mã QR 135KB chỉ tải khi
vào màn hình có quét mã.

## Lược đồ dữ liệu

19 bảng, xem `api/prisma/schema.prisma` (có chú thích tiếng Việt từng bảng).

**Danh mục** `product_lines` · `asset_categories` · `locations`
**Tài sản** `assets`
**Nghiệp vụ** `requests` · `request_items` · `movements` · `photos` · `handover_notes` ·
`handover_note_items` · `inventory_counts` · `inventory_count_items` · `alerts`
**Hệ thống** `users` · `refresh_tokens` · `gps_override_codes` · `kiosk_settings` ·
`document_sequences` · `audit_logs`

### Bốn quyết định thiết kế cần biết

**1. Tồn kho không có cột nào để lưu.** Tồn của một tài sản tại một địa điểm luôn tính từ
`movements`:

```
tồn(tài sản, địa điểm) = Σ quantity(movement đến) − Σ quantity(movement rời)
```

`from_location_id = NULL` là hàng vào từ ngoài hệ thống, `to_location_id = NULL` là hàng ra
khỏi hệ thống. Hàm dùng sẵn ở `api/src/lib/ton-kho.ts`.

Các cột `assets.current_location_id`, `condition`, `allocation_status`, `holder_user_id`,
`due_return_at` là **hình chiếu trạng thái** để truy vấn nhanh, chỉ được ghi **trong cùng
transaction** với movement sinh ra chúng — không phải nguồn sự thật song song.

**2. Ảnh không gắn cứng vào cột `movements`.** Thay vì hai cột `out_photo_id` / `in_photo_id`,
`photos` có `movement_id` + `kind`: ảnh lúc xuất là `kind = ANH_XUAT`, ảnh lúc nhận là
`kind = ANH_NHAN`. Lý do: một lần xuất/nhập thường nhiều hơn một ảnh, và cách này không tạo
khoá ngoại vòng tròn giữa hai bảng. Ràng buộc “không có ảnh thì không cho hoàn tất” sẽ đặt
ở tầng service (GĐ 4), kiểm ở **server**. Tương tự, “ảnh hiện trạng gần nhất” của thiết bị
được truy ra từ `photos` mới nhất chứ không lưu con trỏ riêng.

**3. Giá trị enum trong CSDL là ASCII, nhãn tiếng Việt nằm ở `shared/`.** CSDL lưu `TAI_KHO`,
giao diện hiển thị “Tại kho”. Lý do: tránh ký tự đặc biệt (`↔`) và dấu trong enum khi dump
SQL/CSV, và đổi cách gọi tên không cần migration. Mọi dữ liệu do người dùng nhập (tên, địa
chỉ, ghi chú, lý do) vẫn là **tiếng Việt có dấu**.

Hai bên không được lệch nhau: `api/src/shared/kiem-tra-enum.ts` là **chốt cửa biên dịch** —
thêm/bớt một giá trị ở một bên mà quên bên kia thì `npm run build` của api báo lỗi và nêu
đúng giá trị đang lệch.

**4. Cho nhân sự mượn khác cho đối tác mượn.** Cho **đối tác** mượn thì có movement sang
điểm `DOI_TAC_MUON` (đổi vị trí thật). Cho **nhân sự nội bộ** mượn thì giữ nguyên
`current_location_id` là kho quản lý, chỉ đổi `allocation_status = CHO_MUON` và gắn
`holder_user_id` — về sở hữu thiết bị vẫn thuộc kho đó. Vì vậy phiếu kiểm kê tại một địa
điểm (GĐ 5) phải loại trừ các thiết bị có `holder_user_id` hoặc đang `DANG_VAN_CHUYEN`.

### Bảng thêm ngoài danh sách tối thiểu

Năm bảng dưới đây không có trong danh sách tối thiểu ban đầu nhưng cần cho các yêu cầu đã
nêu — nếu không muốn giữ bảng nào, nói trước khi sang GĐ 2:

| Bảng | Phục vụ yêu cầu |
|---|---|
| `refresh_tokens` | JWT refresh token thu hồi được khi khoá tài khoản / đăng xuất |
| `gps_override_codes` | “ADMIN cấp được mã vượt quyền dùng một lần” cho khoá GPS |
| `kiosk_settings` | “Đổi được ảnh nền, lưu theo tài khoản” của màn hình KIOSK |
| `alerts` | “Tự tạo cảnh báo cho ADMIN” khi tình trạng đổi, quá hạn trả, chênh lệch kiểm kê |
| `document_sequences` | “Số biên bản tự sinh” không trùng khi hai người bấm cùng lúc |

Báo hỏng dùng luôn `requests` với `type = BAO_HONG` (không thêm bảng ticket riêng).

### Đổi sang PostgreSQL

Sửa **một dòng** trong `api/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // từ "mysql"
  url      = env("DATABASE_URL")
}
```

rồi đổi `DATABASE_URL` sang dạng `postgresql://...` và sinh lại migration:

```bash
rm -rf api/prisma/migrations
cd api && npx prisma migrate dev --name init
```

Lược đồ đã tránh mọi tính năng riêng của MySQL: `Decimal` → `numeric`, `Json` → `jsonb`,
`@db.Text` → `text`, `BigInt` → `bigserial`, enum → native enum type. Câu SQL thô duy nhất
(`api/src/lib/ton-kho.ts`) viết theo chuẩn chung, không backtick. Đã đối chiếu: cả hai
provider đều sinh ra đúng 19 bảng từ lược đồ này.

---

## Lệnh hay dùng

Chạy từ `taisan/`:

| Lệnh | Việc |
|---|---|
| `npm run build` | Build cả ba: shared → api → web |
| `npm run typecheck` | Kiểm kiểu cả ba, không xuất file |
| `npm run dev:api` / `npm run dev:web` | Chạy API / web ở chế độ phát triển |
| `npm run prisma:validate` | Kiểm lược đồ Prisma (không cần CSDL đang chạy) |
| `npm run migrate:deploy` | Áp migration (dùng trên VPS) |
| `npm run seed` | Nạp dữ liệu mẫu (chạy lại được) |

Trong `taisan/api/`: `npm run migrate:dev` (tạo migration mới khi sửa lược đồ),
`npm run migrate:status`, `npm run prisma:format`.

## Quy tắc đóng gói

- Chỉ commit `.env.example` với giá trị trống. **Không bao giờ** commit `.env`.
- Không commit `node_modules/`, `api/uploads/`, `api/dist/`, `web/dist/`, `shared/dist/`,
  `api/logs/`.
- Không có API sửa/xoá bảng `audit_logs`.
