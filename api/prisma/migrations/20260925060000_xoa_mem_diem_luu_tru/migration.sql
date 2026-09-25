-- XOÁ MỀM điểm lưu trữ.
--
-- Chỉ thêm cột, không đụng dữ liệu có sẵn: mọi điểm đang có đều mang
-- `deleted_at = NULL` nghĩa là "chưa xoá", đúng như trước.
--
-- Không xoá cứng được vì `movements`, `requests`, `handover_notes`,
-- `inventory_counts` đều trỏ vào `locations` bằng khoá ngoại — xoá cứng là mất
-- luôn nghĩa của toàn bộ nhật ký xuất–nhập đã ghi tại điểm đó.

ALTER TABLE `locations`
    ADD COLUMN `deleted_at`    DATETIME(3) NULL,
    ADD COLUMN `deleted_by_id` VARCHAR(30) NULL;

CREATE INDEX `locations_deleted_at_idx` ON `locations`(`deleted_at`);

-- SET NULL chứ không RESTRICT: xoá một tài khoản không được kéo theo việc khoá
-- cứng một điểm trong thùng rác. Mất tên người xoá thì chỉ mất một dòng hiển
-- thị, còn nhật ký kiểm toán vẫn giữ đủ.
ALTER TABLE `locations`
    ADD CONSTRAINT `locations_deleted_by_id_fkey`
        FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
