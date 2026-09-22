-- AlterTable
ALTER TABLE `assets` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `deleted_by_id` VARCHAR(30) NULL;

-- CreateIndex
CREATE INDEX `assets_deleted_at_idx` ON `assets`(`deleted_at`);

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_deleted_by_id_fkey` FOREIGN KEY (`deleted_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
