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
| 2 | Auth JWT, phân quyền middleware, quản lý người dùng, khoá GPS vai trò KHO | ⏳ Chưa |
| 3 | CRUD thiết bị/địa điểm, import–export Excel, sinh & quét QR | ⏳ Chưa |
| 4 | Yêu cầu → duyệt → xuất/nhập kho, upload ảnh, movements, audit log, Socket.IO | ⏳ Chưa |
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

### 7. Web

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

### 8. Sau khi deploy, kiểm tra

```bash
curl https://api.tenmiencuaban.vn/api/health
curl https://api.tenmiencuaban.vn/api/health/db     # phải trả ok:true
```

Vào `CORS_ORIGINS` trong `api/.env` thêm tên miền web thật, rồi `pm2 restart ltl-taisan-api`.

---

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
