-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `role` ENUM('ADMIN', 'VAN_HANH', 'KHO', 'NHAN_SU', 'TRUONG') NOT NULL,
    `department` VARCHAR(191) NULL,
    `location_id` VARCHAR(30) NULL,
    `is_locked` BOOLEAN NOT NULL DEFAULT false,
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_location_id_idx`(`location_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gps_override_codes` (
    `id` VARCHAR(30) NOT NULL,
    `code_hash` VARCHAR(191) NOT NULL,
    `code_prefix` VARCHAR(8) NOT NULL,
    `location_id` VARCHAR(30) NOT NULL,
    `issued_by_id` VARCHAR(30) NOT NULL,
    `issued_for_id` VARCHAR(30) NULL,
    `reason` VARCHAR(255) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `used_by_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `gps_override_codes_code_hash_key`(`code_hash`),
    INDEX `gps_override_codes_location_id_expires_at_idx`(`location_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kiosk_settings` (
    `id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `background_key` VARCHAR(64) NULL,
    `background_photo_id` VARCHAR(30) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `kiosk_settings_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_lines` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_lines_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_categories` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `default_tracking_type` ENUM('DON_VI', 'SO_LUONG') NOT NULL DEFAULT 'DON_VI',
    `note` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_categories_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('KHO_VAN_PHONG', 'DIEM_TRUONG', 'DOI_TAC_MUON', 'KHO_SU_KIEN') NOT NULL,
    `address` TEXT NULL,
    `contact_name` VARCHAR(191) NULL,
    `contact_phone` VARCHAR(32) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `gps_radius_m` INTEGER NULL,
    `note` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `locations_code_key`(`code`),
    INDEX `locations_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(30) NOT NULL,
    `product_line_id` VARCHAR(30) NULL,
    `serial_number` VARCHAR(191) NULL,
    `origin` ENUM('NHAP_TU_IPP', 'LTL_MUA', 'LTL_MUON_DOI_TAC', 'KHAC') NOT NULL,
    `origin_note` VARCHAR(255) NULL,
    `received_date` DATETIME(3) NULL,
    `value` DECIMAL(15, 2) NULL,
    `purpose` ENUM('XHH', 'SU_KIEN', 'CO_DINH_TAI_KHO', 'CHO_MUON') NOT NULL,
    `tracking_type` ENUM('DON_VI', 'SO_LUONG') NOT NULL,
    `current_location_id` VARCHAR(30) NULL,
    `condition` ENUM('TOT', 'DANG_SU_DUNG', 'CAN_BAO_TRI', 'HONG', 'DANG_BAO_HANH', 'MAT') NOT NULL DEFAULT 'TOT',
    `allocation_status` ENUM('TAI_KHO', 'DA_PHAN_BO', 'DANG_VAN_CHUYEN', 'CHO_MUON', 'DANG_PHUC_VU_SU_KIEN') NOT NULL DEFAULT 'TAI_KHO',
    `holder_user_id` VARCHAR(30) NULL,
    `due_return_at` DATETIME(3) NULL,
    `note` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assets_code_key`(`code`),
    INDEX `assets_category_id_idx`(`category_id`),
    INDEX `assets_product_line_id_idx`(`product_line_id`),
    INDEX `assets_current_location_id_idx`(`current_location_id`),
    INDEX `assets_allocation_status_idx`(`allocation_status`),
    INDEX `assets_condition_idx`(`condition`),
    INDEX `assets_purpose_idx`(`purpose`),
    INDEX `assets_holder_user_id_idx`(`holder_user_id`),
    INDEX `assets_due_return_at_idx`(`due_return_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `requests` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `type` ENUM('XUAT_KHO', 'NHAP_KHO', 'PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG', 'CHO_MUON', 'TRA_VE_KHO', 'BAO_HONG') NOT NULL,
    `status` ENUM('BAN_NHAP', 'CHO_DUYET', 'DA_DUYET', 'TU_CHOI', 'DA_XUAT', 'DA_HOAN_TAT') NOT NULL DEFAULT 'BAN_NHAP',
    `created_by_id` VARCHAR(30) NOT NULL,
    `reason` TEXT NOT NULL,
    `from_location_id` VARCHAR(30) NULL,
    `to_location_id` VARCHAR(30) NULL,
    `destination_note` VARCHAR(255) NULL,
    `expected_return_at` DATETIME(3) NULL,
    `submitted_at` DATETIME(3) NULL,
    `approved_by_id` VARCHAR(30) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_note` TEXT NULL,
    `issued_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `requests_code_key`(`code`),
    INDEX `requests_status_created_at_idx`(`status`, `created_at`),
    INDEX `requests_created_by_id_status_idx`(`created_by_id`, `status`),
    INDEX `requests_type_status_idx`(`type`, `status`),
    INDEX `requests_expected_return_at_idx`(`expected_return_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_items` (
    `id` VARCHAR(30) NOT NULL,
    `request_id` VARCHAR(30) NOT NULL,
    `asset_id` VARCHAR(30) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `note` VARCHAR(255) NULL,

    INDEX `request_items_asset_id_idx`(`asset_id`),
    UNIQUE INDEX `request_items_request_id_asset_id_key`(`request_id`, `asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movements` (
    `id` VARCHAR(30) NOT NULL,
    `asset_id` VARCHAR(30) NOT NULL,
    `type` ENUM('NHAP_BAN_DAU', 'XUAT_KHO', 'NHAP_KHO', 'PHAN_BO', 'LUAN_CHUYEN', 'CHO_MUON', 'TRA_VE_KHO', 'DIEU_CHINH_KIEM_KE') NOT NULL,
    `from_location_id` VARCHAR(30) NULL,
    `to_location_id` VARCHAR(30) NULL,
    `request_id` VARCHAR(30) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `condition_before` ENUM('TOT', 'DANG_SU_DUNG', 'CAN_BAO_TRI', 'HONG', 'DANG_BAO_HANH', 'MAT') NULL,
    `condition_after` ENUM('TOT', 'DANG_SU_DUNG', 'CAN_BAO_TRI', 'HONG', 'DANG_BAO_HANH', 'MAT') NULL,
    `performed_by_id` VARCHAR(30) NOT NULL,
    `performed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `movements_asset_id_performed_at_idx`(`asset_id`, `performed_at`),
    INDEX `movements_from_location_id_idx`(`from_location_id`),
    INDEX `movements_to_location_id_idx`(`to_location_id`),
    INDEX `movements_request_id_idx`(`request_id`),
    INDEX `movements_performed_at_idx`(`performed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `photos` (
    `id` VARCHAR(30) NOT NULL,
    `kind` ENUM('HIEN_TRANG', 'ANH_XUAT', 'ANH_NHAN', 'BAO_HONG', 'KIEM_KE', 'BBBG', 'KIOSK_BACKGROUND') NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(64) NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `checksum` VARCHAR(64) NULL,
    `asset_id` VARCHAR(30) NULL,
    `request_id` VARCHAR(30) NULL,
    `movement_id` VARCHAR(30) NULL,
    `count_item_id` VARCHAR(30) NULL,
    `uploaded_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `photos_asset_id_created_at_idx`(`asset_id`, `created_at`),
    INDEX `photos_request_id_idx`(`request_id`),
    INDEX `photos_movement_id_kind_idx`(`movement_id`, `kind`),
    INDEX `photos_count_item_id_idx`(`count_item_id`),
    INDEX `photos_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `handover_notes` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `request_id` VARCHAR(30) NULL,
    `status` ENUM('BAN_NHAP', 'CHO_XAC_NHAN', 'DA_XAC_NHAN', 'TU_CHOI') NOT NULL DEFAULT 'BAN_NHAP',
    `giver_name` VARCHAR(191) NOT NULL,
    `giver_title` VARCHAR(191) NULL,
    `giver_org` VARCHAR(191) NOT NULL,
    `receiver_location_id` VARCHAR(30) NULL,
    `receiver_org` VARCHAR(191) NOT NULL,
    `receiver_name` VARCHAR(191) NOT NULL,
    `receiver_title` VARCHAR(191) NULL,
    `receiver_phone` VARCHAR(32) NULL,
    `issued_date` DATETIME(3) NOT NULL,
    `commitment` TEXT NULL,
    `note` TEXT NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `confirmed_by_id` VARCHAR(30) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `rejection_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `handover_notes_code_key`(`code`),
    INDEX `handover_notes_status_idx`(`status`),
    INDEX `handover_notes_receiver_location_id_idx`(`receiver_location_id`),
    INDEX `handover_notes_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `handover_note_items` (
    `id` VARCHAR(30) NOT NULL,
    `handover_note_id` VARCHAR(30) NOT NULL,
    `asset_id` VARCHAR(30) NOT NULL,
    `asset_code_snapshot` VARCHAR(64) NOT NULL,
    `asset_name_snapshot` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `condition_snapshot` ENUM('TOT', 'DANG_SU_DUNG', 'CAN_BAO_TRI', 'HONG', 'DANG_BAO_HANH', 'MAT') NOT NULL,
    `note` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `handover_note_items_asset_id_idx`(`asset_id`),
    UNIQUE INDEX `handover_note_items_handover_note_id_asset_id_key`(`handover_note_id`, `asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_counts` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location_id` VARCHAR(30) NOT NULL,
    `status` ENUM('BAN_NHAP', 'DANG_KIEM', 'CHO_CHOT', 'DA_CHOT', 'HUY') NOT NULL DEFAULT 'BAN_NHAP',
    `created_by_id` VARCHAR(30) NOT NULL,
    `started_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `closed_by_id` VARCHAR(30) NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_counts_code_key`(`code`),
    INDEX `inventory_counts_location_id_status_idx`(`location_id`, `status`),
    INDEX `inventory_counts_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_count_items` (
    `id` VARCHAR(30) NOT NULL,
    `inventory_count_id` VARCHAR(30) NOT NULL,
    `asset_id` VARCHAR(30) NOT NULL,
    `system_quantity` INTEGER NOT NULL,
    `system_condition` ENUM('TOT', 'DANG_SU_DUNG', 'CAN_BAO_TRI', 'HONG', 'DANG_BAO_HANH', 'MAT') NOT NULL,
    `counted_quantity` INTEGER NULL,
    `counted_condition` ENUM('TOT', 'DANG_SU_DUNG', 'CAN_BAO_TRI', 'HONG', 'DANG_BAO_HANH', 'MAT') NULL,
    `counted_by_id` VARCHAR(30) NULL,
    `counted_at` DATETIME(3) NULL,
    `note` TEXT NULL,
    `adjusted_at` DATETIME(3) NULL,

    INDEX `inventory_count_items_asset_id_idx`(`asset_id`),
    UNIQUE INDEX `inventory_count_items_inventory_count_id_asset_id_key`(`inventory_count_id`, `asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alerts` (
    `id` VARCHAR(30) NOT NULL,
    `type` ENUM('TINH_TRANG_THAY_DOI', 'QUA_HAN_TRA', 'CHENH_LECH_KIEM_KE', 'BAO_HONG', 'DANG_NHAP_NGOAI_VUNG') NOT NULL,
    `severity` ENUM('THAP', 'TRUNG_BINH', 'CAO') NOT NULL DEFAULT 'TRUNG_BINH',
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `asset_id` VARCHAR(30) NULL,
    `request_id` VARCHAR(30) NULL,
    `entity_type` VARCHAR(64) NULL,
    `entity_id` VARCHAR(30) NULL,
    `resolved_at` DATETIME(3) NULL,
    `resolved_by_id` VARCHAR(30) NULL,
    `resolution_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `alerts_resolved_at_created_at_idx`(`resolved_at`, `created_at`),
    INDEX `alerts_type_idx`(`type`),
    INDEX `alerts_asset_id_idx`(`asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_sequences` (
    `id` VARCHAR(30) NOT NULL,
    `prefix` VARCHAR(16) NOT NULL,
    `year` INTEGER NOT NULL,
    `last_number` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `document_sequences_prefix_year_key`(`prefix`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actor_user_id` VARCHAR(30) NULL,
    `actor_email` VARCHAR(191) NULL,
    `actor_role` ENUM('ADMIN', 'VAN_HANH', 'KHO', 'NHAN_SU', 'TRUONG') NULL,
    `action` VARCHAR(96) NOT NULL,
    `entity_type` VARCHAR(64) NOT NULL,
    `entity_id` VARCHAR(64) NULL,
    `before_value` JSON NULL,
    `after_value` JSON NULL,
    `photo_ids` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(191) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `distance_m` INTEGER NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_actor_user_id_created_at_idx`(`actor_user_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gps_override_codes` ADD CONSTRAINT `gps_override_codes_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gps_override_codes` ADD CONSTRAINT `gps_override_codes_issued_by_id_fkey` FOREIGN KEY (`issued_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gps_override_codes` ADD CONSTRAINT `gps_override_codes_issued_for_id_fkey` FOREIGN KEY (`issued_for_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gps_override_codes` ADD CONSTRAINT `gps_override_codes_used_by_id_fkey` FOREIGN KEY (`used_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kiosk_settings` ADD CONSTRAINT `kiosk_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kiosk_settings` ADD CONSTRAINT `kiosk_settings_background_photo_id_fkey` FOREIGN KEY (`background_photo_id`) REFERENCES `photos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_product_line_id_fkey` FOREIGN KEY (`product_line_id`) REFERENCES `product_lines`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_current_location_id_fkey` FOREIGN KEY (`current_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_holder_user_id_fkey` FOREIGN KEY (`holder_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_from_location_id_fkey` FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `requests` ADD CONSTRAINT `requests_to_location_id_fkey` FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_items` ADD CONSTRAINT `request_items_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_items` ADD CONSTRAINT `request_items_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_from_location_id_fkey` FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_to_location_id_fkey` FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movements` ADD CONSTRAINT `movements_performed_by_id_fkey` FOREIGN KEY (`performed_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_movement_id_fkey` FOREIGN KEY (`movement_id`) REFERENCES `movements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_count_item_id_fkey` FOREIGN KEY (`count_item_id`) REFERENCES `inventory_count_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_notes` ADD CONSTRAINT `handover_notes_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_notes` ADD CONSTRAINT `handover_notes_receiver_location_id_fkey` FOREIGN KEY (`receiver_location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_notes` ADD CONSTRAINT `handover_notes_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_notes` ADD CONSTRAINT `handover_notes_confirmed_by_id_fkey` FOREIGN KEY (`confirmed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_note_items` ADD CONSTRAINT `handover_note_items_handover_note_id_fkey` FOREIGN KEY (`handover_note_id`) REFERENCES `handover_notes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handover_note_items` ADD CONSTRAINT `handover_note_items_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_counts` ADD CONSTRAINT `inventory_counts_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_count_items` ADD CONSTRAINT `inventory_count_items_inventory_count_id_fkey` FOREIGN KEY (`inventory_count_id`) REFERENCES `inventory_counts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_count_items` ADD CONSTRAINT `inventory_count_items_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_count_items` ADD CONSTRAINT `inventory_count_items_counted_by_id_fkey` FOREIGN KEY (`counted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

