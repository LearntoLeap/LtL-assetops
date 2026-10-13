-- Bộ đếm mã thiết bị dùng chung bảng document_sequences (year = 0). Tiền tố mã
-- thiết bị dài tới ~33 ký tự (nguồn gốc-loại-dòng-) nên nới cột từ 16 lên 64.
-- Chỉ nới rộng, không đổi dữ liệu nào.
ALTER TABLE `document_sequences` MODIFY `prefix` VARCHAR(64) NOT NULL;
