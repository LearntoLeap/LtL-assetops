-- Cập nhật onsite theo điểm trường: CHỈ THÊM bảng / cột / giá trị enum mới.
-- Không sửa, không xoá dữ liệu cũ.

-- AlterTable
ALTER TABLE `photos` ADD COLUMN `onsite_visit_id` VARCHAR(30) NULL,
    MODIFY `kind` ENUM('HIEN_TRANG', 'ANH_XUAT', 'ANH_NHAN', 'BAO_HONG', 'KIEM_KE', 'BBBG', 'KIOSK_BACKGROUND', 'LINH_KIEN', 'WIKI', 'ONSITE') NOT NULL;

-- CreateTable
CREATE TABLE `onsite_visits` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `location_id` VARCHAR(30) NOT NULL,
    `visited_at` DATETIME(3) NOT NULL,
    `summary` TEXT NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `onsite_visits_code_key`(`code`),
    INDEX `onsite_visits_location_id_visited_at_idx`(`location_id`, `visited_at`),
    INDEX `onsite_visits_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onsite_visit_items` (
    `id` VARCHAR(30) NOT NULL,
    `visit_id` VARCHAR(30) NOT NULL,
    `asset_id` VARCHAR(30) NOT NULL,
    `system_quantity` INTEGER NOT NULL,
    `seen_quantity` INTEGER NULL,
    `condition` ENUM('TOT', 'DANG_SU_DUNG', 'CAN_BAO_TRI', 'HONG', 'DANG_BAO_HANH', 'MAT') NOT NULL,
    `note` VARCHAR(500) NULL,

    INDEX `onsite_visit_items_asset_id_idx`(`asset_id`),
    UNIQUE INDEX `onsite_visit_items_visit_id_asset_id_key`(`visit_id`, `asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `photos_onsite_visit_id_idx` ON `photos`(`onsite_visit_id`);

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_onsite_visit_id_fkey` FOREIGN KEY (`onsite_visit_id`) REFERENCES `onsite_visits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onsite_visits` ADD CONSTRAINT `onsite_visits_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onsite_visits` ADD CONSTRAINT `onsite_visits_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onsite_visit_items` ADD CONSTRAINT `onsite_visit_items_visit_id_fkey` FOREIGN KEY (`visit_id`) REFERENCES `onsite_visits`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onsite_visit_items` ADD CONSTRAINT `onsite_visit_items_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

