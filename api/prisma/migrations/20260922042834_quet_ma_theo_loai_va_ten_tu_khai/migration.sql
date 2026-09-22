-- AlterTable
ALTER TABLE `asset_categories` ADD COLUMN `yeu_cau_quet_ma` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `movements` ADD COLUMN `ten_da_khai` VARCHAR(191) NULL;

-- Bật quét mã cho loại ROBOT — loại duy nhất có dán nhãn mã trên từng cái.
-- Bảy loại còn lại (máy tính, tablet, kính VR, sa bàn, ấn phẩm in, phụ kiện,
-- khác) giữ TẮT: xuất–nhập khai TÊN + SỐ LƯỢNG kèm ảnh thay cho quét mã.
-- ADMIN đổi lại được từng loại ở trang Danh mục, không cần sửa mã nguồn.
UPDATE `asset_categories` SET `yeu_cau_quet_ma` = TRUE WHERE `code` = 'ROBOT';
