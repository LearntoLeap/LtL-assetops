-- AlterTable
ALTER TABLE `photos` MODIFY `kind` ENUM('HIEN_TRANG', 'ANH_XUAT', 'ANH_NHAN', 'BAO_HONG', 'KIEM_KE', 'BBBG', 'KIOSK_BACKGROUND', 'LINH_KIEN', 'WIKI') NOT NULL;

-- CreateTable
CREATE TABLE `wiki_articles` (
    `id` VARCHAR(30) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `tieuDe` VARCHAR(191) NOT NULL,
    `tomTat` VARCHAR(500) NULL,
    `moTa` TEXT NULL,
    `huongDan` TEXT NULL,
    `cover_photo_id` VARCHAR(30) NULL,
    `status` ENUM('BAN_NHAP', 'DA_DANG') NOT NULL DEFAULT 'BAN_NHAP',
    `tim_kiem` TEXT NOT NULL,
    `created_by_id` VARCHAR(30) NULL,
    `updated_by_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wiki_articles_slug_key`(`slug`),
    INDEX `wiki_articles_status_updated_at_idx`(`status`, `updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wiki_links` (
    `id` VARCHAR(30) NOT NULL,
    `article_id` VARCHAR(30) NOT NULL,
    `asset_id` VARCHAR(30) NULL,
    `category_id` VARCHAR(30) NULL,
    `product_line_id` VARCHAR(30) NULL,

    INDEX `wiki_links_asset_id_idx`(`asset_id`),
    INDEX `wiki_links_category_id_idx`(`category_id`),
    INDEX `wiki_links_product_line_id_idx`(`product_line_id`),
    UNIQUE INDEX `wiki_links_article_id_asset_id_key`(`article_id`, `asset_id`),
    UNIQUE INDEX `wiki_links_article_id_category_id_key`(`article_id`, `category_id`),
    UNIQUE INDEX `wiki_links_article_id_product_line_id_key`(`article_id`, `product_line_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wiki_items` (
    `id` VARCHAR(30) NOT NULL,
    `article_id` VARCHAR(30) NOT NULL,
    `loai` ENUM('THANH_PHAN', 'LUU_Y', 'LOI_THUONG_GAP', 'THONG_SO') NOT NULL,
    `tieuDe` VARCHAR(191) NOT NULL,
    `noiDung` TEXT NULL,
    `so_luong` INTEGER NULL,
    `don_vi` VARCHAR(32) NULL,
    `mucDo` ENUM('THONG_TIN', 'CAN_THAN', 'NGUY_HIEM') NULL,
    `asset_id` VARCHAR(30) NULL,
    `thu_tu` INTEGER NOT NULL DEFAULT 0,

    INDEX `wiki_items_article_id_loai_thu_tu_idx`(`article_id`, `loai`, `thu_tu`),
    INDEX `wiki_items_asset_id_idx`(`asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wiki_docs` (
    `id` VARCHAR(30) NOT NULL,
    `article_id` VARCHAR(30) NOT NULL,
    `loai` ENUM('HUONG_DAN_HANG', 'HUONG_DAN_NOI_BO', 'SO_DO_MACH', 'PHAN_MEM_FIRMWARE', 'BAO_HANH', 'DAO_TAO', 'KHAC') NOT NULL DEFAULT 'KHAC',
    `tieuDe` VARCHAR(191) NOT NULL,
    `moTa` TEXT NULL,
    `file_path` VARCHAR(255) NULL,
    `file_name` VARCHAR(191) NULL,
    `mime_type` VARCHAR(128) NULL,
    `byte_size` INTEGER NULL,
    `checksum` VARCHAR(64) NULL,
    `lien_ket_ngoai` VARCHAR(1000) NULL,
    `uploaded_by_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `thu_tu` INTEGER NOT NULL DEFAULT 0,

    INDEX `wiki_docs_article_id_thu_tu_idx`(`article_id`, `thu_tu`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wiki_revisions` (
    `id` VARCHAR(30) NOT NULL,
    `article_id` VARCHAR(30) NOT NULL,
    `phien_ban` INTEGER NOT NULL,
    `anh_chup` JSON NOT NULL,
    `ly_do` VARCHAR(255) NULL,
    `sua_boi_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wiki_revisions_article_id_created_at_idx`(`article_id`, `created_at`),
    UNIQUE INDEX `wiki_revisions_article_id_phien_ban_key`(`article_id`, `phien_ban`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `wiki_articles` ADD CONSTRAINT `wiki_articles_cover_photo_id_fkey` FOREIGN KEY (`cover_photo_id`) REFERENCES `photos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_articles` ADD CONSTRAINT `wiki_articles_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_articles` ADD CONSTRAINT `wiki_articles_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_links` ADD CONSTRAINT `wiki_links_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `wiki_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_links` ADD CONSTRAINT `wiki_links_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_links` ADD CONSTRAINT `wiki_links_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_links` ADD CONSTRAINT `wiki_links_product_line_id_fkey` FOREIGN KEY (`product_line_id`) REFERENCES `product_lines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_items` ADD CONSTRAINT `wiki_items_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `wiki_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_items` ADD CONSTRAINT `wiki_items_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_docs` ADD CONSTRAINT `wiki_docs_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `wiki_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_docs` ADD CONSTRAINT `wiki_docs_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_revisions` ADD CONSTRAINT `wiki_revisions_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `wiki_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wiki_revisions` ADD CONSTRAINT `wiki_revisions_sua_boi_id_fkey` FOREIGN KEY (`sua_boi_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
