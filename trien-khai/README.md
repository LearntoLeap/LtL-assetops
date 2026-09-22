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

---

## Xoá dữ liệu để nhập bộ dữ liệu thật

Ba script đi cùng nhau. **Luôn chạy trên VPS, từ thư mục gốc của repo.**

| Script | Việc |
|---|---|
| `sao-luu.sh` | Kết xuất CSDL + đóng gói ảnh/tài liệu vào `sao-luu/<mốc>/`. Đây là cái duy nhất cho phép hoàn tác. |
| `xoa-du-lieu.sh <mức>` | Xoá dữ liệu. Tự sao lưu trước nếu chưa có bản nào trong 30 phút, và bắt gõ đúng tên CSDL. |
| `hoan-tac.sh [mốc]` | Trả về đúng một bản sao lưu. Không tham số thì liệt kê các bản có sẵn. |

### Ba mức xoá

```bash
bash trien-khai/xoa-du-lieu.sh nghiep-vu       # mặc định
bash trien-khai/xoa-du-lieu.sh tru-tai-khoan
bash trien-khai/xoa-du-lieu.sh toan-bo
```

- **`nghiep-vu`** — xoá thiết bị, nhật ký di chuyển, yêu cầu, ảnh, tài liệu, biên bản,
  kiểm kê, báo hỏng, phiếu linh kiện, wiki, audit log, số chứng từ.
  **Giữ** tài khoản, điểm lưu trữ, danh mục, lý do thay linh kiện.
  → Dùng khi danh mục và điểm trường đã đúng, chỉ cần thay danh sách thiết bị.
- **`tru-tai-khoan`** — xoá thêm điểm lưu trữ, danh mục, dòng giải pháp, lý do.
  **Giữ** tài khoản.
  → Dùng khi muốn dựng lại toàn bộ danh mục theo dữ liệu của mình.
- **`toan-bo`** — xoá sạch mọi bảng kể cả tài khoản, rồi tự nạp lại **bộ nền**
  (`SEED_CHI_NEN=1`: danh mục + điểm lưu trữ + 5 tài khoản, **không** có thiết bị mẫu).
  Bước nạp lại là bắt buộc: hệ thống không có trang tự đăng ký, mất hết tài khoản
  là không còn đường đăng nhập.

### Những điều script tự lo

- **Không xoá khi chưa có bản sao lưu.** Chưa có bản nào trong 30 phút thì tự chạy
  `sao-luu.sh` trước.
- **Bắt gõ đúng tên CSDL** mới xoá — gõ "y" hay Enter đều không chạy.
- **Ảnh và tài liệu trên đĩa được DỜI, không xoá**, sang `sao-luu/<mốc>/uploads-da-doi-ra/`.
- **Hoàn tác cũng hoàn tác lại được**: `hoan-tac.sh` tự sao lưu trạng thái hiện tại
  trước khi ghi đè, rồi in ra mốc để quay lại.
- Mật khẩu CSDL truyền qua file cấu hình tạm `chmod 600`, không đặt trên dòng lệnh
  (dòng lệnh hiện trong `ps` cho mọi người trên máy thấy).

### Trình tự nên làm

```bash
cd /opt/ltl-assetops
bash trien-khai/sao-luu.sh                     # 1. chốt một bản để lùi về
bash trien-khai/xoa-du-lieu.sh nghiep-vu       # 2. xoá, gõ tên CSDL để xác nhận
cd api && pm2 reload ecosystem.config.cjs --update-env && cd ..   # 3. nạp lại API
# 4. nhập dữ liệu thật qua trang "Nhập hàng loạt" (Excel) hoặc thêm từng mã
```

Sai thì:

```bash
bash trien-khai/hoan-tac.sh          # xem các bản có sẵn
bash trien-khai/hoan-tac.sh <mốc>    # lùi về bản đó
```

### Dựng hệ thống mới cho dữ liệu thật ngay từ đầu

```bash
SEED_CHI_NEN=1 npm run seed
```

Có danh mục, điểm lưu trữ và tài khoản để đăng nhập, nhưng danh sách thiết bị để
trống — không phải đi xoá 30 thiết bị mẫu.

### Đã kiểm thật

Chạy đủ vòng trên CSDL thật (MySQL, 27 bảng, 34 thiết bị, 25 ảnh, 2 bài wiki):
sao lưu → xoá `toan-bo` → hoàn tác. Đối chiếu **bằm SHA-256 nội dung từng bảng**,
không chỉ đếm dòng: **27/27 bảng khớp tuyệt đối**, 27 file ảnh/tài liệu khớp SHA tổng.
Gõ sai tên CSDL thì không bảng nào bị chạm. Sau khi xoá, đăng nhập và cả 9 endpoint
chính đều trả 200 trên CSDL rỗng.

