-- Báo cho quản trị mỗi khi có người tự xuất / nhập kho không qua bước duyệt.
-- Chỉ THÊM một giá trị vào cuối enum, không đổi hay xoá giá trị cũ nên mọi dòng
-- cảnh báo hiện có giữ nguyên.
ALTER TABLE `alerts` MODIFY `type` ENUM('TINH_TRANG_THAY_DOI', 'QUA_HAN_TRA', 'CHENH_LECH_KIEM_KE', 'BAO_HONG', 'DANG_NHAP_NGOAI_VUNG', 'XUAT_NHAP_TRUC_TIEP') NOT NULL;
