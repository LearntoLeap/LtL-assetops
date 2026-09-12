/**
 * KHOÁ ĐĂNG NHẬP THEO VỊ TRÍ cho vai trò KHO.
 *
 * Client gửi toạ độ, SERVER tính khoảng cách và quyết định — không bao giờ tin
 * kết luận của client. Vì GPS trong nhà hay lệch:
 *   - bán kính cấu hình được theo từng kho (mặc định GPS_DEFAULT_RADIUS_M),
 *   - ADMIN cấp được mã vượt quyền DÙNG MỘT LẦN,
 *   - mọi lần đăng nhập đều ghi nhật ký kèm toạ độ và khoảng cách.
 */
import { compare } from 'bcryptjs';
import { prisma } from '../../prisma.js';
import { env } from '../../env.js';
import { khoangCachM, toaDoHopLe, type ToaDo } from '../../lib/khoang-cach.js';
import { loi403, loi422 } from '../../lib/loi-http.js';
import { ghiAuditKhongChan, type NguoiThaoTac } from '../../lib/audit.js';
import { chuanHoaMa, tienToMa } from '../../lib/ma-vuot-quyen.js';

export interface ThamSoKiemViTri {
  nguoiDung: NguoiThaoTac & { locationId: string | null };
  toaDo: ToaDo | null;
  maVuotQuyen: string | null;
  boiCanh: { ip: string | null; userAgent: string | null };
}

export interface KetQuaKiemViTri {
  khoangCachM: number | null;
  dungMaVuotQuyen: boolean;
  tenKho: string;
  banKinhM: number;
}

/**
 * Tìm và TIÊU một mã vượt quyền còn hiệu lực của kho. Trả về id mã nếu dùng
 * được. Việc đánh dấu đã dùng làm bằng updateMany có điều kiện `usedAt: null`,
 * nên hai người nhập cùng một mã cùng lúc chỉ một người đi qua được.
 */
async function tieuMaVuotQuyen(
  locationId: string,
  ma: string,
  userId: string,
): Promise<string | null> {
  const chuanHoa = chuanHoaMa(ma);
  if (chuanHoa.length < 4) return null;

  const ungVien = await prisma.gpsOverrideCode.findMany({
    where: {
      locationId,
      codePrefix: tienToMa(chuanHoa),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, codeHash: true },
  });

  for (const uv of ungVien) {
    if (!(await compare(chuanHoa, uv.codeHash))) continue;
    const daTieu = await prisma.gpsOverrideCode.updateMany({
      where: { id: uv.id, usedAt: null },
      data: { usedAt: new Date(), usedById: userId },
    });
    if (daTieu.count === 1) return uv.id;
  }
  return null;
}

/**
 * Kiểm tra vị trí đăng nhập của tài khoản KHO.
 * Ném lỗi 422/403 kèm nhật ký nếu không đạt; trả về thông tin để ghi log nếu đạt.
 */