---

## Nạp một bản kết xuất AssetOps từ máy khác

Khi đã nhập liệu ở một bản AssetOps khác và muốn đẩy toàn bộ sang VPS:

```bash
cd /opt/ltl-assetops
bash trien-khai/nap-csdl.sh /duong/dan/csdl.sql.gz
cd api && pm2 reload ecosystem.config.cjs --update-env && cd ..
```

Script tự làm, theo thứ tự:

1. **Soi file trước khi chạm vào CSDL** — đếm bảng, kiểm 5 bảng dấu hiệu
   (`users`, `assets`, `locations`, `movements`, `asset_categories`). Không đủ thì
   **từ chối ngay**, không nạp một file lạ vào rồi hỏng mà không biết vì sao.
2. In trạng thái hiện tại và **danh sách tài khoản đang có**, kèm cảnh báo là
   chúng sắp bị thay.
3. **Sao lưu** trạng thái hiện tại (đường lùi).
4. Bắt gõ đúng tên CSDL.
5. **Xoá sạch bảng cũ** rồi mới nạp — xem lý do ở dưới.
6. Chạy `migrate deploy` để nâng lược đồ lên bản mới nhất nếu file kết xuất cũ hơn
   mã nguồn.
7. In danh sách tài khoản **đăng nhập được sau khi nạp**.

### Vì sao phải xoá sạch bảng cũ trước khi nạp

`mysqldump` chỉ sinh `DROP TABLE` cho những bảng **có trong file**. Bảng nào đang
tồn tại trên máy mà file không có thì sống sót — và hậu quả không chỉ là dữ liệu cũ
lẫn vào:

> Nạp một bản kết xuất cũ (chưa có nhóm bảng `wiki_*`) vào máy đã có wiki →
> 5 bảng wiki còn nguyên, nhưng `_prisma_migrations` lấy theo file lại ghi là
> migration wiki **chưa** chạy → `migrate deploy` đi tạo `wiki_articles` → lỗi
> MySQL 1050 *"Table already exists"* → CSDL rơi vào **trạng thái migration thất
> bại, chặn mọi lần cập nhật về sau**.

Đã dựng lại đúng lỗi này trong lúc thử rồi mới thêm bước xoá. Sau khi xoá sạch,
file tự dựng lại đúng các bảng của nó, `_prisma_migrations` khớp với lược đồ thật,
và `migrate deploy` áp đúng những migration còn thiếu.

### Tài khoản sau khi nạp

Bản kết xuất thay **toàn bộ** các bảng, **kể cả `users`**. Nên sau khi nạp, tài
khoản đăng nhập là tài khoản **của bản kết xuất**, không phải tài khoản đang có
trên VPS. Không giữ lại được một bên: mọi bảng đều trỏ khoá ngoại tới `users.id`
của bản kết xuất.

## Đặt lại mật khẩu khi không ai đăng nhập được

```bash
bash trien-khai/dat-lai-mat-khau.sh                                  # xem danh sách
bash trien-khai/dat-lai-mat-khau.sh admin@learntoleap.vn 'MatKhau2026'
```

Đây là **lối vào cuối cùng**: hệ thống không có trang tự đăng ký, không có "quên
mật khẩu" qua email, và endpoint đặt lại trong trang quản trị đòi phải đăng nhập
được trước. Mất mật khẩu ADMIN là mất hẳn đường vào nếu không có script này.

- Dùng đúng hàm băm của ứng dụng (bcrypt 12 vòng) nên mật khẩu đặt ở đây đăng nhập
  được y như đặt trong giao diện.
- Cùng chính sách mật khẩu với giao diện: tối thiểu 8 ký tự, có cả chữ và số.
- **Mở khoá** tài khoản luôn nếu đang bị khoá, và **thu hồi mọi phiên cũ**.
- Đổi mật khẩu lại trong giao diện sau khi vào được — mật khẩu gõ trên dòng lệnh
  nằm trong lịch sử shell của máy chủ.

### Đã kiểm thật

- Nạp file lạ (không phải AssetOps) → **từ chối**, không chạm vào CSDL.
- Nạp bản kết xuất **cũ hơn** (22 bảng, chưa có wiki) → xoá 27 bảng cũ, nạp,
  `migrate deploy` áp migration wiki → 27 bảng, `migrate status` báo *up to date*,
  dữ liệu của bản kết xuất còn nguyên (5 tài khoản, 34 thiết bị), bảng wiki mới
  tạo và rỗng, 9/9 endpoint trả 200.
- Đặt lại mật khẩu → mật khẩu mới đăng nhập được (200), mật khẩu cũ bị từ chối (401).
- CSDL đang ở trạng thái migration thất bại → `hoan-tac.sh` cứu lại được.
