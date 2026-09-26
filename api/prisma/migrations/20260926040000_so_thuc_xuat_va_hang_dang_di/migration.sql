-- GHI LẠI SỐ THỰC SỰ MANG RA KHỎI KHO
--
-- Loại "phân bổ về trường" / "luân chuyển trường" chưa ghi movement lúc xuất kho
-- (luồng C: xác nhận của bên nhận mới là lúc đổi quyền sở hữu). Hệ quả: hàng đã
-- lên xe đi rồi mà sổ kho vẫn báo còn nguyên, và số thực sự mang ra không nằm ở
-- đâu trong CSDL — bên nhận bấm xác nhận thì hệ thống lấy theo SỐ ĐÃ DUYỆT chứ
-- không phải số thật.
--
-- Cột này cho NULL: mọi dòng cũ giữ nguyên, nghĩa là "không rõ, lấy theo số duyệt".
ALTER TABLE `request_items`
  ADD COLUMN `issued_quantity` INTEGER NULL;

-- Yêu cầu đã xuất/hoàn tất trước bản này thì coi như mang ra đúng số đã duyệt —
-- đó cũng là giả định mà hệ thống đang chạy, nên không làm đổi con số nào.
UPDATE `request_items` dong
  JOIN `requests` yc ON yc.`id` = dong.`request_id`
   SET dong.`issued_quantity` = dong.`quantity`
 WHERE yc.`status` IN ('DA_XUAT', 'DA_HOAN_TAT');
