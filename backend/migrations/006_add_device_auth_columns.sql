-- Thêm cột địa chỉ MAC của thiết bị để nhận dạng thiết bị phần cứng duy nhất
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_mac TEXT;
-- Thêm cột mã băm của token thiết bị để xác thực thiết bị an toàn
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_token_hash TEXT;
-- Thêm cột thời gian xoay vòng token gần nhất để theo dõi lịch sử thay đổi token
ALTER TABLE devices ADD COLUMN IF NOT EXISTS token_last_rotated_at TIMESTAMPTZ;
-- Thêm cột phiên bản firmware hiện tại của thiết bị
ALTER TABLE devices ADD COLUMN IF NOT EXISTS firmware_version TEXT;
-- Thêm cột dữ liệu mở rộng dạng JSONB để lưu thông tin bổ sung của thiết bị
ALTER TABLE devices ADD COLUMN IF NOT EXISTS metadata JSONB;
-- Thêm cột số serial để nhận dạng thiết bị theo nhà sản xuất
ALTER TABLE devices ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Tạo chỉ mục duy nhất trên địa chỉ MAC đã được chuẩn hóa, loại bỏ dấu hai chấm và dấu gạch ngang, chuyển thành chữ thường
CREATE UNIQUE INDEX IF NOT EXISTS ux_devices_device_mac
ON devices (lower(replace(replace(device_mac, ':', ''), '-', '')));
