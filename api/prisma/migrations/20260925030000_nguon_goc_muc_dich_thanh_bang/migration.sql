-- NGUỒN GỐC và MỤC ĐÍCH SỬ DỤNG: từ enum cứng thành bảng tra cứu sửa được.
--
-- Chuyển dữ liệu chứ KHÔNG xoá: mọi thiết bị đang có đều được ánh xạ sang đúng
-- hàng tương ứng trước khi bỏ cột enum. Thứ tự bắt buộc là tạo bảng → nạp 4+4
-- hàng gốc → thêm cột khoá ngoại (cho phép NULL) → ánh xạ → khoá NOT NULL →
-- mới được bỏ cột cũ. Đảo thứ tự là mất phân loại của toàn bộ kho.
--
-- `id` đặt tay theo mã, không dùng cuid(): MySQL không sinh được cuid, mà bước
-- ánh xạ bên dưới cần biết trước id để nối. Các hàng tạo sau qua ứng dụng vẫn
-- dùng cuid() bình thường.

CREATE TABLE `asset_origins` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `asset_origins_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `asset_purposes` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `asset_purposes_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Bốn giá trị cũ, giữ nguyên mã và nhãn tiếng Việt đang hiện trên giao diện.
INSERT INTO `asset_origins` (`id`, `code`, `name`, `sort_order`, `updated_at`) VALUES
    ('ngoc_nhap_tu_ipp',      'NHAP_TU_IPP',      'Nhập từ IPP',          10, CURRENT_TIMESTAMP(3)),
    ('ngoc_ltl_mua',          'LTL_MUA',          'LtL mua',              20, CURRENT_TIMESTAMP(3)),
    ('ngoc_ltl_muon_doi_tac', 'LTL_MUON_DOI_TAC', 'LtL mượn của đối tác', 30, CURRENT_TIMESTAMP(3)),
    ('ngoc_khac',             'KHAC',             'Khác',                 40, CURRENT_TIMESTAMP(3));

INSERT INTO `asset_purposes` (`id`, `code`, `name`, `sort_order`, `updated_at`) VALUES
    ('mdich_xhh',             'XHH',             'XHH',              10, CURRENT_TIMESTAMP(3)),
    ('mdich_su_kien',         'SU_KIEN',         'Sự kiện',          20, CURRENT_TIMESTAMP(3)),
    ('mdich_co_dinh_tai_kho', 'CO_DINH_TAI_KHO', 'Cố định tại kho',  30, CURRENT_TIMESTAMP(3)),
    ('mdich_cho_muon',        'CHO_MUON',        'Cho mượn',         40, CURRENT_TIMESTAMP(3));

-- Thêm cột khoá ngoại, tạm cho NULL để còn chỗ ánh xạ.
ALTER TABLE `assets`
    ADD COLUMN `origin_id`  VARCHAR(30) NULL,
    ADD COLUMN `purpose_id` VARCHAR(30) NULL;

-- Ánh xạ theo MÃ: giá trị enum cũ trùng đúng cột `code` vừa nạp.
UPDATE `assets` ts
    JOIN `asset_origins` ng ON ng.`code` = ts.`origin`
    SET ts.`origin_id` = ng.`id`;

UPDATE `assets` ts
    JOIN `asset_purposes` md ON md.`code` = ts.`purpose`
    SET ts.`purpose_id` = md.`id`;

-- CHỐT CHẶN, và đây là lý do thứ tự bên dưới không được đảo:
--
-- Khoá NOT NULL và gắn khoá ngoại TRƯỚC, bỏ cột enum SAU. Nếu còn thiết bị nào
-- chưa ánh xạ được thì migration đổ ngay ở hai bước đó, lúc cột enum vẫn còn
-- nguyên — Prisma đánh dấu migration thất bại, CSDL đọc được như cũ, không mất
-- gì. Làm ngược lại (bỏ cột enum trước) thì lúc phát hiện thiếu đã không còn
-- dữ liệu nào để dựng lại.
--
-- Không dùng SELECT/CAST để tự bắn lỗi: tuỳ chế độ máy chủ, cái đó chỉ sinh
-- cảnh báo rồi migration vẫn chạy tiếp. Ràng buộc của chính CSDL thì không.
ALTER TABLE `assets`
    MODIFY COLUMN `origin_id`  VARCHAR(30) NOT NULL,
    MODIFY COLUMN `purpose_id` VARCHAR(30) NOT NULL;

ALTER TABLE `assets`
    ADD CONSTRAINT `assets_origin_id_fkey`
        FOREIGN KEY (`origin_id`) REFERENCES `asset_origins`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `assets_purpose_id_fkey`
        FOREIGN KEY (`purpose_id`) REFERENCES `asset_purposes`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;

-- Qua được hai bước trên nghĩa là mọi thiết bị đã có nguồn gốc / mục đích hợp
-- lệ. Giờ mới bỏ cột cũ.
DROP INDEX `assets_purpose_idx` ON `assets`;

ALTER TABLE `assets`
    DROP COLUMN `origin`,
    DROP COLUMN `purpose`;

CREATE INDEX `assets_origin_id_idx`  ON `assets`(`origin_id`);
CREATE INDEX `assets_purpose_id_idx` ON `assets`(`purpose_id`);
