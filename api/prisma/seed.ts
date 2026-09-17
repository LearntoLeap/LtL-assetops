/**
 * Nạp dữ liệu mẫu. Chạy: npm run seed (hoặc npm run seed:prod sau khi build).
 *
 * Đặc điểm:
 *   - CHẠY LẠI ĐƯỢC (idempotent): dùng upsert theo mã/email, không nhân bản.
 *   - Movement chỉ sinh khi tài sản CHƯA có nhật ký di chuyển nào, nên chạy lại
 *     sau khi đã dùng thật sẽ không làm sai tồn kho.
 *   - Mật khẩu lấy từ SEED_ADMIN_PASSWORD, không có giá trị mặc định.
 *   - Ghi audit log cho chính lần seed (nguyên tắc bất biến #4).
 */
import { hash } from 'bcryptjs';
import { config as napEnv } from 'dotenv';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  DIEM_LUU_TRU,
  DONG_GIAI_PHAP,
  LOAI_TAI_SAN,
  LY_DO_THAY_LINH_KIEN,
  TAI_KHOAN,
  TAI_SAN,
} from './seed-du-lieu.js';

// Đọc api/.env giống api/src/env.ts. Prisma Client KHÔNG tự đọc .env (chỉ Prisma
// CLI mới đọc), nên thiếu dòng này thì `npm run seed` báo thiếu DATABASE_URL và
// SEED_ADMIN_PASSWORD dù api/.env đã có đủ. dotenv không ghi đè biến đã đặt sẵn,
// nên truyền biến từ dòng lệnh vẫn thắng.
napEnv();

const prisma = new PrismaClient();
const SO_VONG_BCRYPT = 12;

function viet(dong: string): void {
  process.stdout.write(`${dong}\n`);
}

