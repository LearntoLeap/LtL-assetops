/**
 * CÀI ĐẶT ỨNG DỤNG — đọc/ghi bảng khoá-giá trị `app_settings`.
 *
 * Trước bản này, thông tin Bên giao (tên công ty, địa chỉ, mã số thuế, người đại
 * diện) không nằm ở đâu trong hệ thống: mỗi lần lập biên bản là một lần gõ tay,
 * gõ sai thì biên bản sai. Giờ ADMIN đặt một lần trong trang Cài đặt, mọi biên
 * bản lấy theo đó.
 *
 * Bảng lưu chuỗi, nên lớp này làm hai việc để chỗ gọi luôn nhận dữ liệu sạch:
 *   1. GIÁ TRỊ MẶC ĐỊNH ngay trong mã nguồn — hệ thống mới dựng, chưa ai vào
 *      trang Cài đặt, biên bản vẫn in đúng thông tin công ty.
 *   2. Lược đồ zod kiểm khi ghi; đọc lên thì khoá lạ, khoá thiếu đều bỏ qua và
 *      lấy mặc định, không bao giờ nổ.
 */
import { z } from 'zod';
import { prisma, type PrismaTx } from '../prisma.js';

const chuoi = (max: number) => z.string().trim().max(max);

/** Lược đồ của TOÀN BỘ cài đặt — dùng cho cả kiểu TypeScript và bước kiểm khi ghi. */
export const luocDoCaiDat = z.object({
  congTyTen: chuoi(191).min(2, 'Chưa điền tên đơn vị bên giao.'),
  congTyDiaChi: chuoi(255),
  congTyMaSoThue: chuoi(32),
  congTyDienThoai: chuoi(32),
  congTyEmail: z.union([z.literal(''), z.string().trim().email('Email không hợp lệ.').max(191)]),
  congTyWebsite: chuoi(191),
  /** Người đại diện ký biên bản mặc định. */
  daiDienTen: chuoi(191),
  daiDienChucVu: chuoi(191),
  /** Các dòng "Căn cứ …" in dưới tên văn bản, mỗi dòng một căn cứ. */
  canCu: chuoi(2000),
  /** Số bản biên bản được lập. */
  soBan: z.coerce.number().int().min(1, 'Ít nhất 01 bản.').max(20, 'Nhiều nhất 20 bản.'),
});

export type CaiDatChung = z.infer<typeof luocDoCaiDat>;

/**
 * Thông tin Bên giao mặc định — của Learn to Leap, đúng theo mẫu biên bản đang
 * dùng. ADMIN sửa được trong trang Cài đặt; sửa ở đó KHÔNG cần sửa mã nguồn.
 */
export const CAI_DAT_MAC_DINH: CaiDatChung = {
  congTyTen: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ GIÁO DỤC LEARN TO LEAP',
  congTyDiaChi:
    'Tầng 6, tòa nhà IPH, số 241 đường Xuân Thủy, Phường Cầu Giấy, Thành phố Hà Nội',
  congTyMaSoThue: '0110407398',
  congTyDienThoai: '0346321502',
  congTyEmail: '',
  congTyWebsite: '',
  daiDienTen: '',
  daiDienChucVu: '',
  canCu:
    'Căn cứ hợp đồng/thỏa thuận hợp tác đã ký giữa hai Bên;\n' +
    'Căn cứ nhu cầu triển khai chương trình STEM – AI – Robotics tại đơn vị;',
  soBan: 4,
};

/** Khoá trong CSDL: "cong_ty.ten"… giữ tách bạch để sau thêm nhóm khác. */
const KHOA: Record<keyof CaiDatChung, string> = {
  congTyTen: 'cong_ty.ten',
  congTyDiaChi: 'cong_ty.dia_chi',
  congTyMaSoThue: 'cong_ty.ma_so_thue',
  congTyDienThoai: 'cong_ty.dien_thoai',
  congTyEmail: 'cong_ty.email',
  congTyWebsite: 'cong_ty.website',
  daiDienTen: 'bbbg.dai_dien_ten',
  daiDienChucVu: 'bbbg.dai_dien_chuc_vu',
  canCu: 'bbbg.can_cu',
  soBan: 'bbbg.so_ban',
};

/** Đọc toàn bộ cài đặt, khoá nào chưa có thì lấy mặc định. */
export async function docCaiDat(db: PrismaTx = prisma): Promise<CaiDatChung> {
  const hang = await db.appSetting.findMany({ select: { key: true, value: true } });
  const theoKhoa = new Map(hang.map((h) => [h.key, h.value]));
  const ra = { ...CAI_DAT_MAC_DINH } as CaiDatChung;

  for (const [ten, khoa] of Object.entries(KHOA) as Array<[keyof CaiDatChung, string]>) {
    const tho = theoKhoa.get(khoa);
    if (tho === undefined) continue;
    if (ten === 'soBan') {
      const so = Number.parseInt(tho, 10);
      // Giá trị rác trong CSDL không được làm sập trang: bỏ qua, dùng mặc định.
      if (Number.isFinite(so) && so >= 1 && so <= 20) ra.soBan = so;
    } else {
      ra[ten] = tho;
    }
  }
  return ra;
}

/** Ghi cài đặt (ADMIN). Chỉ những khoá gửi lên bị ghi đè. */
export async function ghiCaiDat(
  duLieu: Partial<CaiDatChung>,
  nguoiSuaId: string,
  db: PrismaTx = prisma,
): Promise<CaiDatChung> {
  for (const [ten, giaTri] of Object.entries(duLieu) as Array<
    [keyof CaiDatChung, string | number | undefined]
  >) {
    if (giaTri === undefined) continue;
    const khoa = KHOA[ten];
    const value = String(giaTri);
    await db.appSetting.upsert({
      where: { key: khoa },
      create: { key: khoa, value, updatedById: nguoiSuaId },
      update: { value, updatedById: nguoiSuaId },
    });
  }
  return docCaiDat(db);
}

/** Tách một trường nhiều dòng thành danh sách dòng, bỏ dòng trống. */
export function tachDong(tho: string | null | undefined): string[] {
  if (!tho) return [];
  return tho
    .split('\n')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}
