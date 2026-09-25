/**
 * Tra ID của nguồn gốc / mục đích sử dụng theo MÃ.
 *
 * Cần vì vài chỗ trong hệ thống gọi theo mã cố định chứ không do người dùng
 * chọn: tạo nhanh thiết bị mặc định nguồn gốc KHAC, màn hình kho lọc mục đích
 * CO_DINH_TAI_KHO. Trước đây hai cái đó là enum nên viết thẳng chuỗi vào mã
 * nguồn là xong; giờ là hàng trong CSDL nên phải tra ra id.
 *
 * Và người dùng ĐƯỢC PHÉP xoá hoặc đổi tên hai mã đó — đã hứa như vậy. Nên mọi
 * hàm ở đây đều phải xử lý được trường hợp mã không còn, thay vì đổ lỗi 500.
 */
import { prisma } from '../prisma.js';
import { loi422 } from './loi-http.js';

/**
 * ID nguồn gốc theo mã, KHÔNG có thì lấy nguồn gốc đang dùng đầu danh sách.
 *
 * Dùng cho tạo nhanh thiết bị: người ở kho đang giữa lúc lập yêu cầu, chặn họ
 * lại chỉ vì ADMIN vừa xoá mã KHAC là vô lý — ghi chú của bản ghi tạo nhanh đã
 * nói sẵn "cần bổ sung nguồn gốc sau" rồi.
 */
export async function idNguonGocHoacDauTien(ma: string): Promise<string> {
  const theoMa = await prisma.assetOrigin.findUnique({ where: { code: ma }, select: { id: true } });
  if (theoMa) return theoMa.id;

  const dauTien = await prisma.assetOrigin.findFirst({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true },
  });
  if (dauTien) return dauTien.id;

  // Không còn nguồn gốc nào thì đúng là không tạo được thiết bị — nói thẳng
  // phải làm gì, đừng để khoá ngoại đổ ra một dòng tiếng Anh.
  throw loi422(
    'Chưa có nguồn gốc nào trong hệ thống. Vào Danh mục → Nguồn gốc để thêm ít nhất một mục trước khi tạo thiết bị.',
    'THIEU_NGUON_GOC',
  );
}

/** Như trên, cho mục đích sử dụng. */
export async function idMucDichHoacDauTien(ma: string): Promise<string> {
  const theoMa = await prisma.assetPurpose.findUnique({ where: { code: ma }, select: { id: true } });
  if (theoMa) return theoMa.id;

  const dauTien = await prisma.assetPurpose.findFirst({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true },
  });
  if (dauTien) return dauTien.id;

  throw loi422(
    'Chưa có mục đích sử dụng nào trong hệ thống. Vào Danh mục → Mục đích sử dụng để thêm ít nhất một mục trước khi tạo thiết bị.',
    'THIEU_MUC_DICH',
  );
}

/**
 * ID mục đích theo mã, không có thì trả null.
 *
 * Dùng cho BỘ LỌC (màn hình kho lọc CO_DINH_TAI_KHO). Khác hai hàm trên: lọc
 * theo một mã đã bị xoá thì kết quả đúng là RỖNG, không được lặng lẽ đổi sang
 * mã khác rồi hiện nhầm một rổ thiết bị không liên quan.
 */
export async function idMucDichTheoMa(ma: string): Promise<string | null> {
  const hang = await prisma.assetPurpose.findUnique({ where: { code: ma }, select: { id: true } });
  return hang?.id ?? null;
}
