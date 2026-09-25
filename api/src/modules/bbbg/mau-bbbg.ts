/**
 * MẪU BIÊN BẢN BÀN GIAO — mỗi loại yêu cầu một mẫu riêng.
 *
 * Dựng theo đúng mẫu Word mà LtL đang dùng ngoài thực tế (quốc hiệu, tiêu ngữ,
 * tên văn bản, dòng V/v, các dòng "Căn cứ", hai bên, danh mục thiết bị có ĐVT,
 * địa điểm bàn giao, kết quả kiểm tra, trách nhiệm các bên, số bản, chỗ ký).
 *
 * Mỗi loại KHÁC NHAU thật sự, không phải đổi tên cho có:
 *   - ai là bên giao, ai là bên nhận (xuất kho thì kho giao; nhập kho thì kho nhận);
 *   - kết quả kiểm tra và trách nhiệm khác nhau (cho mượn có hạn trả, báo hỏng
 *     phải ghi hiện tượng lỗi, luân chuyển có ba bên liên quan…);
 *   - có mục hạn trả hay không.
 *
 * Nội dung ở đây là GIÁ TRỊ MẶC ĐỊNH khi lập biên bản. Người lập sửa được từng
 * mục trên form, sửa rồi thì bản đã lưu giữ nguyên nội dung đã sửa — mẫu đổi về
 * sau không làm đổi biên bản cũ.
 */
import type { RequestType } from '@prisma/client';
import { NHAN_MAU_BBBG } from '@ltl/taisan-shared';

export interface MauBBBG {
  /** Tên văn bản in giữa trang (chữ hoa). */
  tenVanBan: string;
  /** Dòng "(V/v …)" — `{noiNhan}` được thay bằng tên đơn vị/điểm nhận. */
  vViec: string;
  /** Nhãn hai bên trên biên bản. */
  nhanBenGiao: string;
  nhanBenNhan: string;
  /** Tiêu đề mục danh mục thiết bị. */
  tieuDeDanhMuc: string;
  /** Kết quả kiểm tra mặc định, mỗi dòng một ý. */
  ketQuaKiemTra: string[];
  /** Trách nhiệm các bên mặc định, mỗi dòng một ý. */
  trachNhiem: string[];
  /** Cam kết in ở cuối. */
  camKet: string;
  /** Có in mục hạn trả không (cho mượn / luân chuyển tạm). */
  coHanTra: boolean;
  /** Bên giao là kho của LtL (true) hay là đơn vị ngoài (false). */
  benGiaoLaLtL: boolean;
}

const CAM_KET_CHUNG =
  'Hai Bên đã cùng kiểm tra số lượng, chủng loại và tình trạng thiết bị nêu trên. ' +
  'Bên nhận cam kết bảo quản, sử dụng thiết bị đúng mục đích và chịu trách nhiệm ' +
  'bồi thường nếu làm hư hỏng, mất mát do lỗi chủ quan.';

const KIEM_TRA_CHUNG = [
  'Thiết bị được bàn giao đủ số lượng, đúng chủng loại như danh mục nêu trên.',
  'Thiết bị hoạt động bình thường tại thời điểm bàn giao, không có hư hỏng bên ngoài.',
  'Hồ sơ kèm theo (nếu có): phiếu bảo hành, tài liệu hướng dẫn sử dụng, phụ kiện đồng bộ.',
];

