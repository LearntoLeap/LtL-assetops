-- LINH KIỆN THAY THẾ — hai bảng mới + hai giá trị enum mới.
--
-- TOÀN BỘ LÀ THÊM: ADD COLUMN, MODIFY enum để thêm giá trị, CREATE TABLE. Không
-- có DROP nào, không sửa dữ liệu đang có, nên chạy trên VPS đang vận hành an
-- toàn. Hai lệnh MODIFY chỉ NỚI danh sách giá trị enum (thêm XUAT_LINH_KIEN và
-- LINH_KIEN vào cuối) — giá trị cũ giữ nguyên thứ tự nên dữ liệu cũ không lệch.
--
-- Vì sao part_issues là bảng riêng thay vì dùng movements: linh kiện KHÔNG CÓ
-- MÃ không thể là movement, vì movements.asset_id là khoá ngoại NOT NULL. Với
-- linh kiện CÓ MÃ thì phiếu vẫn sinh kèm một movement (movement_id) để tồn kho
-- tiếp tục suy ra từ movements đúng theo nguyên tắc bất biến #5.

-- AlterTable
ALTER TABLE `movements` MODIFY `type` ENUM('NHAP_BAN_DAU', 'XUAT_KHO', 'NHAP_KHO', 'PHAN_BO', 'LUAN_CHUYEN', 'CHO_MUON', 'TRA_VE_KHO', 'DIEU_CHINH_KIEM_KE', 'XUAT_LINH_KIEN') NOT NULL;

-- AlterTable
ALTER TABLE `photos` ADD COLUMN `part_issue_id` VARCHAR(30) NULL,
    MODIFY `kind` ENUM('HIEN_TRANG', 'ANH_XUAT', 'ANH_NHAN', 'BAO_HONG', 'KIEM_KE', 'BBBG', 'KIOSK_BACKGROUND', 'LINH_KIEN') NOT NULL;

-- CreateTable
CREATE TABLE `part_replacement_reasons` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `part_replacement_reasons_name_key`(`name`),
    INDEX `part_replacement_reasons_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `part_issues` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `request_id` VARCHAR(30) NOT NULL,
    `asset_id` VARCHAR(30) NULL,
    `part_name` VARCHAR(191) NULL,
    `vendor_code` VARCHAR(128) NULL,
    `quantity` INTEGER NOT NULL,
    `reason_id` VARCHAR(30) NOT NULL,
    `note` TEXT NULL,
    `from_location_id` VARCHAR(30) NULL,
    `movement_id` VARCHAR(30) NULL,
    `issued_by_id` VARCHAR(30) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `part_issues_code_key`(`code`),
    UNIQUE INDEX `part_issues_movement_id_key`(`movement_id`),
    INDEX `part_issues_request_id_idx`(`request_id`),
    INDEX `part_issues_asset_id_idx`(`asset_id`),
    INDEX `part_issues_from_location_id_issued_at_idx`(`from_location_id`, `issued_at`),
    INDEX `part_issues_issued_at_idx`(`issued_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `photos_part_issue_id_idx` ON `photos`(`part_issue_id`);

-- AddForeignKey
ALTER TABLE `part_replacement_reasons` ADD CONSTRAINT `part_replacement_reasons_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `part_issues` ADD CONSTRAINT `part_issues_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `part_issues` ADD CONSTRAINT `part_issues_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `part_issues` ADD CONSTRAINT `part_issues_reason_id_fkey` FOREIGN KEY (`reason_id`) REFERENCES `part_replacement_reasons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `part_issues` ADD CONSTRAINT `part_issues_from_location_id_fkey` FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `part_issues` ADD CONSTRAINT `part_issues_movement_id_fkey` FOREIGN KEY (`movement_id`) REFERENCES `movements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `part_issues` ADD CONSTRAINT `part_issues_issued_by_id_fkey` FOREIGN KEY (`issued_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_part_issue_id_fkey` FOREIGN KEY (`part_issue_id`) REFERENCES `part_issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
