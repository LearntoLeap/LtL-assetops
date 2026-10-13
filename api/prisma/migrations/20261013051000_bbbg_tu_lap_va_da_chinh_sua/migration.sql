-- Biên bản tự lập có trạng thái riêng, sửa xong chuyển sang "Đã chỉnh sửa".
-- Chỉ THÊM hai giá trị vào cuối enum; biên bản hiện có giữ nguyên trạng thái.
ALTER TABLE `handover_notes` MODIFY `status` ENUM('BAN_NHAP', 'CHO_XAC_NHAN', 'DA_XAC_NHAN', 'TU_CHOI', 'TU_LAP', 'DA_CHINH_SUA') NOT NULL DEFAULT 'BAN_NHAP';
