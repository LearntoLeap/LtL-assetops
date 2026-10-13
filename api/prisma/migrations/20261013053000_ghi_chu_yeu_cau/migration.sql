-- Ghi chú chung của phiếu yêu cầu (vd mượn thêm thiết bị từ kho khác). Chỉ thêm
-- một cột cho phép rỗng; phiếu cũ để trống.
ALTER TABLE `requests` ADD COLUMN `note` TEXT NULL;
