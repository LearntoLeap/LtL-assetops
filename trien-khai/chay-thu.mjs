#!/usr/bin/env node
/**
 * CHẠY THỬ TRÊN MÁY MÌNH — một lệnh là dùng được.
 *
 *     node trien-khai/chay-thu.mjs
 *
 * Chạy được trên Windows (cmd / PowerShell), macOS và Linux.
 * Chỉ cần sẵn hai thứ:
 *   1. Node 20 trở lên               → https://nodejs.org
 *   2. MySQL 8 (hoặc MariaDB 10.6+) đang chạy ở máy
 *
 * KHÔNG cần lệnh `mysql` trong PATH: cơ sở dữ liệu do Prisma tự tạo.
 * KHÔNG cần pm2, nginx hay tên miền — khác với trien-khai/cai-dat-vps.sh.
 *
 * Nếu user root của MySQL có mật khẩu thì truyền vào:
 *   Windows (cmd)  : set MYSQL_ROOT_PW=matkhau && node trien-khai/chay-thu.mjs
 *   Windows (PS)   : $env:MYSQL_ROOT_PW="matkhau"; node trien-khai/chay-thu.mjs
 *   macOS / Linux  : MYSQL_ROOT_PW=matkhau node trien-khai/chay-thu.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = join(GOC, 'api');

// Thông số dùng thử — cố định để anh/chị không phải nhập gì.
const TEN_CSDL = 'ltl_taisan_thu';
const MK_THU = 'LtL@2026Test';
const CONG_API = 3001;
const CONG_WEB = 5173;

const MAY_CHU = process.env.MYSQL_HOST ?? '127.0.0.1';
const CONG_SQL = Number(process.env.MYSQL_PORT ?? 3306);
const USER_SQL = process.env.MYSQL_ROOT_USER ?? 'root';

// --- in ra màn hình ---------------------------------------------------------
const ESC = String.fromCharCode(27);
const mau = process.stdout.isTTY && process.platform !== 'win32';
const s = (ma, chu) => (mau ? `${ESC}[${ma}m${chu}${ESC}[0m` : chu);
const buoc = (t) => console.log(`\n${s('32', '>')} ${s('32', t)}`);
const xong = (t) => console.log(`  ${s('32', 'OK')} ${t}`);
const canh = (t) => console.log(`  ${s('33', '!')}  ${t}`);
const loi = (t, ...them) => {
  console.error(`\n  ${s('31', 'LOI')} ${t}`);
  for (const d of them) console.error(`      ${d}`);
  process.exit(1);
};

/** Chạy một lệnh, cho nó in trực tiếp ra màn hình. */
function chay(lenh, dsThamSo, tuyChon = {}) {
  const kq = spawnSync(lenh, dsThamSo, {
    cwd: tuyChon.cwd ?? GOC,
    stdio: 'inherit',
    shell: true, // Windows cần shell để tìm npm.cmd / npx.cmd
    env: { ...process.env, ...(tuyChon.env ?? {}) },
  });
  return kq.status === 0;
}

/** Chạy một lệnh và lấy lại toàn bộ output để tự đọc. */
function chayIm(lenh, dsThamSo, tuyChon = {}) {
  const kq = spawnSync(lenh, dsThamSo, {
    cwd: tuyChon.cwd ?? GOC,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, ...(tuyChon.env ?? {}) },
  });
  return { ok: kq.status === 0, ra: `${kq.stdout ?? ''}${kq.stderr ?? ''}` };
}

const doi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cổng MySQL có ai nghe không — để phân biệt "chưa bật MySQL" với "sai mật khẩu". */
function congMo(host, cong) {
  return new Promise((xongViec) => {
    const o = net.connect({ host, port: cong });
    const dong = (kq) => {
      o.destroy();
      xongViec(kq);
    };
    o.setTimeout(2500);
    o.once('connect', () => dong(true));
    o.once('timeout', () => dong(false));
    o.once('error', () => dong(false));
  });
}

const khoa = () => randomBytes(48).toString('base64url');

/** Ghép DATABASE_URL; mật khẩu phải mã hoá vì có thể chứa @ : / ... */
const duongDanCsdl = (mk) =>
  `mysql://${encodeURIComponent(USER_SQL)}:${encodeURIComponent(mk)}@${MAY_CHU}:${CONG_SQL}/${TEN_CSDL}`;

// ===========================================================================
// 1. Kiểm tra máy
// ===========================================================================
buoc('Kiểm tra máy');

if (Number(process.versions.node.split('.')[0]) < 20) {
  loi(
    `Cần Node 20 trở lên (máy đang có ${process.version}).`,
    'Tải bản LTS mới nhất tại https://nodejs.org rồi chạy lại lệnh này.',
  );
}
xong(`Node ${process.version}`);

if (!(await congMo(MAY_CHU, CONG_SQL))) {
  loi(
    `Không thấy MySQL nào đang chạy ở ${MAY_CHU}:${CONG_SQL}.`,
    'Windows : mở XAMPP / Laragon rồi bấm Start ở dòng MySQL.',
    'macOS   : brew services start mysql',
    'Linux   : sudo systemctl start mysql   (hoặc mariadb)',
    'Nếu MySQL chạy ở cổng khác: đặt biến MYSQL_PORT rồi chạy lại.',
  );
}
xong(`MySQL đang chạy ở ${MAY_CHU}:${CONG_SQL}`);

