import type { LoaiDiemLuuTru, LoaiYeuCau } from '@ltl/taisan-shared';

/**
 * MẪU RIÊNG CHO TỪNG LOẠI YÊU CẦU.
 *
 * Trước đây một form dùng cho cả bảy loại, nên ô nào cũng hiện: người xin cho
 * nhân sự mượn vẫn thấy ô "Nơi đến", người phân bổ về trường vẫn thấy ô "Thời
 * gian dự kiến trả" dù giao lâu dài không có hạn trả. Kết quả là ai cũng phải
 * tự đoán ô nào áp dụng cho mình.
 *
 * Gom quy tắc vào một chỗ thay vì rải if/else trong JSX: thêm loại mới hay đổi
 * ràng buộc chỉ sửa ở đây, và đối chiếu với kiểm tra phía server dễ hơn
 * (`LOAI_DIEM_THEO_YEU_CAU`, `kiemTruongGuiNhan` trong yeu-cau.service.ts).
 *
 * `noiDi` / `noiDen` có ba trạng thái, không phải hai:
 *   - 'bat-buoc' : hiện, đánh dấu *, không điền thì không gửi được;
 *   - 'tuy-chon' : hiện, ghi rõ không bắt buộc;
 *   - 'an'       : KHÔNG hiện, vì loại này không có khái niệm đó.
 *
 * `chieu` quyết định tạo xong thì dẫn thẳng tới màn hình nào: không còn bước
 * chờ duyệt, người lập chụp ảnh xác nhận xuất / nhập kho luôn.
 */
type CheDoO = 'bat-buoc' | 'tuy-chon' | 'an';

export interface MauYeuCau {
  tieuDe: string;
  moTa: string;
  chieu: 'xuat' | 'nhap';
  nhanLyDo: string;
  goiYLyDo: string;
  noiDi: CheDoO;
  nhanNoiDi: string;
  giaiThichNoiDi: string;
  /** Loại điểm được chọn làm nơi đi; rỗng = mọi loại. */
  loaiNoiDi: ReadonlyArray<LoaiDiemLuuTru>;
  noiDen: CheDoO;
  nhanNoiDen: string;
  giaiThichNoiDen: string;
  loaiNoiDen: ReadonlyArray<LoaiDiemLuuTru>;
  hanTra: 'nen-co' | 'tuy-chon' | 'an';
  giaiThichHanTra: string;
  nhanThietBi: string;
}

const KHO: ReadonlyArray<LoaiDiemLuuTru> = ['KHO_VAN_PHONG', 'KHO_SU_KIEN'];
const TRUONG: ReadonlyArray<LoaiDiemLuuTru> = ['DIEM_TRUONG'];

const LAY_TU_KHO = {
  noiDi: 'tuy-chon',
  nhanNoiDi: 'Lấy từ kho',
  giaiThichNoiDi:
    'Để trống thì hệ thống tự lấy ở kho còn đủ hàng. Chỉ cần chọn khi nhiều kho cùng có hàng.',
  loaiNoiDi: KHO,
} as const;

const MAU_NHAP: MauYeuCau = {
  tieuDe: 'Nhập kho',
  moTa: 'Nhận thiết bị về kho: hàng mới mua, hàng tặng, nhân sự trả lại, thu hồi từ trường hoặc đối tác.',
  chieu: 'nhap',
  nhanLyDo: 'Nhập gì, vì sao',
  goiYLyDo: 'VD: Nhận 10 bộ cảm biến mới từ nhà cung cấp ADC, theo hoá đơn ngày 15/09.',
  noiDi: 'bat-buoc',
  nhanNoiDi: 'Nhận từ',
  giaiThichNoiDi:
    'Hàng về từ trường / đối tác / kho khác thì chọn điểm đó: hệ thống trừ ở đó và cộng vào kho nhận.',
  loaiNoiDi: [],
  noiDen: 'bat-buoc',
  nhanNoiDen: 'Kho nhận',
  giaiThichNoiDen: 'Kho cất hàng sau khi nhận.',
  loaiNoiDen: KHO,
  hanTra: 'an',
  giaiThichHanTra: '',
  nhanThietBi: 'Thiết bị nhận về',
};

