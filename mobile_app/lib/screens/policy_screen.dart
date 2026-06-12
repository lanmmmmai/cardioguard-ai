import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../ui/cg_tokens.dart';

class PolicyScreen extends StatelessWidget {
  final String type; // 'privacy', 'terms', 'data-deletion'

  const PolicyScreen({
    super.key,
    required this.type,
  });

  String _getTitle() {
    if (type == 'privacy') return 'Chính sách Bảo mật';
    if (type == 'terms') return 'Điều khoản Dịch vụ';
    return 'Yêu cầu Xóa dữ liệu';
  }

  Widget _buildContent(BuildContext context, Color textColor, Color subtitleColor) {
    if (type == 'privacy') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Icon(
              LucideIcons.shieldCheck,
              size: 48,
              color: CgColors.primary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Chính sách Bảo mật CardioGuard AI',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textColor),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Cập nhật lần cuối: 4 tháng 6, 2026',
            style: TextStyle(fontSize: 12, color: subtitleColor, fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 20),
          _sectionTitle('1. Thu thập dữ liệu', textColor),
          _bodyText(
            'CardioGuard AI thu thập thông tin cá nhân và dữ liệu sinh học của bạn nhằm phục vụ mục đích theo dõi sức khỏe tim mạch theo thời gian thực. Các dữ liệu bao gồm:\n'
            '• Họ tên, địa chỉ email, số điện thoại.\n'
            '• Tuổi, giới tính, địa chỉ cá nhân.\n'
            '• Chỉ số nhịp tim (HR), nồng độ oxy (SpO2), huyết áp (BP) và sóng điện tâm đồ (ECG) ghi nhận từ cảm biến.',
            textColor,
          ),
          _sectionTitle('2. Cách sử dụng thông tin', textColor),
          _bodyText(
            'Chúng tôi sử dụng thông tin của bạn để:\n'
            '• Hiển thị trực quan trạng thái sức khỏe hiện tại trên ứng dụng di động.\n'
            '• Phát hiện bất thường qua mô hình trí tuệ nhân tạo và gửi cảnh báo sớm.\n'
            '• Đồng bộ thông tin đến bác sĩ điều trị được phân công để hỗ trợ theo dõi từ xa.',
            textColor,
          ),
          _sectionTitle('3. Bảo mật & Chia sẻ dữ liệu', textColor),
          _bodyText(
            'Dữ liệu của bạn được truyền tải mã hóa bảo mật SSL/TLS. Chúng tôi cam kết tuyệt đối không bán hoặc cung cấp thông tin y tế của bạn cho bên thứ ba vì mục đích quảng cáo thương mại. Dữ liệu chỉ được chia sẻ với bác sĩ điều trị và quản trị viên bệnh viện được ủy quyền.',
            textColor,
          ),
        ],
      );
    } else if (type == 'terms') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Icon(
              LucideIcons.fileText,
              size: 48,
              color: Colors.green,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Điều khoản Dịch vụ CardioGuard AI',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textColor),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Cập nhật lần cuối: 4 tháng 6, 2026',
            style: TextStyle(fontSize: 12, color: subtitleColor, fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.red.withValues(alpha: 0.2)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(LucideIcons.alertTriangle, color: Colors.red, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'LƯU Ý QUAN TRỌNG:\nCardioGuard AI là một hệ thống hỗ trợ giám sát tim mạch. Nền tảng này không thay thế cho các chẩn đoán trực tiếp của bác sĩ hoặc các dịch vụ cấp cứu y khoa khẩn cấp.',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: textColor, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _sectionTitle('1. Chấp thuận điều khoản', textColor),
          _bodyText(
            'Bằng việc cài đặt ứng dụng và đăng ký tài khoản, bạn đồng ý tuân thủ các quy định dịch vụ này. Nếu không đồng ý, vui lòng ngừng sử dụng ứng dụng.',
            textColor,
          ),
          _sectionTitle('2. Trách nhiệm người dùng', textColor),
          _bodyText(
            'Bạn có trách nhiệm bảo mật mật khẩu tài khoản và cung cấp thông tin liên hệ chính xác để bác sĩ có thể liên hệ ngay khi nhận được cảnh báo chỉ số sức khỏe nguy hiểm.',
            textColor,
          ),
          _sectionTitle('3. Bản quyền phần mềm', textColor),
          _bodyText(
            'Giao diện, mã nguồn, mô hình AI và các thuật toán phân tích thuộc quyền sở hữu độc quyền của CardioGuard AI. Mọi hành vi sao chép hoặc can thiệp trái phép đều bị nghiêm cấm.',
            textColor,
          ),
        ],
      );
    } else {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Icon(
              LucideIcons.trash2,
              size: 48,
              color: Colors.orange,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Yêu cầu Xóa dữ liệu Người dùng',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textColor),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          _sectionTitle('Quy trình xóa dữ liệu của bạn', textColor),
          _bodyText(
            'Theo chính sách bảo vệ dữ liệu người dùng của Meta và CardioGuard AI, bạn có quyền yêu cầu xóa vĩnh viễn tài khoản và toàn bộ thông tin lưu trữ liên kết.',
            textColor,
          ),
          _sectionTitle('Cách thức thực hiện xóa dữ liệu', textColor),
          _bodyText(
            'Cách 1: Gửi email trực tiếp đến hòm thư hỗ trợ support@cardioguard.ai với tiêu đề "Yêu cầu xóa dữ liệu tài khoản CardioGuard AI" và ghi rõ email đăng ký của bạn. Quản trị viên sẽ xử lý xóa hoàn toàn trong vòng 48 giờ làm việc.\n\n'
            'Cách 2: Đăng nhập ứng dụng di động, đi tới màn hình Cá nhân -> Cài đặt nâng cao và nhấn nút "Yêu cầu xóa tài khoản". Dữ liệu sẽ tự động được đưa vào danh sách xóa hàng đợi.',
            textColor,
          ),
          _sectionTitle('Các dữ liệu sẽ bị xóa vĩnh viễn', textColor),
          _bodyText(
            '• Thông tin định danh tài khoản cá nhân.\n'
            '• Toàn bộ lịch sử đo đạc nhịp tim, SpO2, huyết áp và ECG.\n'
            '• Đơn thuốc, hồ sơ bệnh lý và các tin nhắn trao đổi.',
            textColor,
          ),
        ],
      );
    }
  }

  Widget _sectionTitle(String title, Color textColor) {
    return Padding(
      padding: const EdgeInsets.only(top: 16.0, bottom: 6.0),
      child: Text(
        title,
        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: textColor),
      ),
    );
  }

  Widget _bodyText(String text, Color textColor) {
    return Text(
      text,
      style: TextStyle(fontSize: 13, color: textColor.withValues(alpha: 0.8), height: 1.5),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.white60 : Colors.black54;
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _getTitle(),
          style: TextStyle(fontWeight: FontWeight.bold, color: textColor, fontSize: 16),
        ),
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Container(
          padding: const EdgeInsets.all(20.0),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(CgRadius.lg),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.05),
            ),
          ),
          child: _buildContent(context, textColor, subtitleColor),
        ),
      ),
    );
  }
}
