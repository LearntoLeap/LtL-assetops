-- XOÁ MỀM YÊU CẦU VÀ BIÊN BẢN BÀN GIAO (chỉ ADMIN)
--
-- Cùng khuôn với xoá mềm thiết bị và điểm lưu trữ: bản ghi biến khỏi mọi danh
-- sách và mọi con số, nhưng vẫn nằm trong CSDL để khôi phục nếu xoá nhầm.
--
-- ĐIỀU QUAN TRỌNG NHẤT: xoá phiếu KHÔNG hoàn tác việc đã xảy ra. Hàng đã ra khỏi
-- kho thì vẫn ở ngoài kho; thiết bị đã đổi vị trí lúc bên nhận xác nhận biên bản
-- thì vẫn ở chỗ mới. Nhật ký di chuyển, ảnh chụp và bút toán tồn kho giữ nguyên
-- — đó là lịch sử, không phải thứ sửa lại được bằng cách xoá tờ giấy.
ALTER TABLE `requests`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `deleted_by_id` VARCHAR(30) NULL;

ALTER TABLE `handover_notes`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `deleted_by_id` VARCHAR(30) NULL;

CREATE INDEX `requests_deleted_at_idx` ON `requests`(`deleted_at`);
CREATE INDEX `handover_notes_deleted_at_idx` ON `handover_notes`(`deleted_at`);

ALTER TABLE `requests`
  ADD CONSTRAINT `requests_deleted_by_id_fkey`
  FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `handover_notes`
  ADD CONSTRAINT `handover_notes_deleted_by_id_fkey`
  FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
