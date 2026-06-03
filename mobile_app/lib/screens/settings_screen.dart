// Màn hình cài đặt tài khoản: chỉnh sửa hồ sơ, chuyển đổi chủ đề, đổi mật khẩu, đăng xuất.
// Quy trình làm việc:
// 1. Khi khởi tạo, nếu người dùng hiện tại là bệnh nhân, tìm nạp hồ sơ của họ qua
//    PatientProvider.fetchMyProfile và điền vào các trường biểu mẫu.
// 2. Biểu mẫu hồ sơ: tuổi, giới tính, điện thoại, địa chỉ, tiền sử bệnh lý — được lưu qua
//    PatientProvider.updateMyProfile.
// 3. Công tắc chủ đề: gọi callback onToggleTheme để chuyển đổi chế độ tối/sáng.
// 4. Đổi mật khẩu: xác thực chính sách (>= 8 ký tự, chữ hoa, chữ thường, chữ số, ký tự đặc biệt),
//    gọi /users/me/password qua ApiClient.
// 5. Đăng xuất: gọi AuthProvider.logout và điều hướng đến /login.
// Mối quan hệ:
// - Sở hữu: AuthProvider, PatientProvider, ApiClient.
// - Callback: onToggleTheme để chuyển đổi chủ đề.
// - Điều hướng: đến /login (đăng xuất).
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/auth_provider.dart';
import '../providers/patient_provider.dart';
import '../core/api_client.dart';
import '../ui/cg_tokens.dart';

// Màn hình cài đặt tài khoản với chỉnh sửa hồ sơ, chuyển đổi chủ đề, đổi mật khẩu và đăng xuất.
class SettingsScreen extends StatefulWidget {
  // Liệu màn hình có sử dụng màu chủ đề tối hay không.
  final bool isDarkTheme;
  // Callback để chuyển đổi giữa chế độ tối và sáng.
  final VoidCallback onToggleTheme;

  const SettingsScreen({
    super.key,
    required this.isDarkTheme,
    required this.onToggleTheme,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _passwordFormKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  final _profileFormKey = GlobalKey<FormState>();
  final _ageController = TextEditingController();
  final _genderController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _historyController = TextEditingController();

  // Liệu một yêu cầu đổi mật khẩu có đang được tiến hành hay không.
  bool _isChangingPassword = false;
  // Liệu một yêu cầu lưu hồ sơ có đang được tiến hành hay không.
  bool _isSavingProfile = false;
  // Thông báo lỗi cho xác thực biểu mẫu hồ sơ/lỗi API.
  String? _profileError;
  // Thông báo lỗi cho xác thực biểu mẫu đổi mật khẩu/lỗi API.
  String? _passwordError;

  // Xác thực độ mạnh mật khẩu: >= 8 ký tự, chữ hoa, chữ thường, chữ số, ký tự đặc biệt.
  String? _validatePasswordPolicy(String? value) {
    final v = value ?? '';
    if (v.length < 8 || v.length > 72) {
      return 'Mật khẩu phải từ 8 đến 72 ký tự';
    }
    if (!RegExp(r'[A-Z]').hasMatch(v)) {
      return 'Mật khẩu phải có ít nhất 1 chữ hoa';
    }
    if (!RegExp(r'[A-Za-z]').hasMatch(v)) {
      return 'Mật khẩu phải chứa chữ cái';
    }
    if (!RegExp(r'\d').hasMatch(v)) {
      return 'Mật khẩu phải có ít nhất 1 chữ số';
    }
    if (!RegExp(r'[^A-Za-z\d]').hasMatch(v)) {
      return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt';
    }
    return null;
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _ageController.dispose();
    _genderController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _historyController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (authProvider.currentUser?.role == 'patient') {
        final patientProvider =
            Provider.of<PatientProvider>(context, listen: false);
        patientProvider.fetchMyProfile().then((_) {
          final profile = patientProvider.currentPatientProfile;
          if (profile != null) {
            _ageController.text = profile.age.toString();
            _genderController.text = profile.gender;
            _phoneController.text = profile.phone;
            _addressController.text = profile.address;
            _historyController.text = profile.medicalHistory;
          }
        });
      }
    });
  }

  // Đổi mật khẩu của người dùng hiện tại qua ApiClient.put đến /users/me/password.
  Future<void> _changePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    setState(() {
      _isChangingPassword = true;
      _passwordError = null;
    });

