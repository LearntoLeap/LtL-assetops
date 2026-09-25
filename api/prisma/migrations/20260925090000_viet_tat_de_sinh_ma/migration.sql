-- VIẾT TẮT cho nguồn gốc, loại tài sản và dòng giải pháp.
--
-- Dùng để sinh mã thiết bị theo dạng {nguồn gốc}-{loại}-{dòng}-{số thứ tự},
-- ví dụ MUA-RB-UKIT-0001. Trước đây mã do người dùng tự gõ, và các viết tắt
-- RB / PC / AP trong dữ liệu mẫu chỉ là chuỗi viết tay, không lưu ở đâu cả.
--
-- Thêm cột cho phép NULL trước → nạp giá trị → mới khoá NOT NULL + UNIQUE.
-- Làm ngược lại thì MySQL nhét chuỗi rỗng vào mọi hàng và UNIQUE đổ ngay.

ALTER TABLE `asset_origins`    ADD COLUMN `viet_tat` VARCHAR(10) NULL;
ALTER TABLE `asset_categories` ADD COLUMN `viet_tat` VARCHAR(10) NULL;
ALTER TABLE `product_lines`    ADD COLUMN `viet_tat` VARCHAR(10) NULL;

-- Viết tắt của các mục nạp sẵn. Phần LOẠI TÀI SẢN cố ý trùng đúng chuỗi đang
-- nằm trong mã thiết bị cũ (LTL-RB-0001, LTL-PC-0001…) để mã cũ và mã mới đọc
-- lên vẫn cùng một quy ước.
UPDATE `asset_origins` SET `viet_tat` = 'IPP'  WHERE `code` = 'NHAP_TU_IPP';
UPDATE `asset_origins` SET `viet_tat` = 'MUA'  WHERE `code` = 'LTL_MUA';
UPDATE `asset_origins` SET `viet_tat` = 'MUON' WHERE `code` = 'LTL_MUON_DOI_TAC';
UPDATE `asset_origins` SET `viet_tat` = 'KHAC' WHERE `code` = 'KHAC';

UPDATE `asset_categories` SET `viet_tat` = 'RB' WHERE `code` = 'ROBOT';
UPDATE `asset_categories` SET `viet_tat` = 'PC' WHERE `code` = 'MAY_TINH';
UPDATE `asset_categories` SET `viet_tat` = 'TB' WHERE `code` = 'TABLET';
UPDATE `asset_categories` SET `viet_tat` = 'VR' WHERE `code` = 'KINH_VR';
UPDATE `asset_categories` SET `viet_tat` = 'SB' WHERE `code` = 'SA_BAN';
UPDATE `asset_categories` SET `viet_tat` = 'AP' WHERE `code` = 'AN_PHAM_IN';
UPDATE `asset_categories` SET `viet_tat` = 'PK' WHERE `code` = 'PHU_KIEN';
UPDATE `asset_categories` SET `viet_tat` = 'KH' WHERE `code` = 'KHAC';

UPDATE `product_lines` SET `viet_tat` = 'UKIT' WHERE `code` = 'UKIT';
UPDATE `product_lines` SET `viet_tat` = 'UGOT' WHERE `code` = 'UGOT';
UPDATE `product_lines` SET `viet_tat` = 'STK'  WHERE `code` = 'STICKEM';
UPDATE `product_lines` SET `viet_tat` = 'AM'   WHERE `code` = 'ALPHA_MINI';
UPDATE `product_lines` SET `viet_tat` = 'YS'   WHERE `code` = 'YANSHEE';
UPDATE `product_lines` SET `viet_tat` = 'WM'   WHERE `code` = 'WEEEMAKE';
UPDATE `product_lines` SET `viet_tat` = 'DKHAC' WHERE `code` = 'KHAC';

-- Hàng do người dùng tự thêm trước khi có cột này (CSDL thật có thể đã có):
-- lấy tạm ID làm viết tắt để chắc chắn không trùng, rồi ADMIN sửa lại sau ở
-- trang Danh mục. Thà xấu mà chạy được còn hơn migration đổ giữa chừng.
UPDATE `asset_origins`    SET `viet_tat` = UPPER(RIGHT(`id`, 6)) WHERE `viet_tat` IS NULL;
UPDATE `asset_categories` SET `viet_tat` = UPPER(RIGHT(`id`, 6)) WHERE `viet_tat` IS NULL;
UPDATE `product_lines`    SET `viet_tat` = UPPER(RIGHT(`id`, 6)) WHERE `viet_tat` IS NULL;

ALTER TABLE `asset_origins`    MODIFY COLUMN `viet_tat` VARCHAR(10) NOT NULL;
ALTER TABLE `asset_categories` MODIFY COLUMN `viet_tat` VARCHAR(10) NOT NULL;
ALTER TABLE `product_lines`    MODIFY COLUMN `viet_tat` VARCHAR(10) NOT NULL;

CREATE UNIQUE INDEX `asset_origins_viet_tat_key`    ON `asset_origins`(`viet_tat`);
CREATE UNIQUE INDEX `asset_categories_viet_tat_key` ON `asset_categories`(`viet_tat`);
CREATE UNIQUE INDEX `product_lines_viet_tat_key`    ON `product_lines`(`viet_tat`);
