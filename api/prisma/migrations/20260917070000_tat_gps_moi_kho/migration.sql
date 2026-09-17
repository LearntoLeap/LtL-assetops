-- Tắt khoá vị trí cho MỌI điểm đang có, và đổi mặc định của cột thành tắt.
--
-- Quyết định của LtL: GPS trong nhà lệch 50-200m mà kho nằm trong toà nhà, nên
-- khoá vị trí chặn oan nhân viên đứng ngay trong kho nhiều hơn là chặn được
-- người ở xa; người ra vào kho đã kiểm soát bằng cửa.
--
-- Đặt ngay trong migration để lần cập nhật VPS tự áp — không phải ai đó nhớ
-- vào bấm từng kho. Vẫn giữ cột và công tắc để bật lại được, và server vẫn ghi
-- nhật ký mọi lần đăng nhập kèm toạ độ, chỉ là không chặn nữa.
--
-- Toạ độ KHÔNG bị xoá: còn toạ độ thì nhật ký mới tính được máy cách kho bao xa.
ALTER TABLE `locations` ALTER COLUMN `gps_required` SET DEFAULT false;
UPDATE `locations` SET `gps_required` = false;
