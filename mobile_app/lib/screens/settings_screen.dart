import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/auth_provider.dart';
import '../providers/patient_provider.dart';
import '../core/api_client.dart';
import '../ui/cg_tokens.dart';

class SettingsScreen extends StatefulWidget {
  final bool isDarkTheme;
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

  final _macController = TextEditingController();
  final _deviceNameController = TextEditingController();

  bool _isChangingPassword = false;
  bool _isSavingProfile = false;
  String? _profileError;
  String? _passwordError;

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
    _macController.dispose();
    _deviceNameController.dispose();
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
        patientProvider.fetchPairedDevice(authProvider.currentUser!.id);
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

  void _showLogoutModal(BuildContext ctx, AuthProvider authProvider) {
    final isDark = Theme.of(ctx).brightness == Brightness.dark;
    showDialog(
      context: ctx,
      barrierColor: Colors.black54,
      builder: (dialogCtx) {
        bool isLoggingOut = false;
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return Dialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20)),
              backgroundColor:
                  isDark ? const Color(0xFF1A2235) : Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: CgColors.critical.withValues(alpha: 0.12),
                      ),
                      child: const Icon(LucideIcons.logOut,
                          color: CgColors.critical, size: 30),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Đăng xuất?',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : const Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng CardioGuard AI.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        color: isDark
                            ? const Color(0xFF9EA5B4)
                            : const Color(0xFF6B7280),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 28),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: isLoggingOut
                                ? null
                                : () => Navigator.pop(dialogCtx),
                            style: OutlinedButton.styleFrom(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10)),
                            ),
                            child: const Text('Hủy'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isLoggingOut
                                ? null
                                : () async {
                                    setDialogState(
                                        () => isLoggingOut = true);
                                    await authProvider.logout();
                                    if (dialogCtx.mounted) {
                                      Navigator.pop(dialogCtx);
                                    }
                                    if (ctx.mounted) {
                                      Navigator.pushNamedAndRemoveUntil(
                                          ctx,
                                          '/role-select',
                                          (route) => false);
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: CgColors.critical,
                              foregroundColor: Colors.white,
                              padding:
                                  const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10)),
                            ),
                            child: isLoggingOut
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white))
                                : const Text('Đăng xuất',
                                    style: TextStyle(
                                        fontWeight: FontWeight.w700)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

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

  void _showChangePasswordBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
                left: 20,
                right: 20,
                top: 20,
              ),
              child: SingleChildScrollView(
                child: Form(
                  key: _passwordFormKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Đổi Mật Khẩu Mới',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          IconButton(
                            icon: const Icon(LucideIcons.x, size: 20),
                            onPressed: () => Navigator.pop(context),
                          ),
                        ],
                      ),
                      const Divider(),
                      const SizedBox(height: 10),
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
                            style: const TextStyle(color: CgColors.critical, fontSize: 12),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      TextFormField(
                        controller: _currentPasswordController,
                        decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại'),
                        obscureText: true,
                        validator: (v) => (v == null || v.isEmpty)
                            ? 'Vui lòng nhập mật khẩu hiện tại'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _newPasswordController,
                        decoration: const InputDecoration(labelText: 'Mật khẩu mới'),
                        obscureText: true,
                        validator: _validatePasswordPolicy,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _confirmPasswordController,
                        decoration: const InputDecoration(labelText: 'Xác nhận mật khẩu mới'),
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
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _isChangingPassword
                              ? null
                              : () async {
                                  if (!_passwordFormKey.currentState!.validate()) return;
                                  setModalState(() {
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
                                      _currentPasswordController.clear();
                                      _newPasswordController.clear();
                                      _confirmPasswordController.clear();
                                      if (mounted) {
                                        Navigator.pop(context);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(
                                            content: Text('Đổi mật khẩu thành công!'),
                                            backgroundColor: Colors.green,
                                          ),
                                        );
                                      }
                                    }
                                  } catch (e) {
                                    setModalState(() {
                                      _passwordError = 'Mật khẩu hiện tại không đúng hoặc yêu cầu không hợp lệ.';
                                    });
                                  } finally {
                                    setModalState(() {
                                      _isChangingPassword = false;
                                    });
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: CgColors.primary,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: _isChangingPassword
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text('Cập nhật mật khẩu',
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

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
            // User Card
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
                    backgroundColor: Colors.transparent,
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [CgColors.accent, Color(0xFFE11D48)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Center(
                        child: currentUser.avatarUrl != null && currentUser.avatarUrl!.isNotEmpty
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(30),
                                child: Image.network(
                                  currentUser.avatarUrl!,
                                  width: 60,
                                  height: 60,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) =>
                                      Text(
                                    currentUser.fullName.isNotEmpty
                                        ? currentUser.fullName.substring(0, 1).toUpperCase()
                                        : '?',
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 22,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ),
                              )
                            : Text(
                                currentUser.fullName.isNotEmpty
                                    ? currentUser.fullName.substring(0, 1).toUpperCase()
                                    : '?',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold),
                              ),
                      ),
                    ),
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
                                CgColors.accent.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            currentUser.role.toUpperCase(),
                            style: const TextStyle(
                              color: CgColors.accent,
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

            // Profile Edit Form (only for Patient role)
            if (currentUser.role == 'patient') ...[
              const Text('Hồ sơ cá nhân',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: CgColors.accent)),
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
                      DropdownButtonFormField<String>(
                        value: ['Nam', 'Nữ', 'Khác'].contains(_genderController.text) ? _genderController.text : null,
                        decoration: const InputDecoration(labelText: 'Giới tính'),
                        items: ['Nam', 'Nữ', 'Khác']
                            .map((label) => DropdownMenuItem(
                                  value: label,
                                  child: Text(label),
                                ))
                            .toList(),
                        onChanged: (value) {
                          if (value != null) {
                            _genderController.text = value;
                          }
                        },
                        validator: (v) => (v == null || v.isEmpty)
                            ? 'Vui lòng chọn giới tính'
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
              const Text('Thiết bị y tế IoT (Phần cứng)',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: CgColors.accent)),
              const SizedBox(height: 12),
              Consumer<PatientProvider>(
                builder: (context, provider, child) {
                  final device = provider.pairedDevice;
                  final isLoading = provider.isLoadingDevice;

                  if (isLoading) {
                    return Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.07)
                              : Colors.black.withValues(alpha: 0.08),
                        ),
                      ),
                      child: const Center(
                        child: CircularProgressIndicator(),
                      ),
                    );
                  }

                  if (device != null) {
                    // Đã liên kết thiết bị
                    return Container(
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Icon(LucideIcons.cpu, color: CgColors.accent, size: 20),
                                  const SizedBox(width: 8),
                                  Text(
                                    device.deviceName,
                                    style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: device.status == 'online'
                                      ? Colors.green.withValues(alpha: 0.1)
                                      : Colors.red.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  device.status.toUpperCase(),
                                  style: TextStyle(
                                    color: device.status == 'online'
                                        ? Colors.green
                                        : Colors.red,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Divider(),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Địa chỉ MAC:', style: TextStyle(color: textMuted, fontSize: 13)),
                              Text(
                                device.deviceMac,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'monospace'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Loại thiết bị:', style: TextStyle(color: textMuted, fontSize: 13)),
                              Text(
                                device.deviceType,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            height: 48,
                            child: ElevatedButton.icon(
                              onPressed: () async {
                                final result = await provider.unclaimDevice(deviceMac: device.deviceMac);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(result['message'] ?? ''),
                                      backgroundColor: result['success'] ? Colors.green : Colors.red,
                                    ),
                                  );
                                }
                              },
                              icon: const Icon(LucideIcons.trash2, color: Colors.white, size: 16),
                              label: const Text('Hủy liên kết thiết bị', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: CgColors.critical,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  // Chưa liên kết thiết bị
                  return Container(
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Liên kết thiết bị đeo CardioGuard bằng địa chỉ MAC.',
                          style: TextStyle(fontSize: 13),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _macController,
                          decoration: const InputDecoration(
                            labelText: 'Địa chỉ MAC thiết bị',
                            hintText: 'Ví dụ: ac:27:6e:b1:0a:18',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _deviceNameController,
                          decoration: const InputDecoration(
                            labelText: 'Tên thiết bị (Tùy chọn)',
                            hintText: 'Ví dụ: ESP32 Wearable',
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              final mac = _macController.text.trim();
                              if (mac.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Vui lòng nhập địa chỉ MAC'),
                                    backgroundColor: Colors.red,
                                  ),
                                );
                                return;
                              }
                              final name = _deviceNameController.text.trim();
                              final result = await provider.claimDevice(
                                deviceMac: mac,
                                deviceName: name.isNotEmpty ? name : null,
                              );
                              if (result['success']) {
                                _macController.clear();
                                _deviceNameController.clear();
                              }
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(result['message'] ?? ''),
                                    backgroundColor: result['success'] ? Colors.green : Colors.red,
                                  ),
                                );
                              }
                            },
                            icon: const Icon(LucideIcons.plusCircle, color: Colors.white, size: 16),
                            label: const Text('Liên kết thiết bị', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: CgColors.primary,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 24),
            ],

            // Theme Options
            const Text('Hệ thống',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: CgColors.accent)),
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
                activeThumbColor: CgColors.accent,
                onChanged: (_) => widget.onToggleTheme(),
              ),
            ),
            const SizedBox(height: 24),

            // Change Password Button
            const Text('Đổi mật khẩu',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: CgColors.accent)),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: _showChangePasswordBottomSheet,
                icon: const Icon(LucideIcons.keyRound, color: Colors.white, size: 18),
                label: const Text('Đổi mật khẩu tài khoản',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: CgColors.primary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Policies section
            const Text('Điều khoản & Chính sách',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: CgColors.accent)),
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
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(LucideIcons.shieldCheck, color: CgColors.accent, size: 20),
                    title: const Text('Chính sách bảo mật', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => Navigator.pushNamed(context, '/privacy'),
                  ),
                  Divider(
                    height: 1,
                    color: isDark ? Colors.white10 : Colors.black12,
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.fileText, color: CgColors.accent, size: 20),
                    title: const Text('Điều khoản dịch vụ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => Navigator.pushNamed(context, '/terms'),
                  ),
                  Divider(
                    height: 1,
                    color: isDark ? Colors.white10 : Colors.black12,
                  ),
                  ListTile(
                    leading: const Icon(LucideIcons.trash2, color: CgColors.accent, size: 20),
                    title: const Text('Yêu cầu xóa dữ liệu', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                    trailing: const Icon(Icons.chevron_right, size: 20),
                    onTap: () => Navigator.pushNamed(context, '/data-deletion'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Logout Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: OutlinedButton.icon(
                onPressed: () => _showLogoutModal(context, authProvider),
                icon: const Icon(LucideIcons.logOut, color: CgColors.critical),
                label: const Text('Đăng xuất tài khoản',
                    style: TextStyle(
                        color: CgColors.critical, fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: CgColors.critical),
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
