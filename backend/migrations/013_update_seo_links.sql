-- =============================================================================
-- CardioGuard AI — Update SEO links preview migration
-- File: backend/migrations/013_update_seo_links.sql
-- =============================================================================

-- Xóa các link cũ (nếu trùng) để cập nhật sạch sẽ
DELETE FROM domain_links WHERE domain = 'giatky.site';

-- Seed SEO links previews cho giatky.site theo từng vai trò
INSERT INTO domain_links (url, domain, title, description, image_url)
VALUES
-- Patient routes
('https://giatky.site/login', 'giatky.site', 'CardioGuard AI - Đăng nhập Bệnh nhân', 'Cổng đăng nhập dành cho bệnh nhân sử dụng hệ thống theo dõi sức khỏe thông minh CardioGuard AI.', 'https://giatky.site/og-patient-login.png'),
('https://giatky.site/register', 'giatky.site', 'CardioGuard AI - Đăng ký Bệnh nhân', 'Đăng ký tài khoản bệnh nhân để theo dõi sức khỏe và nhận cảnh báo thông minh thời gian thực.', 'https://giatky.site/og-patient-register.png'),
('https://giatky.site/forgot-password', 'giatky.site', 'CardioGuard AI - Quên mật khẩu Bệnh nhân', 'Khôi phục mật khẩu tài khoản bệnh nhân thông qua Gmail OTP.', 'https://giatky.site/og-patient-forgot.png'),
('https://giatky.site/reset-password', 'giatky.site', 'CardioGuard AI - Đặt lại mật khẩu Bệnh nhân', 'Cài đặt lại mật khẩu mới cho tài khoản bệnh nhân.', 'https://giatky.site/og-patient-reset.png'),
('https://giatky.site/patient/dashboard', 'giatky.site', 'CardioGuard AI - Dashboard Bệnh nhân', 'Theo dõi chỉ số nhịp tim, SpO2, huyết áp và ECG của bạn trực tuyến thời gian thực.', 'https://giatky.site/og-patient-dashboard.png'),

-- Doctor routes
('https://giatky.site/login-doctor', 'giatky.site', 'CardioGuard AI - Đăng nhập Bác sĩ', 'Cổng đăng nhập dành cho bác sĩ theo dõi bệnh nhân và dữ liệu sức khỏe thời gian thực.', 'https://giatky.site/og-doctor-login.png'),
('https://giatky.site/register-doctor', 'giatky.site', 'CardioGuard AI - Đăng ký Bác sĩ', 'Đăng ký tài khoản bác sĩ để quản lý bệnh nhân, lịch hẹn và hỗ trợ tư vấn điều trị.', 'https://giatky.site/og-doctor-register.png'),
('https://giatky.site/forgot-password-doctor', 'giatky.site', 'CardioGuard AI - Quên mật khẩu Bác sĩ', 'Khôi phục mật khẩu tài khoản bác sĩ thông qua Gmail OTP.', 'https://giatky.site/og-doctor-forgot.png'),
('https://giatky.site/reset-password-doctor', 'giatky.site', 'CardioGuard AI - Đặt lại mật khẩu Bác sĩ', 'Cài đặt lại mật khẩu mới cho tài khoản bác sĩ.', 'https://giatky.site/og-doctor-reset.png'),
('https://giatky.site/doctor/dashboard', 'giatky.site', 'CardioGuard AI - Dashboard Bác sĩ', 'Theo dõi danh sách bệnh nhân, xem dữ liệu lâm sàng và hỗ trợ chẩn đoán điều trị.', 'https://giatky.site/og-doctor-dashboard.png'),

-- Admin routes
('https://giatky.site/login-admin', 'giatky.site', 'CardioGuard AI - Đăng nhập Quản trị viên', 'Cổng đăng nhập quản trị hệ thống CardioGuard AI dành cho quản trị viên.', 'https://giatky.site/og-admin-login.png'),
('https://giatky.site/forgot-password-admin', 'giatky.site', 'CardioGuard AI - Quên mật khẩu Quản trị viên', 'Khôi phục mật khẩu tài khoản quản trị viên thông qua Gmail OTP.', 'https://giatky.site/og-admin-forgot.png'),
('https://giatky.site/reset-password-admin', 'giatky.site', 'CardioGuard AI - Đặt lại mật khẩu Quản trị viên', 'Cài đặt lại mật khẩu mới cho tài khoản quản trị viên.', 'https://giatky.site/og-admin-reset.png'),
('https://giatky.site/admin/dashboard', 'giatky.site', 'CardioGuard AI - Dashboard Quản trị viên', 'Quản lý toàn bộ hệ thống, tài khoản người dùng, thiết bị IoT, logs và mẫu email.', 'https://giatky.site/og-admin-dashboard.png')
ON CONFLICT DO NOTHING;
