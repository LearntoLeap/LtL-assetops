-- BIÊN BẢN BÀN GIAO THEO MẪU RIÊNG TỪNG LOẠI + BẢNG CÀI ĐẶT
--
-- Ba việc, làm đúng thứ tự này:
--   1. Bảng `app_settings` cho thông tin Bên giao (tên công ty, địa chỉ, mã số
--      thuế, người đại diện…) — trước đây không lưu ở đâu cả, người lập biên bản
--      phải gõ tay mỗi lần.
--   2. Thêm cột cho `handover_notes`: mẫu biên bản, các mục nội dung đầy đủ theo
--      mẫu Word mà LtL đang dùng, và đường dẫn file mềm .docx đã xuất.
--   3. `template_type` NẠP SẴN theo loại yêu cầu của biên bản cũ. Biên bản cũ
--      không gắn yêu cầu thì giữ mặc định PHAN_BO_VE_TRUONG — đúng với luồng duy
--      nhất sinh ra biên bản trước bản này.
--
-- Không xoá, không sửa dữ liệu sẵn có: mọi cột thêm vào đều cho phép NULL hoặc
-- có DEFAULT, nên biên bản đã ký giữ nguyên nội dung.

-- 1 ------------------------------------------------------------------ cài đặt
CREATE TABLE `app_settings` (
    `key` VARCHAR(64) NOT NULL,
    `value` TEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_id` VARCHAR(30) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `app_settings`
  ADD CONSTRAINT `app_settings_updated_by_id_fkey`
  FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2 --------------------------------------------------------- cột cho biên bản
ALTER TABLE `handover_notes`
  ADD COLUMN `template_type` ENUM('XUAT_KHO', 'NHAP_KHO', 'PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG', 'CHO_MUON', 'TRA_VE_KHO', 'BAO_HONG') NOT NULL DEFAULT 'PHAN_BO_VE_TRUONG',
  ADD COLUMN `subtitle` VARCHAR(255) NULL,
  ADD COLUMN `basis` TEXT NULL,
  ADD COLUMN `giver_address` VARCHAR(255) NULL,
  ADD COLUMN `giver_tax_code` VARCHAR(32) NULL,
  ADD COLUMN `giver_phone` VARCHAR(32) NULL,
  ADD COLUMN `receiver_address` VARCHAR(255) NULL,
  ADD COLUMN `handover_place` VARCHAR(255) NULL,
  ADD COLUMN `inspection` TEXT NULL,
  ADD COLUMN `obligations` TEXT NULL,
  ADD COLUMN `copies` INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN `file_path` VARCHAR(255) NULL,
  ADD COLUMN `file_name` VARCHAR(191) NULL,
  ADD COLUMN `file_size` INTEGER NULL,
  ADD COLUMN `file_generated_at` DATETIME(3) NULL;

ALTER TABLE `handover_note_items`
  ADD COLUMN `unit` VARCHAR(32) NOT NULL DEFAULT 'Bộ',
  ADD COLUMN `group_label` VARCHAR(191) NULL;

-- 3 ------------------------------------------- nạp mẫu cho biên bản đã có sẵn
UPDATE `handover_notes` bb
  JOIN `requests` yc ON yc.`id` = bb.`request_id`
   SET bb.`template_type` = yc.`type`;

-- Thiết bị quản lý theo số lượng đếm bằng "Chiếc"; theo đơn vị mới là "Bộ".
UPDATE `handover_note_items` dong
  JOIN `assets` ts ON ts.`id` = dong.`asset_id`
   SET dong.`unit` = 'Chiếc'
 WHERE ts.`tracking_type` = 'SO_LUONG';

CREATE INDEX `handover_notes_template_type_idx` ON `handover_notes`(`template_type`);