// ===========================================================================
// 2. Cài phụ thuộc — phải làm trước, vì các bước sau cần Prisma
// ===========================================================================
buoc('Cài phụ thuộc (lần đầu mất vài phút)');
if (!chay('npm', ['install'])) {
  loi('npm install thất bại.', 'Xem thông báo ở trên; thường là do mạng.');
}
xong('Đã cài xong');

buoc('Sinh Prisma Client');
if (!chay('npm', ['run', 'prisma:generate'])) loi('prisma generate thất bại.');
xong('Xong');

// ===========================================================================
// 3. Tạo cơ sở dữ liệu + 19 bảng
//    prisma migrate deploy TỰ TẠO cơ sở dữ liệu nếu chưa có, nên máy không
//    cần có lệnh `mysql` trong PATH.
// ===========================================================================
buoc(`Tạo cơ sở dữ liệu "${TEN_CSDL}" và các bảng`);

/** Nếu api/.env đã có DATABASE_URL thì tôn trọng nó, không tự đoán lại. */
function csdlTuEnv() {
  const tep = join(API, '.env');
  if (!existsSync(tep)) return null;
  const khop = /^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m.exec(readFileSync(tep, 'utf8'));
  return khop?.[1] ?? null;
}

/**
 * Có phải lỗi sai user/mật khẩu không?
 * Prisma gói lỗi của MySQL lại thành mã P1000 kèm "Authentication failed",
 * chỉ thỉnh thoảng mới lộ nguyên văn "Access denied" — nên phải nhận cả ba.
 */
const laLoiMatKhau = (ra) => /P1000|Authentication failed|Access denied/i.test(ra);

const dsMatKhau =
  process.env.MYSQL_ROOT_PW !== undefined ? [process.env.MYSQL_ROOT_PW] : ['', 'root'];
const sanCo = csdlTuEnv();
let duongDan = null;
let loiCuoi = '';

for (const thu of sanCo ? [sanCo] : dsMatKhau.map(duongDanCsdl)) {
  const kq = chayIm('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: API,
    env: { DATABASE_URL: thu },
  });
  if (kq.ok) {
    duongDan = thu;
    break;
  }
  loiCuoi = kq.ra;
  // Sai mật khẩu thì thử tiếp; lỗi khác (không kết nối được, migration hỏng) thì dừng.
  if (!laLoiMatKhau(kq.ra)) break;
}

if (!duongDan) {
  const vetLoi = loiCuoi.trim().split('\n');
  if (sanCo) {
    loi(
      'Không kết nối được bằng DATABASE_URL trong api/.env.',
      'Sửa lại dòng DATABASE_URL trong api/.env, hoặc xoá tệp đó để script tự tạo lại.',
      '',
      ...vetLoi.slice(-6),
    );
  }
  if (laLoiMatKhau(loiCuoi)) {
    loi(
      `User "${USER_SQL}" của MySQL có mật khẩu mà script chưa biết.`,
      'Chạy lại kèm mật khẩu:',
      '  Windows (cmd) : set MYSQL_ROOT_PW=matkhau && node trien-khai/chay-thu.mjs',
      '  Windows (PS)  : $env:MYSQL_ROOT_PW="matkhau"; node trien-khai/chay-thu.mjs',
      '  macOS / Linux : MYSQL_ROOT_PW=matkhau node trien-khai/chay-thu.mjs',
    );
  }
  loi('Tạo cơ sở dữ liệu thất bại.', '', ...vetLoi.slice(-10));
}
xong('Cơ sở dữ liệu và 19 bảng đã sẵn sàng');

