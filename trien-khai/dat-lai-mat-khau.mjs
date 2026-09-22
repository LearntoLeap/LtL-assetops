/**
 * Đặt lại mật khẩu một tài khoản TỪ DÒNG LỆNH — lối vào cuối cùng khi không ai
 * đăng nhập được nữa.
 *
 * Hệ thống không có trang tự đăng ký và không có chức năng "quên mật khẩu" qua
 * email; endpoint đặt lại mật khẩu trong trang quản trị đòi PHẢI đăng nhập được
 * trước. Nên nếu mất mật khẩu ADMIN (ví dụ vừa nạp một bản kết xuất từ máy khác)
 * thì không còn đường nào vào — script này bù đúng chỗ đó.
 *
 * Dùng chung hàm băm của ứng dụng (bcrypt 12 vòng) để mật khẩu đặt ở đây đăng
 * nhập được y như đặt trong giao diện.
 *
 *   node trien-khai/dat-lai-mat-khau.mjs                      # liệt kê tài khoản
 *   node trien-khai/dat-lai-mat-khau.mjs <email> <mật khẩu>
 */
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/api/`);
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

// Giống hằng SO_VONG trong api/src/lib/mat-khau.ts.
const SO_VONG = 12;
const DAI_TOI_THIEU = 8;

const prisma = new PrismaClient();

function thoat(ma) {
  return prisma.$disconnect().finally(() => process.exit(ma));
}

/**
 * In lỗi gọn một dòng.
 *
 * Prisma ném kèm cả thân thư viện đã rút gọn — hàng trăm KB mã trôi qua màn
 * hình. Script này chạy đúng lúc đang hoảng vì không ai vào được hệ thống, nên
 * chỉ in điều cần biết và cách xử lý.
 */
function inLoiGon(loi) {
  const chu = loi instanceof Error ? loi.message : String(loi);
  if (/Can't reach database server/i.test(chu)) {
    const may = /at `([^`]+)`/.exec(chu)?.[1] ?? 'máy chủ CSDL';
    console.error(`✗ Không kết nối được CSDL tại ${may}.`);
    console.error('  Kiểm tra MySQL đang chạy và DATABASE_URL trong api/.env.');
    return;
  }
  if (/Authentication failed|Access denied/i.test(chu)) {
    console.error('✗ Sai tài khoản hoặc mật khẩu CSDL trong api/.env.');
    return;
  }
  if (/Unknown database|does not exist/i.test(chu)) {
    console.error('✗ CSDL chưa tồn tại. Chạy:  npm run migrate:deploy');
    return;
  }
  if (/Table .* doesn't exist|P2021/i.test(chu)) {
    console.error('✗ CSDL chưa có bảng. Chạy:  npm run migrate:deploy');
    return;
  }
  // Lỗi kiểm tra của Prisma mở đầu bằng dòng trống, nên phải lấy dòng có nội
  // dung đầu tiên; lấy `split('\n')[0]` sẽ in ra dấu ✗ trơ trọi không nói gì.
  const dongDau = chu.split('\n').map((d) => d.trim()).find((d) => d.length > 0);
  console.error(`✗ ${dongDau ?? 'Lỗi không rõ.'}`);
  if (chu.length > (dongDau?.length ?? 0) + 2) {
    console.error('  Chi tiết:');
    for (const d of chu.split('\n').slice(0, 12)) if (d.trim()) console.error(`    ${d.trim()}`);
  }
}

const [email, matKhau] = process.argv.slice(2);

async function chay() {
if (!email) {
  const ds = await prisma.user.findMany({
    select: { email: true, fullName: true, role: true, isLocked: true },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  });
  if (ds.length === 0) {
    console.log('Không có tài khoản nào trong CSDL.');
    console.log('Nạp bộ nền:  SEED_CHI_NEN=1 npm run seed');
  } else {
    console.log(`${ds.length} tài khoản:\n`);
    for (const t of ds) {
      console.log(
        `  ${t.email.padEnd(34)} ${t.role.padEnd(9)} ${t.fullName}${t.isLocked ? '  [ĐANG BỊ KHOÁ]' : ''}`,
      );
    }
    console.log('\nĐặt lại:  node trien-khai/dat-lai-mat-khau.mjs <email> <mật khẩu>');
  }
  await thoat(0);
}

const nguoiDung = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, fullName: true, role: true, isLocked: true },
});
if (!nguoiDung) {
  console.error(`Không có tài khoản nào với email: ${email}`);
  console.error('Chạy không tham số để xem danh sách.');
  await thoat(1);
}

if (!matKhau) {
  console.error('Thiếu mật khẩu mới.');
  console.error(`Dùng:  node trien-khai/dat-lai-mat-khau.mjs ${email} '<mật khẩu>'`);
  await thoat(1);
}

// Cùng chính sách với kiemTraDoManh() trong api/src/lib/mat-khau.ts — đặt được
// mật khẩu yếu ở đây rồi giao diện từ chối khi đổi là bất nhất.
if (matKhau.length < DAI_TOI_THIEU) {
  console.error(`Mật khẩu phải có ít nhất ${DAI_TOI_THIEU} ký tự.`);
  await thoat(1);
}
if (Buffer.byteLength(matKhau, 'utf8') > 72) {
  console.error('Mật khẩu không được dài quá 72 byte.');
  await thoat(1);
}
if (!/[0-9]/.test(matKhau) || !/[A-Za-zÀ-ỹ]/.test(matKhau)) {
  console.error('Mật khẩu phải có cả chữ và số.');
  await thoat(1);
}

await prisma.user.update({
  where: { id: nguoiDung.id },
  data: {
    passwordHash: await hash(matKhau, SO_VONG),
    // Mở khoá luôn: khoá tài khoản cũng là một cách bị chặn ngoài cửa.
    isLocked: false,
    // KHÔNG bắt đổi lại ngay: người chạy được lệnh này là người quản trị máy,
    // và bắt đổi tiếp chỉ thêm một cửa nữa để mắc kẹt.
    mustChangePassword: false,
  },
});

// Buộc mọi phiên cũ đăng nhập lại — mật khẩu đã đổi thì token cũ không nên còn giá trị.
const { count } = await prisma.refreshToken.deleteMany({ where: { userId: nguoiDung.id } });

console.log(`✓ Đã đặt lại mật khẩu cho ${nguoiDung.email} (${nguoiDung.role} — ${nguoiDung.fullName})`);
if (nguoiDung.isLocked) console.log('  Tài khoản đang bị khoá — đã mở khoá luôn.');
if (count > 0) console.log(`  Đã thu hồi ${count} phiên đăng nhập cũ.`);
console.log('\nĐăng nhập lại rồi ĐỔI MẬT KHẨU trong giao diện — mật khẩu vừa gõ đã nằm');
console.log('trong lịch sử dòng lệnh của máy chủ.');
await thoat(0);
}

try {
  await chay();
} catch (loi) {
  inLoiGon(loi);
  await thoat(1);
}
