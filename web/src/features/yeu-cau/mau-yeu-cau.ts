import type { LoaiYeuCau } from '@ltl/taisan-shared';

/**
 * MẪU RIÊNG CHO TỪNG LOẠI YÊU CẦU.
 *
 * Trước đây một form dùng cho cả bảy loại, nên ô nào cũng hiện: người xin cho
 * nhân sự mượn vẫn thấy ô "Nơi đến", người phân bổ về trường vẫn thấy ô "Thời
 * gian dự kiến trả" dù giao lâu dài không có hạn trả. Kết quả là ai cũng phải
 * tự đoán ô nào áp dụng cho mình.
 *
 * Gom quy tắc vào một chỗ thay vì rải if/else trong JSX: thêm loại mới hay đổi
 * ràng buộc chỉ sửa ở đây, và đối chiếu với kiểm tra phía server dễ hơn.
 *
 * `noiDen` và `hanTra` có ba trạng thái, không phải hai:
 *   - 'bat-buoc' : hiện, đánh dấu *, không điền thì không gửi được;
 *   - 'tuy-chon' : hiện, ghi rõ không bắt buộc;
 *   - 'an'       : KHÔNG hiện, vì loại này không có khái niệm đó.
 */
export interface MauYeuCau {
  tieuDe: string;
  moTa: string;
  nhanLyDo: string;
  goiYLyDo: string;
  noiDen: 'bat-buoc' | 'tuy-chon' | 'an';
  nhanNoiDen: string;
  giaiThichNoiDen: string;
  hanTra: 'nen-co' | 'tuy-chon' | 'an';
  giaiThichHanTra: string;
  nhanThietBi: string;
}

export const MAU_YEU_CAU: Record<Exclude<LoaiYeuCau, 'BAO_HONG'>, MauYeuCau> = {
  XUAT_KHO: {
    tieuDe: 'Xuất kho',
    moTa: 'Đưa thiết bị ra khỏi kho tới một nơi cụ thể. Duyệt xong kho mới xuất được.',
    nhanLyDo: 'Xuất cho việc gì',
    goiYLyDo: 'VD: Xuất 5 bộ robot cho buổi trải nghiệm STEM tại Trường Minh Khai ngày 20/09.',
    noiDen: 'bat-buoc',
    nhanNoiDen: 'Nơi nhận',
    giaiThichNoiDen: 'Phải có nơi nhận thì kho mới biết giao cho ai. Không có trong danh sách thì chọn "Nơi khác" rồi tự điền.',
    hanTra: 'tuy-chon',
    giaiThichHanTra: 'Để trống nếu xuất hẳn, không thu về.',
    nhanThietBi: 'Thiết bị cần xuất',
  },
  NHAP_KHO: {
    tieuDe: 'Nhập kho',
    moTa: 'Nhận thiết bị về kho — hàng mới mua, hàng đối tác trả, hoặc hàng thu hồi từ trường.',
    nhanLyDo: 'Nhận từ đâu, vì sao',
    goiYLyDo: 'VD: Nhận 10 bộ cảm biến mới từ nhà cung cấp ADC, theo hoá đơn ngày 15/09.',
    noiDen: 'an',
    nhanNoiDen: '',
    giaiThichNoiDen: '',
    hanTra: 'an',
    giaiThichHanTra: '',
    nhanThietBi: 'Thiết bị nhận về',
  },
  PHAN_BO_VE_TRUONG: {
    tieuDe: 'Phân bổ về trường',
    moTa: 'Giao thiết bị cho một điểm trường dùng lâu dài. Không có hạn trả.',
    nhanLyDo: 'Phân bổ cho lớp / phòng nào, dùng vào việc gì',
    goiYLyDo: 'VD: Phân bổ 1 bộ phòng STEM cho phòng Tin học Trường Minh Khai, dùng cả năm học.',
    noiDen: 'bat-buoc',
    nhanNoiDen: 'Trường nhận',
    giaiThichNoiDen: 'Chọn điểm trường nhận thiết bị. Trường mới chưa có trong danh sách thì chọn "Nơi khác" rồi tự điền.',
    hanTra: 'an',
    giaiThichHanTra: '',
    nhanThietBi: 'Thiết bị phân bổ',
  },
  LUAN_CHUYEN_TRUONG: {
    tieuDe: 'Luân chuyển giữa hai trường',
    moTa: 'Chuyển thiết bị từ trường này sang trường khác, không qua kho.',
    nhanLyDo: 'Chuyển từ trường nào sang, vì sao',
    goiYLyDo: 'VD: Chuyển 2 bộ robot từ Trường Quang Trung sang Trường Sao Mai vì Quang Trung đã hết đợt học.',
    noiDen: 'bat-buoc',
    nhanNoiDen: 'Trường nhận',
    giaiThichNoiDen: 'Chọn trường ĐẾN. Trường đi ghi trong phần lý do.',
    hanTra: 'tuy-chon',
    giaiThichHanTra: 'Điền nếu đây là mượn tạm giữa hai trường.',
    nhanThietBi: 'Thiết bị luân chuyển',
  },
  CHO_MUON: {
    tieuDe: 'Cho nhân sự mượn',
    moTa: 'Nhân sự mang thiết bị đi dùng rồi trả. Thiết bị vẫn thuộc kho, chỉ gắn người giữ.',
    nhanLyDo: 'Ai mượn, dùng làm gì',
    goiYLyDo: 'VD: Chị Lan (phòng Học liệu) mượn 1 laptop để soạn học liệu khối 3, dùng trong 2 tuần.',
    noiDen: 'an',
    nhanNoiDen: '',
    giaiThichNoiDen: '',
    hanTra: 'nen-co',
    giaiThichHanTra: 'Nên điền để hệ thống nhắc khi quá hạn. Để trống thì không có cảnh báo quá hạn.',
    nhanThietBi: 'Thiết bị cho mượn',
  },
  TRA_VE_KHO: {
    tieuDe: 'Trả về kho',
    moTa: 'Thu thiết bị về kho — hết đợt dùng, người mượn trả, hoặc thu hồi từ trường.',
    nhanLyDo: 'Trả vì sao, tình trạng khi trả',
    goiYLyDo: 'VD: Hết đợt học kỳ 1, thu 3 bộ robot từ Trường Minh Khai, tình trạng còn tốt.',
    noiDen: 'an',
    nhanNoiDen: '',
    giaiThichNoiDen: '',
    hanTra: 'an',
    giaiThichHanTra: '',
    nhanThietBi: 'Thiết bị thu về',
  },
};

/** Giá trị đặc biệt của ô chọn nơi đến: mở ô tự điền. */
export const NOI_KHAC = '__noi-khac__';