// ===========================================================================
// 4. Tệp cấu hình
// ===========================================================================
buoc('Tạo tệp cấu hình');
const tepEnvApi = join(API, '.env');
if (existsSync(tepEnvApi)) {
  canh('api/.env đã có — giữ nguyên, không ghi đè');
} else {
  writeFileSync(
    tepEnvApi,
    [
      `PORT=${CONG_API}`,
      'NODE_ENV=development',
      `DATABASE_URL="${duongDan}"`,
      `JWT_ACCESS_SECRET=${khoa()}`,
      `JWT_REFRESH_SECRET=${khoa()}`,
      'JWT_ACCESS_TTL=15m',
      'JWT_REFRESH_TTL=30d',
      'UPLOAD_DIR=./uploads',
      'UPLOAD_MAX_BYTES=10485760',
      'UPLOAD_MAX_EDGE=1600',
      `CORS_ORIGINS=http://localhost:${CONG_WEB},http://127.0.0.1:${CONG_WEB}`,
      'GPS_DEFAULT_RADIUS_M=150',
      'SEED_ADMIN_EMAIL=admin@learntoleap.vn',
      `SEED_ADMIN_PASSWORD=${MK_THU}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  xong('api/.env');
}
writeFileSync(join(GOC, 'web', '.env'), `VITE_API_URL=http://localhost:${CONG_API}\n`);
xong(`web/.env → API ở http://localhost:${CONG_API}`);
mkdirSync(join(API, 'uploads'), { recursive: true });
mkdirSync(join(API, 'logs'), { recursive: true });

// ===========================================================================
// 5. Dữ liệu mẫu
// ===========================================================================
buoc('Nạp dữ liệu mẫu');

/**
 * Đếm tài khoản NGAY TRONG tiến trình này, không qua `node -e`: chuỗi mã truyền
 * qua shell sẽ bị chính shell ăn mất `$disconnect` (coi `$disconnect` là biến),
 * nên cách đó luôn báo lỗi cú pháp. Ở đây node_modules đã được npm workspaces
 * gom lên gốc nên import từ trien-khai/ vẫn thấy @prisma/client.
 */
async function demTaiKhoan() {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const p = new PrismaClient({ datasourceUrl: duongDan });
    try {
      return await p.user.count();
    } finally {
      await p.$disconnect();
    }
  } catch {
    return null; // null = không đếm được
  }
}

const soTaiKhoan = await demTaiKhoan();
if (soTaiKhoan === null || soTaiKhoan === 0) {
  if (soTaiKhoan === null) canh('Không đếm được số tài khoản — cứ nạp, seed vốn an toàn khi chạy lại.');
  // Seed đọc SEED_ADMIN_* từ api/.env, nhưng truyền thẳng vào đây thì chắc chắn hơn.
  const okSeed = chay('npm', ['run', 'seed'], {
    cwd: API,
    env: {
      DATABASE_URL: duongDan,
      SEED_ADMIN_EMAIL: 'admin@learntoleap.vn',
      SEED_ADMIN_PASSWORD: MK_THU,
    },
  });
  if (!okSeed) loi('Nạp dữ liệu mẫu thất bại.');
  xong('Đã nạp 5 tài khoản và dữ liệu mẫu');
} else {
  xong(`Cơ sở dữ liệu đã có ${soTaiKhoan} tài khoản — bỏ qua bước nạp`);
}

// ===========================================================================
// 6. Bật API rồi bật web
// ===========================================================================
buoc('Bật API');
const tienTrinhApi = spawn('npm', ['run', 'dev:api'], {
  cwd: GOC,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  env: { ...process.env, DATABASE_URL: duongDan },
});
let nhatKyApi = '';
for (const luong of [tienTrinhApi.stdout, tienTrinhApi.stderr]) {
  luong?.on('data', (d) => {
    nhatKyApi = `${nhatKyApi}${d}`.slice(-8000);
  });
}

const tatApi = () => {
  if (!tienTrinhApi.killed) tienTrinhApi.kill();
};
process.on('exit', tatApi);
for (const tinHieu of ['SIGINT', 'SIGTERM']) {
  process.on(tinHieu, () => {
    tatApi();
    process.exit(0);
  });
}

// 401 mới là câu trả lời ĐÚNG: gọi /api/dia-diem mà chưa đăng nhập thì phải bị chặn.
let apiLen = false;
for (let i = 0; i < 60 && !apiLen; i += 1) {
  await doi(1000);
  try {
    const tl = await fetch(`http://127.0.0.1:${CONG_API}/api/dia-diem`);
    if (tl.status === 401) apiLen = true;
  } catch {
    /* chưa lên, thử lại */
  }
}
if (!apiLen) {
  console.error(`\n  ${s('31', 'LOI')} API không lên sau 60 giây. Nhật ký:\n`);
  console.error(nhatKyApi.split('\n').slice(-25).join('\n'));
  process.exit(1);
}
xong(`API đã chạy ở http://localhost:${CONG_API}`);

console.log(`
====================================================================
  MỞ TRÌNH DUYỆT:  http://localhost:${CONG_WEB}

  5 tài khoản dùng thử — chung một mật khẩu:  ${MK_THU}

    admin@learntoleap.vn             Quản trị — toàn quyền
    vanhanh@learntoleap.vn           Vận hành — duyệt yêu cầu
    kho@learntoleap.vn               Kho — xuất/nhập, màn hình kho
    nhansu@learntoleap.vn            Nhân sự — tạo yêu cầu mượn
    truong.minhkhai@learntoleap.vn   Điểm trường — chỉ dữ liệu trường mình

  LƯU Ý về tài khoản kho@: đăng nhập bị khoá theo GPS. Dữ liệu mẫu đặt
  kho ở Hà Nội, nên ngồi chỗ khác sẽ BỊ CHẶN — đúng như thiết kế.
  Cách thử: đăng nhập admin@ → "Thêm" → "Khoá vị trí kho" → sửa toạ độ
  kho về chỗ anh/chị đang ngồi, hoặc cấp mã vượt quyền dùng một lần.

  Bấm Ctrl+C để tắt cả API và web.
====================================================================
`);

buoc('Bật web');
const tienTrinhWeb = spawn('npm', ['run', 'dev:web'], { cwd: GOC, stdio: 'inherit', shell: true });
tienTrinhWeb.on('exit', (ma) => {
  tatApi();
  process.exit(ma ?? 0);
});