    try {
      final client = ApiClient();
      final response = await client.put(
        '/users/me/password',
        data: {
          'current_password': _currentPasswordController.text,
          'new_password': _newPasswordController.text,
          'confirm_password': _confirmPasswordController.text,
        },
      );

      if (response.statusCode == 200) {
        if (!mounted) return;
        _currentPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
        setState(() => _passwordError = null);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Đổi mật khẩu thành công!'),
              backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _passwordError =
          'Mật khẩu hiện tại không đúng hoặc yêu cầu không hợp lệ.');
    } finally {
      if (mounted) {
        setState(() => _isChangingPassword = false);
      }
    }
  }

  // Lưu hồ sơ bệnh nhân (tuổi, giới tính, điện thoại, địa chỉ, tiền sử) qua PatientProvider.
  Future<void> _savePatientProfile() async {
    if (!_profileFormKey.currentState!.validate()) return;
    setState(() {
      _isSavingProfile = true;
      _profileError = null;
    });

    final patientProvider =
        Provider.of<PatientProvider>(context, listen: false);
    final age = int.tryParse(_ageController.text);
    if (age == null || age <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập tuổi hợp lệ (số nguyên > 0)'), backgroundColor: Colors.red),
      );
      return;
    }

    final success = await patientProvider.updateMyProfile(
      age: age,
      gender: _genderController.text.trim(),
      phone: _phoneController.text.trim(),
      address: _addressController.text.trim(),
      medicalHistory: _historyController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _isSavingProfile = false);

    if (success) {
      setState(() => _profileError = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Cập nhật hồ sơ thành công!'),
            backgroundColor: Colors.green),
      );
    } else {
      setState(() => _profileError =
          'Không thể cập nhật hồ sơ. Vui lòng kiểm tra lại thông tin.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final currentUser = authProvider.currentUser;
    final isDark = widget.isDarkTheme;

    if (currentUser == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textMuted = isDark
        ? Colors.white.withValues(alpha: 0.5)
        : Colors.black.withValues(alpha: 0.5);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cài đặt tài khoản',
            style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thẻ người dùng
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.07)
                      : Colors.black.withValues(alpha: 0.08),
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor:
                        const Color(0xFFFF3366).withValues(alpha: 0.1),
                    child: const Icon(LucideIcons.user,
                        color: Color(0xFFFF3366), size: 30),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          currentUser.fullName,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          currentUser.email,
                          style: TextStyle(color: textMuted, fontSize: 13),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color:
                                const Color(0xFFFF3366).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            currentUser.role.toUpperCase(),
                            style: const TextStyle(
                              color: Color(0xFFFF3366),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Biểu mẫu chỉnh sửa hồ sơ (chỉ dành cho vai trò bệnh nhân)
            if (currentUser.role == 'patient') ...[
              const Text('Hồ sơ cá nhân',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFFF3366))),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.07)
                        : Colors.black.withValues(alpha: 0.08),
                  ),
                ),
                child: Form(
                  key: _profileFormKey,
                  child: Column(
                    children: [
                      if (_profileError != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: CgColors.critical.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _profileError!,
                            style: const TextStyle(
                                color: CgColors.critical, fontSize: 12),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      TextFormField(
                        controller: _ageController,
                        decoration: const InputDecoration(labelText: 'Tuổi'),
                        keyboardType: TextInputType.number,
                        validator: (v) => (v == null || v.isEmpty)
                            ? 'Vui lòng nhập tuổi'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _genderController,
                        decoration:
                            const InputDecoration(labelText: 'Giới tính'),
                        validator: (v) => (v == null || v.isEmpty)
                            ? 'Vui lòng nhập giới tính'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _phoneController,
                        decoration:
                            const InputDecoration(labelText: 'Số điện thoại'),
                        keyboardType: TextInputType.phone,
                        validator: (v) => (v == null || v.isEmpty)
                            ? 'Vui lòng nhập SĐT'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _addressController,
                        decoration: const InputDecoration(labelText: 'Địa chỉ'),
                        validator: (v) => (v == null || v.isEmpty)
                            ? 'Vui lòng nhập địa chỉ'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _historyController,
                        decoration:
                            const InputDecoration(labelText: 'Tiền sử bệnh án'),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed:
                              _isSavingProfile ? null : _savePatientProfile,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: CgColors.primary,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                          child: _isSavingProfile
                              ? const CircularProgressIndicator(
                                  color: Colors.white)
                              : const Text('Lưu thông tin hồ sơ',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Tùy chọn chủ đề
            const Text('Hệ thống',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFF3366))),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.07)
                      : Colors.black.withValues(alpha: 0.08),
                ),
              ),
              child: SwitchListTile(
                title: const Text('Chế độ tối (Dark Mode)',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                value: widget.isDarkTheme,
                activeThumbColor: const Color(0xFFFF3366),
                onChanged: (_) => widget.onToggleTheme(),
              ),
            ),
            const SizedBox(height: 24),

            // Biểu mẫu đổi mật khẩu
            const Text('Đổi mật khẩu',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFF3366))),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.07)
                      : Colors.black.withValues(alpha: 0.08),
                ),
              ),
              child: Form(
                key: _passwordFormKey,
                child: Column(
                  children: [
                    if (_passwordError != null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: CgColors.critical.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          _passwordError!,
                          style: const TextStyle(
                              color: CgColors.critical, fontSize: 12),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      controller: _currentPasswordController,
                      decoration:
                          const InputDecoration(labelText: 'Mật khẩu hiện tại'),
                      obscureText: true,
                      validator: (v) => (v == null || v.isEmpty)
                          ? 'Vui lòng nhập mật khẩu hiện tại'
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _newPasswordController,
                      decoration:
                          const InputDecoration(labelText: 'Mật khẩu mới'),
                      obscureText: true,
                      validator: _validatePasswordPolicy,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _confirmPasswordController,
                      decoration: const InputDecoration(
                          labelText: 'Xác nhận mật khẩu mới'),
                      obscureText: true,
                      validator: (v) {
                        if (v == null || v.isEmpty) {
                          return 'Vui lòng xác nhận mật khẩu';
                        }
                        if (v != _newPasswordController.text) {
                          return 'Mật khẩu xác nhận không khớp';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _isChangingPassword ? null : _changePassword,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: CgColors.primary,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _isChangingPassword
                            ? const CircularProgressIndicator(
                                color: Colors.white)
                            : const Text('Cập nhật mật khẩu',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Nút đăng xuất
            SizedBox(
              width: double.infinity,
              height: 52,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await authProvider.logout();
                  if (context.mounted) {
                    Navigator.pushNamedAndRemoveUntil(
                        context, '/login', (route) => false);
                  }
                },
                icon: const Icon(LucideIcons.logOut, color: Color(0xFFFF3366)),
                label: const Text('Đăng xuất tài khoản',
                    style: TextStyle(
                        color: Color(0xFFFF3366), fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFFF3366)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}