export const MAU_YEU_CAU: Record<Exclude<LoaiYeuCau, 'BAO_HONG'>, MauYeuCau> = {
  XUAT_KHO: {
    tieuDe: 'Xuất kho',
    moTa: 'Đưa thiết bị ra khỏi kho tới một nơi cụ thể.',
    chieu: 'xuat',
    nhanLyDo: 'Xuất cho việc gì',
    goiYLyDo: 'VD: Xuất 5 bộ robot cho buổi trải nghiệm STEM tại Trường Minh Khai ngày 20/09.',
    ...LAY_TU_KHO,
    noiDen: 'bat-buoc',
    nhanNoiDen: 'Nơi nhận',
    giaiThichNoiDen: 'Chưa có trong danh sách thì chọn "+ Thêm điểm mới…" ở cuối danh sách.',
    loaiNoiDen: [],
    hanTra: 'tuy-chon',
    giaiThichHanTra: 'Để trống nếu xuất hẳn, không thu về.',
    nhanThietBi: 'Thiết bị cần xuất',
  },
  NHAP_KHO: MAU_NHAP,
  PHAN_BO_VE_TRUONG: {
    tieuDe: 'Phân bổ về trường',
    moTa: 'Giao thiết bị cho một điểm trường dùng lâu dài. Không có hạn trả.',
    chieu: 'xuat',
    nhanLyDo: 'Phân bổ cho lớp / phòng nào, dùng vào việc gì',
    goiYLyDo: 'VD: Phân bổ 1 bộ phòng STEM cho phòng Tin học Trường Minh Khai, dùng cả năm học.',
    ...LAY_TU_KHO,
    noiDen: 'bat-buoc',
    nhanNoiDen: 'Trường nhận',
    giaiThichNoiDen: 'Trường mới chưa có trong danh sách thì chọn "+ Thêm điểm mới…".',
    loaiNoiDen: TRUONG,
    hanTra: 'an',
    giaiThichHanTra: '',
    nhanThietBi: 'Thiết bị phân bổ',
  },
  LUAN_CHUYEN_TRUONG: {
    tieuDe: 'Luân chuyển giữa hai trường',
    moTa: 'Chuyển thiết bị từ trường này sang trường khác, không qua kho. Biên bản ghi rõ trường gửi và trường nhận.',
    chieu: 'xuat',
    nhanLyDo: 'Vì sao luân chuyển',
    goiYLyDo: 'VD: Quang Trung đã hết đợt học, chuyển 2 bộ robot sang Sao Mai cho đợt mới.',
    noiDi: 'bat-buoc',
    nhanNoiDi: 'Trường gửi',
    giaiThichNoiDi: 'Trường đang giữ thiết bị — bên giao trên biên bản.',
    loaiNoiDi: TRUONG,
    noiDen: 'bat-buoc',
    nhanNoiDen: 'Trường nhận',
    giaiThichNoiDen: 'Trường nhận thiết bị — bên nhận trên biên bản, xác nhận khi hàng tới.',
    loaiNoiDen: TRUONG,
    hanTra: 'tuy-chon',
    giaiThichHanTra: 'Điền nếu đây là mượn tạm giữa hai trường.',
    nhanThietBi: 'Thiết bị luân chuyển',
  },
  CHO_MUON: {
    tieuDe: 'Cho nhân sự mượn',
    moTa: 'Nhân sự mang thiết bị đi dùng rồi trả. Kho bị trừ ngay khi xuất, trả lại thì lập phiếu Nhập kho.',
    chieu: 'xuat',
    nhanLyDo: 'Ai mượn, dùng làm gì',
    goiYLyDo: 'VD: Chị Lan (phòng Học liệu) mượn 1 laptop để soạn học liệu khối 3, dùng trong 2 tuần.',
    ...LAY_TU_KHO,
    noiDen: 'an',
    nhanNoiDen: '',
    giaiThichNoiDen: '',
    loaiNoiDen: [],
    hanTra: 'nen-co',
    giaiThichHanTra: 'Nên điền để hệ thống nhắc khi quá hạn. Để trống thì không có cảnh báo quá hạn.',
    nhanThietBi: 'Thiết bị cho mượn',
  },
  // Loại cũ — giờ gộp vào Nhập kho, không lập mới nữa nhưng phiếu cũ vẫn hiển thị.
  TRA_VE_KHO: { ...MAU_NHAP, tieuDe: 'Trả về kho' },
};

/** Loại lập được ở form — Trả về kho đã gộp vào Nhập kho, Báo hỏng có trang riêng. */
export const LOAI_LAP_MOI = [
  'XUAT_KHO',
  'NHAP_KHO',
  'CHO_MUON',
  'PHAN_BO_VE_TRUONG',
  'LUAN_CHUYEN_TRUONG',
] as const;
export type LoaiLapMoi = (typeof LOAI_LAP_MOI)[number];

/**
 * Nguồn hàng nhập KHÔNG phải một điểm trong danh mục. Không gửi lên máy chủ
 * như id điểm: phiếu để trống nơi đi, máy chủ ghi lượt nhập từ ngoài vào (hàng
 * mới) hoặc nhận lại từ người mượn (hàng nhân sự đang giữ).
 */
export const NGUON_NGOAI = '__ngoai__';
export const NGUON_NHAN_SU = '__nhan_su__';