export const MAU_THEO_LOAI: Record<RequestType, MauBBBG> = {
  // --------------------------------------------------------------- xuất kho
  XUAT_KHO: {
    tenVanBan: NHAN_MAU_BBBG.XUAT_KHO,
    vViec: 'V/v bàn giao thiết bị xuất kho cho {noiNhan}',
    nhanBenGiao: 'BÊN GIAO (BÊN A) — ĐƠN VỊ XUẤT KHO',
    nhanBenNhan: 'BÊN NHẬN (BÊN B)',
    tieuDeDanhMuc: 'Danh mục thiết bị bàn giao',
    ketQuaKiemTra: KIEM_TRA_CHUNG,
    trachNhiem: [
      'Bên giao chịu trách nhiệm về số lượng, chủng loại và tình trạng thiết bị đã ghi trong biên bản.',
      'Bên nhận chịu trách nhiệm quản lý, bảo quản và sử dụng thiết bị kể từ thời điểm ký biên bản.',
      'Bên nhận thông báo cho Bên giao trong 03 (ba) ngày làm việc nếu phát hiện sai lệch so với biên bản.',
      'Mọi thay đổi về vị trí, tình trạng thiết bị phải được cập nhật vào hệ thống quản lý tài sản.',
    ],
    camKet: CAM_KET_CHUNG,
    coHanTra: false,
    benGiaoLaLtL: true,
  },

  // --------------------------------------------------------------- nhập kho
  NHAP_KHO: {
    tenVanBan: NHAN_MAU_BBBG.NHAP_KHO,
    vViec: 'V/v tiếp nhận thiết bị nhập kho từ {noiNhan}',
    nhanBenGiao: 'BÊN GIAO (BÊN A)',
    nhanBenNhan: 'BÊN NHẬN (BÊN B) — ĐƠN VỊ TIẾP NHẬN',
    tieuDeDanhMuc: 'Danh mục thiết bị tiếp nhận',
    ketQuaKiemTra: [
      'Thiết bị nhập kho đủ số lượng, đúng chủng loại như danh mục nêu trên.',
      'Tình trạng từng thiết bị đã được ghi nhận tại cột "Tình trạng" của biên bản này.',
      'Thiết bị hư hỏng, thiếu phụ kiện (nếu có) được ghi rõ tại cột "Ghi chú" để xử lý riêng.',
    ],
    trachNhiem: [
      'Bên giao chịu trách nhiệm về nguồn gốc, số lượng và tình trạng thiết bị tại thời điểm giao.',
      'Bên nhận nhập thiết bị vào hệ thống quản lý tài sản ngay sau khi ký biên bản.',
      'Thiết bị chưa đạt yêu cầu được để riêng, lập biên bản xử lý bổ sung, không nhập vào kho sử dụng.',
    ],
    camKet:
      'Hai Bên đã cùng kiểm tra và thống nhất số lượng, chủng loại, tình trạng thiết bị nhập kho nêu trên.',
    coHanTra: false,
    benGiaoLaLtL: false,
  },

  // ----------------------------------------------------- phân bổ về trường
  PHAN_BO_VE_TRUONG: {
    tenVanBan: NHAN_MAU_BBBG.PHAN_BO_VE_TRUONG,
    vViec: 'V/v bàn giao thiết bị STEM – AI – Robotics tại {noiNhan}',
    nhanBenGiao: 'BÊN GIAO (BÊN A)',
    nhanBenNhan: 'BÊN NHẬN (BÊN B)',
    tieuDeDanhMuc: 'Danh mục thiết bị bàn giao',
    ketQuaKiemTra: [
      'Thiết bị được bàn giao đủ số lượng, đúng chủng loại như danh mục nêu trên.',
      'Thiết bị hoạt động bình thường tại thời điểm bàn giao, đã chạy thử và đạt yêu cầu.',
      'Bên nhận đã được hướng dẫn cách vận hành, bảo quản và quy trình báo hỏng.',
    ],
    trachNhiem: [
      'Bên giao bảo đảm thiết bị đúng chủng loại, số lượng, tình trạng như biên bản; bảo hành theo quy định của hãng.',
      'Bên nhận bố trí nơi lưu giữ phù hợp, phân công người quản lý và chịu trách nhiệm bảo quản thiết bị.',
      'Bên nhận sử dụng thiết bị đúng mục đích dạy học, không tự ý chuyển cho đơn vị khác khi chưa có ý kiến của Bên giao.',
      'Khi thiết bị hư hỏng, Bên nhận thông báo cho Bên giao qua hệ thống quản lý tài sản để được hỗ trợ xử lý.',
      'Hai Bên phối hợp kiểm kê định kỳ theo kế hoạch của Bên giao.',
    ],
    camKet: CAM_KET_CHUNG,
    coHanTra: false,
    benGiaoLaLtL: true,
  },

  // -------------------------------------------------- luân chuyển trường ↔ trường
  LUAN_CHUYEN_TRUONG: {
    tenVanBan: NHAN_MAU_BBBG.LUAN_CHUYEN_TRUONG,
    vViec: 'V/v luân chuyển thiết bị sang {noiNhan}',
    nhanBenGiao: 'BÊN GIAO (BÊN A) — ĐƠN VỊ CHUYỂN ĐI',
    nhanBenNhan: 'BÊN NHẬN (BÊN B) — ĐƠN VỊ NHẬN VỀ',
    tieuDeDanhMuc: 'Danh mục thiết bị luân chuyển',
    ketQuaKiemTra: [
      'Thiết bị luân chuyển đủ số lượng, đúng chủng loại như danh mục nêu trên.',
      'Tình trạng thiết bị lúc rời đơn vị chuyển đi và lúc nhận về là như nhau, đã ghi tại cột "Tình trạng".',
      'Phụ kiện đồng bộ đi kèm từng thiết bị đã được kiểm đủ theo ghi chú.',
    ],
    trachNhiem: [
      'Bên giao bàn giao đủ thiết bị, phụ kiện và hồ sơ kèm theo; chịu trách nhiệm về tình trạng thiết bị trước thời điểm bàn giao.',
      'Bên nhận chịu trách nhiệm quản lý, bảo quản thiết bị kể từ thời điểm ký biên bản.',
      'Việc luân chuyển đã được đơn vị chủ quản (Learn to Leap) chấp thuận và cập nhật trong hệ thống quản lý tài sản.',
      'Chi phí vận chuyển, lắp đặt (nếu có) thực hiện theo thoả thuận riêng giữa các Bên.',
    ],
    camKet: CAM_KET_CHUNG,
    coHanTra: false,
    benGiaoLaLtL: false,
  },

  // --------------------------------------------------------------- cho mượn
  CHO_MUON: {
    tenVanBan: NHAN_MAU_BBBG.CHO_MUON,
    vViec: 'V/v cho mượn thiết bị phục vụ hoạt động tại {noiNhan}',
    nhanBenGiao: 'BÊN CHO MƯỢN (BÊN A)',
    nhanBenNhan: 'BÊN MƯỢN (BÊN B)',
    tieuDeDanhMuc: 'Danh mục thiết bị cho mượn',
    ketQuaKiemTra: [
      'Thiết bị cho mượn đủ số lượng, đúng chủng loại như danh mục nêu trên.',
      'Thiết bị hoạt động bình thường tại thời điểm cho mượn.',
      'Phụ kiện, hộp đựng, tài liệu kèm theo đã được kiểm đủ.',
    ],
    trachNhiem: [
      'Bên mượn sử dụng thiết bị đúng mục đích đã đăng ký, không cho đơn vị thứ ba sử dụng lại.',
      'Bên mượn hoàn trả thiết bị đúng hạn, đủ số lượng và trong tình trạng như khi nhận.',
      'Thiết bị hư hỏng, mất mát trong thời gian mượn do lỗi của Bên mượn thì Bên mượn chịu trách nhiệm sửa chữa hoặc bồi thường theo giá trị còn lại.',
      'Bên cho mượn có quyền yêu cầu trả thiết bị trước hạn khi có nhu cầu cấp thiết, thông báo trước ít nhất 03 (ba) ngày.',
    ],
    camKet:
      'Bên mượn cam kết bảo quản, sử dụng thiết bị đúng mục đích, hoàn trả đúng hạn và đầy đủ; ' +
      'chịu trách nhiệm bồi thường nếu làm hư hỏng, mất mát do lỗi chủ quan.',
    coHanTra: true,
    benGiaoLaLtL: true,
  },

  // ------------------------------------------------------------ trả về kho
  TRA_VE_KHO: {
    tenVanBan: NHAN_MAU_BBBG.TRA_VE_KHO,
    vViec: 'V/v bàn giao thiết bị trả về kho từ {noiNhan}',
    nhanBenGiao: 'BÊN TRẢ (BÊN A)',
    nhanBenNhan: 'BÊN NHẬN LẠI (BÊN B) — ĐƠN VỊ QUẢN LÝ KHO',
    tieuDeDanhMuc: 'Danh mục thiết bị trả về kho',
    ketQuaKiemTra: [
      'Thiết bị trả về đủ số lượng, đúng chủng loại như danh mục nêu trên.',
      'Tình trạng từng thiết bị lúc trả đã được ghi tại cột "Tình trạng"; thay đổi so với lúc giao được ghi rõ ở cột "Ghi chú".',
      'Phụ kiện, hộp đựng, tài liệu kèm theo đã được kiểm đủ; thiếu thì ghi rõ để xử lý riêng.',
    ],
    trachNhiem: [
      'Bên trả chịu trách nhiệm về tình trạng thiết bị phát sinh trong thời gian sử dụng.',
      'Bên nhận lại kiểm tra, nhập thiết bị vào kho và cập nhật hệ thống quản lý tài sản ngay sau khi ký biên bản.',
      'Thiết bị hư hỏng được lập phiếu báo hỏng riêng để xác định nguyên nhân và phương án xử lý.',
    ],
    camKet:
      'Hai Bên đã cùng kiểm tra và thống nhất số lượng, tình trạng thiết bị trả về kho nêu trên. ' +
      'Nghĩa vụ giữ gìn thiết bị của Bên trả kết thúc kể từ thời điểm ký biên bản này.',
    coHanTra: false,
    benGiaoLaLtL: false,
  },

  // --------------------------------------------------------------- báo hỏng
  BAO_HONG: {
    tenVanBan: NHAN_MAU_BBBG.BAO_HONG,
    vViec: 'V/v bàn giao thiết bị hư hỏng để xử lý, sửa chữa từ {noiNhan}',
    nhanBenGiao: 'BÊN GIAO (BÊN A) — ĐƠN VỊ ĐANG SỬ DỤNG',
    nhanBenNhan: 'BÊN NHẬN (BÊN B) — ĐƠN VỊ TIẾP NHẬN XỬ LÝ',
    tieuDeDanhMuc: 'Danh mục thiết bị hư hỏng bàn giao',
    ketQuaKiemTra: [
      'Hiện tượng hư hỏng của từng thiết bị đã được ghi rõ tại cột "Ghi chú".',
      'Thiết bị được bàn giao kèm phụ kiện liên quan để phục vụ kiểm tra, sửa chữa.',
      'Hai Bên chưa kết luận nguyên nhân hư hỏng tại thời điểm lập biên bản này.',
    ],
    trachNhiem: [
      'Bên giao mô tả trung thực hiện tượng hư hỏng và hoàn cảnh phát sinh.',
      'Bên nhận kiểm tra, xác định nguyên nhân và thông báo phương án xử lý (bảo hành, sửa chữa có phí, thanh lý) cho Bên giao.',
      'Chi phí sửa chữa được xác định sau khi có kết luận nguyên nhân; nếu do lỗi chủ quan của Bên giao thì Bên giao chịu chi phí.',
      'Thiết bị sau xử lý được bàn giao lại bằng một biên bản riêng.',
    ],
    camKet:
      'Biên bản này ghi nhận việc bàn giao thiết bị hư hỏng để kiểm tra, xử lý; ' +
      'không phải là kết luận về nguyên nhân hư hỏng hay trách nhiệm bồi thường.',
    coHanTra: false,
    benGiaoLaLtL: false,
  },
};

/** Lấy mẫu theo loại; loại lạ thì dùng mẫu phân bổ về trường (mẫu dùng nhiều nhất). */
export function mauCuaLoai(loai: RequestType | null | undefined): MauBBBG {
  return (loai && MAU_THEO_LOAI[loai]) || MAU_THEO_LOAI.PHAN_BO_VE_TRUONG;
}

/**
 * Điền chỗ trống trong dòng V/v bằng tên ĐƠN VỊ ĐỐI TÁC — bên không phải LtL.
 *
 * Không phải lúc nào cũng là bên nhận: mẫu nhập kho / trả về kho / luân chuyển
 * thì LtL là bên NHẬN, nên "V/v tiếp nhận thiết bị nhập kho từ {noiNhan}" phải
 * điền tên bên GIAO. Điền nhầm ra câu "trả về kho từ Learn to Leap" — vô nghĩa
 * trên giấy tờ đưa cho trường ký.
 */
export function vViecCuThe(mau: MauBBBG, benGiaoOrg: string, benNhanOrg?: string): string {
  const doiTac = mau.benGiaoLaLtL ? (benNhanOrg ?? benGiaoOrg) : benGiaoOrg;
  return mau.vViec.replace('{noiNhan}', doiTac.trim() || '…………');
}
