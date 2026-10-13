/**
 * Đọc số liệu dashboard AN TOÀN QUA HAI PHIÊN BẢN.
 *
 * Giao diện lên Vercel ngay khi đẩy mã, còn API trên VPS chỉ đổi khi người quản
 * trị chạy script cập nhật. Giữa hai mốc đó, trang chủ MỚI gọi API CŨ và nhận về
 * gói số liệu thiếu vài trường. Đọc thẳng `s.oSuKien.bo` là ném lỗi và trắng cả
 * trang chủ — hỏng nặng hơn hẳn việc thiếu một ô.
 *
 * Nên mọi chỗ đọc các trường mới đều đi qua đây: thiếu thì hiện 0, trang vẫn
 * dùng được, và số sẽ đúng ngay khi API được cập nhật.
 */
import type { DemTachLoai, TangGiam } from './kieu';

const TRONG: DemTachLoai = { bo: 0, le: 0 };

export function dem(x: DemTachLoai | undefined): DemTachLoai {
  return x ?? TRONG;
}

/** Một dòng tăng / giảm ngắn gọn cho ô số liệu, vd "+12 / −30 bộ · +200 / −80 lẻ". */
export function moTaBienDong(t: TangGiam | undefined): string | null {
  if (!t) return null;
  const phan: string[] = [];
  const mot = (x: { tang: number; giam: number }, donVi: string): void => {
    if (x.tang === 0 && x.giam === 0) return;
    phan.push(`+${x.tang.toLocaleString('vi-VN')} / −${x.giam.toLocaleString('vi-VN')} ${donVi}`);
  };
  mot(t.bo, 'bộ');
  mot(t.le, 'lẻ');
  return phan.length > 0 ? phan.join(' · ') : 'không đổi';
}
