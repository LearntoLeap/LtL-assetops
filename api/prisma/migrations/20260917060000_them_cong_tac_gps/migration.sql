-- Công tắc khoá vị trí theo từng điểm lưu trữ.
--
-- Mặc định TRUE nên mọi điểm đang có giữ nguyên hành vi cũ: không đổi gì với
-- dữ liệu đang chạy. Cần cột riêng vì phép kiểm GPS là fail-safe — thiếu toạ
-- độ thì chặn đăng nhập, nên không thể dùng "toạ độ rỗng" để biểu thị đã tắt.
ALTER TABLE `locations`
  ADD COLUMN `gps_required` BOOLEAN NOT NULL DEFAULT true;