function doiNgay(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Ngày không hợp lệ trong dữ liệu mẫu: ${iso}`);
  return d;
}

/** Lấy mật khẩu seed, báo lỗi rõ ràng nếu chưa cấu hình. */
function docMatKhau(): string {
  const mk = process.env['SEED_ADMIN_PASSWORD'];
  if (!mk || mk.length < 8) {
    throw new Error(
      'Chưa đặt SEED_ADMIN_PASSWORD (tối thiểu 8 ký tự) trong api/.env.\n' +
        'Đây là mật khẩu khởi tạo cho cả 5 tài khoản mẫu — đặt xong hãy chạy lại lệnh seed.',
    );
  }
  return mk;
}

async function napDanhMuc(): Promise<void> {
  for (const d of DONG_GIAI_PHAP) {
    await prisma.productLine.upsert({
      where: { code: d.code },
      create: { code: d.code, name: d.name, sortOrder: d.sortOrder },
      update: { name: d.name, sortOrder: d.sortOrder },
    });
  }
  viet(`  • Dòng giải pháp: ${DONG_GIAI_PHAP.length}`);

  for (const l of LOAI_TAI_SAN) {
    await prisma.assetCategory.upsert({
      where: { code: l.code },
      create: {
        code: l.code,
        name: l.name,
        defaultTrackingType: l.defaultTrackingType,
        sortOrder: l.sortOrder,
      },
      update: { name: l.name, defaultTrackingType: l.defaultTrackingType, sortOrder: l.sortOrder },
    });
  }
  viet(`  • Loại tài sản: ${LOAI_TAI_SAN.length}`);
}

async function napDiemLuuTru(): Promise<Map<string, string>> {
  const banDo = new Map<string, string>();
  for (const d of DIEM_LUU_TRU) {
    const duLieu = {
      name: d.name,
      type: d.type,
      address: d.address ?? null,
      contactName: d.contactName ?? null,
      contactPhone: d.contactPhone ?? null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      gpsRadiusM: d.gpsRadiusM ?? null,
      gpsRequired: d.gpsRequired ?? false,
      note: d.note ?? null,
    } satisfies Omit<Prisma.LocationUncheckedCreateInput, 'code'>;

    const ban = await prisma.location.upsert({
      where: { code: d.code },
      create: { code: d.code, ...duLieu },
      update: duLieu,
      select: { id: true },
    });
    banDo.set(d.code, ban.id);
  }
  const soTruong = DIEM_LUU_TRU.filter((d) => d.type === 'DIEM_TRUONG').length;
  viet(`  • Điểm lưu trữ: ${DIEM_LUU_TRU.length} (trong đó ${soTruong} điểm trường)`);
  return banDo;
}

/** Danh mục lý do thay linh kiện. Chạy lại nhiều lần không sinh bản trùng. */
async function napLyDoLinhKien(): Promise<void> {
  for (const name of LY_DO_THAY_LINH_KIEN) {
    await prisma.partReplacementReason.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  viet(`  • Lý do thay linh kiện: ${LY_DO_THAY_LINH_KIEN.length}`);
}

async function napTaiKhoan(diemLuuTru: Map<string, string>): Promise<Map<string, string>> {
  const bamMatKhau = await hash(docMatKhau(), SO_VONG_BCRYPT);
  const emailAdminTuyChon = process.env['SEED_ADMIN_EMAIL']?.trim();
  const banDo = new Map<string, string>();

  for (const t of TAI_KHOAN) {
    // Cho phép đổi email tài khoản ADMIN qua biến môi trường.
    const email = t.role === 'ADMIN' && emailAdminTuyChon ? emailAdminTuyChon : t.email;
    const locationId = t.diemLuuTru ? (diemLuuTru.get(t.diemLuuTru) ?? null) : null;
    if (t.diemLuuTru && !locationId) {
      throw new Error(`Tài khoản ${email} trỏ tới điểm lưu trữ không tồn tại: ${t.diemLuuTru}`);
    }

    const ban = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: bamMatKhau,
        fullName: t.fullName,
        phone: t.phone ?? null,
        role: t.role,
        department: t.department ?? null,
        locationId,
        // Tài khoản MẪU để kiểm thử ngay — tài khoản thật do ADMIN tạo sẽ mặc
        // định bắt buộc đổi mật khẩu ở lần đăng nhập đầu.
        mustChangePassword: false,
      },
      update: {
        fullName: t.fullName,
        phone: t.phone ?? null,
        role: t.role,
        department: t.department ?? null,
        locationId,
      },
      select: { id: true },
    });
    // Khoá tra cứu theo email gốc trong dữ liệu mẫu, không theo email đã ghi đè.
    banDo.set(t.email, ban.id);
  }
  viet(`  • Tài khoản: ${TAI_KHOAN.length} (đủ 5 vai trò ADMIN / VAN_HANH / KHO / NHAN_SU / TRUONG)`);
  return banDo;
}

interface KetQuaTaiSan {
  soTaiSan: number;
  soMovement: number;
  boQua: number;
}

async function napTaiSan(
  diemLuuTru: Map<string, string>,
  taiKhoan: Map<string, string>,
): Promise<KetQuaTaiSan> {
  const loai = new Map(
    (await prisma.assetCategory.findMany({ select: { id: true, code: true } })).map((l) => [
      l.code,
      l.id,
    ]),
  );
  const dong = new Map(
    (await prisma.productLine.findMany({ select: { id: true, code: true } })).map((d) => [
      d.code,
      d.id,
    ]),
  );

  const idAdmin = taiKhoan.get('admin@learntoleap.vn');
  const idKho = taiKhoan.get('kho@learntoleap.vn');
  if (!idAdmin || !idKho) throw new Error('Thiếu tài khoản ADMIN hoặc KHO sau khi nạp tài khoản.');

  let soMovement = 0;
  let boQua = 0;

  for (const t of TAI_SAN) {
    const categoryId = loai.get(t.categoryCode);
    if (!categoryId) throw new Error(`${t.code}: loại tài sản không tồn tại — ${t.categoryCode}`);

    const productLineId = t.productLineCode ? (dong.get(t.productLineCode) ?? null) : null;
    if (t.productLineCode && !productLineId) {
      throw new Error(`${t.code}: dòng giải pháp không tồn tại — ${t.productLineCode}`);
    }

    const idNhapVe = diemLuuTru.get(t.nhapVe);
    if (!idNhapVe) throw new Error(`${t.code}: điểm nhập ban đầu không tồn tại — ${t.nhapVe}`);

    // Vị trí hiện tại = điểm cuối của chuỗi điều chuyển, nếu có.
    const buocCuoi = t.dieuChuyen?.at(-1);
    const maViTri = buocCuoi?.den ?? t.nhapVe;
    const currentLocationId = diemLuuTru.get(maViTri);
    if (!currentLocationId) throw new Error(`${t.code}: điểm đến không tồn tại — ${maViTri}`);

    const holderUserId = t.nguoiGiuEmail ? (taiKhoan.get(t.nguoiGiuEmail) ?? null) : null;
    if (t.nguoiGiuEmail && !holderUserId) {
      throw new Error(`${t.code}: người giữ không tồn tại — ${t.nguoiGiuEmail}`);
    }

    if (t.trackingType === 'DON_VI' && t.soLuongNhap !== 1) {
      throw new Error(`${t.code}: tài sản DON_VI phải có soLuongNhap = 1.`);
    }

    const duLieu = {
      name: t.name,
      categoryId,
      productLineId,
      serialNumber: t.serialNumber ?? null,
      origin: t.origin,
      originNote: t.originNote ?? null,
      receivedDate: doiNgay(t.receivedDate),
      value: t.value ?? null,
      purpose: t.purpose,
      trackingType: t.trackingType,
      currentLocationId,
      condition: t.condition,
      allocationStatus: t.allocationStatus,
      holderUserId,
      dueReturnAt: t.hanTra ? doiNgay(t.hanTra) : null,
      note: t.note ?? null,
      createdById: idAdmin,
    } satisfies Omit<Prisma.AssetUncheckedCreateInput, 'code'>;

    const taiSan = await prisma.asset.upsert({
      where: { code: t.code },
      create: { code: t.code, ...duLieu },
      update: duLieu,
      select: { id: true },
    });

    // Movement chỉ sinh cho tài sản chưa có nhật ký — tránh làm sai tồn kho
    // khi chạy lại seed trên CSDL đã dùng thật.
    const daCo = await prisma.movement.count({ where: { assetId: taiSan.id } });
    if (daCo > 0) {
      boQua += 1;
      continue;
    }

    await prisma.movement.create({
      data: {
        assetId: taiSan.id,
        type: 'NHAP_BAN_DAU',
        fromLocationId: null, // từ ngoài hệ thống
        toLocationId: idNhapVe,
        quantity: t.soLuongNhap,
        conditionAfter: t.condition,
        performedById: idKho,
        performedAt: doiNgay(t.receivedDate),
        note: 'Nhập ban đầu (dữ liệu mẫu).',
      },
    });
    soMovement += 1;

    let viTriHienTai = idNhapVe;
    for (const buoc of t.dieuChuyen ?? []) {
      const den = diemLuuTru.get(buoc.den);
      if (!den) throw new Error(`${t.code}: điểm điều chuyển không tồn tại — ${buoc.den}`);
      if (buoc.soLuong > t.soLuongNhap) {
        throw new Error(`${t.code}: điều chuyển ${buoc.soLuong} vượt số nhập ${t.soLuongNhap}.`);
      }
      await prisma.movement.create({
        data: {
          assetId: taiSan.id,
          type: buoc.loai,
          fromLocationId: viTriHienTai,
          toLocationId: den,
          quantity: buoc.soLuong,
          conditionBefore: t.condition,
          conditionAfter: t.condition,
          performedById: idKho,
          performedAt: doiNgay(t.receivedDate),
          note: buoc.ghiChu ?? 'Điều chuyển (dữ liệu mẫu).',
        },
      });
      soMovement += 1;
      viTriHienTai = den;
    }
  }

  viet(`  • Thiết bị: ${TAI_SAN.length} — nhật ký di chuyển mới: ${soMovement}${boQua > 0 ? `, bỏ qua ${boQua} thiết bị đã có nhật ký` : ''}`);
  return { soTaiSan: TAI_SAN.length, soMovement, boQua };
}

/** In bảng tồn kho suy ra từ movements — để mắt thường đối chiếu ngay. */
async function inTonKho(): Promise<void> {
  const dong = await prisma.$queryRaw<Array<{ diem: string; so_ma: bigint | number; tong: unknown }>>`
    SELECT l.name AS diem, COUNT(*) AS so_ma, SUM(t.ton) AS tong
      FROM (
            SELECT buoc.asset_id, buoc.location_id, SUM(buoc.delta) AS ton
              FROM (
                    SELECT asset_id, to_location_id AS location_id, quantity AS delta
                      FROM movements WHERE to_location_id IS NOT NULL
                    UNION ALL
                    SELECT asset_id, from_location_id AS location_id, -quantity AS delta
                      FROM movements WHERE from_location_id IS NOT NULL
                   ) AS buoc
             GROUP BY buoc.asset_id, buoc.location_id
            HAVING SUM(buoc.delta) <> 0
           ) AS t
      JOIN locations l ON l.id = t.location_id
     GROUP BY l.name
     ORDER BY l.name
  `;
  viet('');
  viet('  Tồn kho SUY RA TỪ movements (không có cột số tồn nào trong CSDL):');
  for (const d of dong) {
    viet(`    - ${d.diem}: ${String(d.so_ma)} mã, tổng ${String(d.tong)} đơn vị`);
  }
}

async function ghiAuditLog(ketQua: KetQuaTaiSan, taiKhoan: Map<string, string>): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: taiKhoan.get('admin@learntoleap.vn') ?? null,
      actorEmail: process.env['SEED_ADMIN_EMAIL']?.trim() ?? 'admin@learntoleap.vn',
      actorRole: 'ADMIN',
      action: 'seed.run',
      entityType: 'system',
      entityId: null,
      afterValue: {
        dongGiaiPhap: DONG_GIAI_PHAP.length,
        loaiTaiSan: LOAI_TAI_SAN.length,
        diemLuuTru: DIEM_LUU_TRU.length,
        taiKhoan: TAI_KHOAN.length,
        thietBi: ketQua.soTaiSan,
        movementMoi: ketQua.soMovement,
      },
      note: 'Nạp dữ liệu mẫu giai đoạn 1.',
    },
  });
}

async function chay(): Promise<void> {
  viet('Nạp dữ liệu mẫu — LtL Quản lý Tài sản');
  await napDanhMuc();
  await napLyDoLinhKien();
  const diemLuuTru = await napDiemLuuTru();
  const taiKhoan = await napTaiKhoan(diemLuuTru);
  const ketQua = await napTaiSan(diemLuuTru, taiKhoan);
  await ghiAuditLog(ketQua, taiKhoan);
  await inTonKho();
  viet('');
  viet('Xong. Đăng nhập bằng các email ở trên với mật khẩu SEED_ADMIN_PASSWORD.');
}

chay()
  .then(() => prisma.$disconnect())
  .catch((loi: unknown) => {
    process.stderr.write(`Nạp dữ liệu mẫu THẤT BẠI: ${loi instanceof Error ? loi.message : String(loi)}\n`);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