export async function kiemTraViTriKho(thamSo: ThamSoKiemViTri): Promise<KetQuaKiemViTri> {
  const { nguoiDung, toaDo, maVuotQuyen, boiCanh } = thamSo;

  if (!nguoiDung.locationId) {
    await ghiAuditKhongChan({
      actor: nguoiDung,
      action: 'auth.login.tu_choi',
      entityType: 'user',
      entityId: nguoiDung.id,
      ...boiCanh,
      note: 'Tài khoản KHO chưa được gán kho.',
    });
    throw loi403(
      'Tài khoản kho chưa được gán điểm kho. Liên hệ quản trị viên để gán kho trước khi đăng nhập.',
    );
  }

  const kho = await prisma.location.findUnique({
    where: { id: nguoiDung.locationId },
    select: { id: true, name: true, latitude: true, longitude: true, gpsRadiusM: true },
  });

  if (!kho || kho.latitude === null || kho.longitude === null) {
    await ghiAuditKhongChan({
      actor: nguoiDung,
      action: 'auth.login.tu_choi',
      entityType: 'user',
      entityId: nguoiDung.id,
      ...boiCanh,
      note: `Kho ${kho?.name ?? nguoiDung.locationId} chưa cấu hình toạ độ GPS.`,
    });
    // Chặn (fail-safe): chưa có toạ độ thì không thể kiểm, không cho đi qua.
    throw loi403(
      'Kho của tài khoản này chưa được cấu hình toạ độ GPS. Quản trị viên cần cấu hình trước khi tài khoản kho đăng nhập được.',
    );
  }

  const banKinhM = kho.gpsRadiusM ?? env.GPS_DEFAULT_RADIUS_M;
  const toaDoKho: ToaDo = { latitude: Number(kho.latitude), longitude: Number(kho.longitude) };

  if (!toaDo || !toaDoHopLe(toaDo)) {
    await ghiAuditKhongChan({
      actor: nguoiDung,
      action: 'auth.login.tu_choi',
      entityType: 'user',
      entityId: nguoiDung.id,
      ...boiCanh,
      note: 'Không nhận được toạ độ hợp lệ từ máy đăng nhập.',
    });
    throw loi422(
      'Tài khoản kho phải gửi vị trí khi đăng nhập. Hãy cho phép trình duyệt truy cập vị trí rồi thử lại.',
      'THIEU_VI_TRI',
      { tenKho: kho.name, banKinhM },
    );
  }

  const khoangCach = khoangCachM(toaDo, toaDoKho);

  if (khoangCach <= banKinhM) {
    return { khoangCachM: khoangCach, dungMaVuotQuyen: false, tenKho: kho.name, banKinhM };
  }

  // Ngoài bán kính — còn một đường: mã vượt quyền dùng một lần do ADMIN cấp.
  if (maVuotQuyen) {
    const idMa = await tieuMaVuotQuyen(kho.id, maVuotQuyen, nguoiDung.id);
    if (idMa) {
      await ghiAuditKhongChan({
        actor: nguoiDung,
        action: 'auth.login.vuot_quyen_gps',
        entityType: 'gps_override_code',
        entityId: idMa,
        ...boiCanh,
        latitude: toaDo.latitude,
        longitude: toaDo.longitude,
        distanceM: khoangCach,
        note: `Đăng nhập ngoài bán kính ${banKinhM}m (cách ${khoangCach}m) bằng mã vượt quyền.`,
      });
      return { khoangCachM: khoangCach, dungMaVuotQuyen: true, tenKho: kho.name, banKinhM };
    }
  }

  await ghiAuditKhongChan({
    actor: nguoiDung,
    action: 'auth.login.ngoai_vung',
    entityType: 'user',
    entityId: nguoiDung.id,
    ...boiCanh,
    latitude: toaDo.latitude,
    longitude: toaDo.longitude,
    distanceM: khoangCach,
    note: maVuotQuyen
      ? `Cách kho ${khoangCach}m, vượt bán kính ${banKinhM}m; mã vượt quyền không hợp lệ hoặc đã dùng.`
      : `Cách kho ${khoangCach}m, vượt bán kính ${banKinhM}m.`,
  });

  await prisma.alert.create({
    data: {
      type: 'DANG_NHAP_NGOAI_VUNG',
      severity: 'TRUNG_BINH',
      title: `Đăng nhập kho ngoài vùng: ${nguoiDung.email}`,
      message:
        `Tài khoản ${nguoiDung.email} thử đăng nhập cách ${kho.name} ${khoangCach}m, ` +
        `vượt bán kính cho phép ${banKinhM}m.`,
      entityType: 'user',
      entityId: nguoiDung.id,
    },
  });

  throw loi403(
    `Bạn đang ở cách ${kho.name} khoảng ${khoangCach}m, vượt bán kính cho phép ${banKinhM}m. ` +
      'Đăng nhập đã bị từ chối và ghi nhật ký. Nếu GPS lệch, xin quản trị viên cấp mã vượt quyền.',
  );
}
