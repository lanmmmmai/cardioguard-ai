import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';

import '../providers/auth_provider.dart';
import '../core/api_client.dart';
import '../ui/cg_tokens.dart';
import '../widgets/cg_widgets.dart';

class ProfileScreen extends StatefulWidget {
  final bool isDarkTheme;
  const ProfileScreen({super.key, required this.isDarkTheme});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _ageController = TextEditingController();
  final _addressController = TextEditingController();
  final _specialtyController = TextEditingController();
  final _departmentController = TextEditingController();

  String _gender = 'Nam';
  bool _isSaving = false;
  String? _error;
  String? _success;
  File? _selectedImage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
      if (user != null) {
        _fullNameController.text = user.fullName;
        _phoneController.text = user.phone ?? '';
        _specialtyController.text = user.specialty ?? '';
        _departmentController.text = user.department ?? '';
      }
    });
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    _ageController.dispose();
    _addressController.dispose();
    _specialtyController.dispose();
    _departmentController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: 85,
    );
    if (picked != null) {
      setState(() => _selectedImage = File(picked.path));
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _error = null;
      _success = null;
    });

    try {
      final client = ApiClient();
      final data = <String, dynamic>{
        'full_name': _fullNameController.text.trim(),
        'phone': _phoneController.text.trim(),
        'gender': _gender,
      };

      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final role = authProvider.currentUser?.role ?? 'patient';

      if (role == 'patient') {
        if (_ageController.text.isNotEmpty) {
          data['age'] = int.tryParse(_ageController.text) ?? 0;
        }
        data['address'] = _addressController.text.trim();
      } else if (role == 'doctor') {
        data['specialty'] = _specialtyController.text.trim();
        data['department'] = _departmentController.text.trim();
      }

      final response = await client.put('/users/me/profile', data: data);
      if (response.statusCode == 200) {
        setState(() => _success = 'Cập nhật hồ sơ thành công!');
      } else {
        setState(
            () => _error = response.data?['detail'] ?? 'Cập nhật thất bại.');
      }
    } catch (e) {
      setState(() => _error = 'Không thể kết nối máy chủ.');
    } finally {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkTheme;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subColor = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF6B7280);
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.currentUser;
    final role = user?.role ?? 'patient';

    return Scaffold(
      backgroundColor: isDark ? CgColors.background : const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('Hồ sơ cá nhân',
            style: TextStyle(
                color: textColor, fontWeight: FontWeight.w700, fontSize: 18)),
        leading: Navigator.canPop(context)
            ? IconButton(
                icon: Icon(LucideIcons.arrowLeft, color: textColor, size: 20),
                onPressed: () => Navigator.pop(context),
              )
            : null,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Avatar
            Center(
              child: Stack(
                children: [
                  GestureDetector(
                    onTap: _pickImage,
                    child: Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: CgColors.primary.withValues(alpha: 0.15),
                        border: Border.all(
                            color: CgColors.primary.withValues(alpha: 0.4),
                            width: 2),
                      ),
                      child: _selectedImage != null
                          ? ClipOval(
                              child: Image.file(_selectedImage!,
                                  fit: BoxFit.cover))
                          : user?.avatarUrl != null
                              ? ClipOval(
                                  child: Image.network(user!.avatarUrl!,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Icon(
                                          LucideIcons.user,
                                          color: CgColors.primary,
                                          size: 48)))
                              : const Icon(LucideIcons.user,
                                  color: CgColors.primary, size: 48),
                    ),
                  ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: GestureDetector(
                      onTap: _pickImage,
                      child: Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: CgColors.primary,
                          border:
                              Border.all(color: Colors.white, width: 2),
                        ),
                        child: const Icon(LucideIcons.camera,
                            color: Colors.white, size: 15),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(user?.email ?? '',
                style: TextStyle(fontSize: 13, color: subColor)),
            const SizedBox(height: 24),

            CgCard(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Error / success
                    if (_error != null) ...[
                      _Banner(
                          message: _error!,
                          isError: true,
                          isDark: isDark),
                      const SizedBox(height: 14),
                    ],
                    if (_success != null) ...[
                      _Banner(
                          message: _success!,
                          isError: false,
                          isDark: isDark),
                      const SizedBox(height: 14),
                    ],

                    _Label('Họ và tên', textColor),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _fullNameController,
                      decoration: const InputDecoration(
                        prefixIcon: Icon(LucideIcons.user, size: 18),
                        hintText: 'Nguyễn Văn A',
                      ),
                      validator: (v) => (v == null || v.trim().length < 2)
                          ? 'Vui lòng nhập họ tên đầy đủ'
                          : null,
                    ),
                    const SizedBox(height: 14),

                    _Label('Số điện thoại', textColor),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        prefixIcon: Icon(LucideIcons.phone, size: 18),
                        hintText: '0909 000 000',
                      ),
                    ),
                    const SizedBox(height: 14),

                    _Label('Giới tính', textColor),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: _gender,
                      decoration: const InputDecoration(
                          prefixIcon:
                              Icon(LucideIcons.users, size: 18)),
                      items: const [
                        DropdownMenuItem(value: 'Nam', child: Text('Nam')),
                        DropdownMenuItem(value: 'Nữ', child: Text('Nữ')),
                        DropdownMenuItem(
                            value: 'Khác', child: Text('Khác')),
                      ],
                      onChanged: (v) =>
                          setState(() => _gender = v ?? 'Nam'),
                    ),

                    if (role == 'patient') ...[
                      const SizedBox(height: 14),
                      _Label('Tuổi', textColor),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _ageController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          prefixIcon:
                              Icon(LucideIcons.calendar, size: 18),
                          hintText: '30',
                        ),
                      ),
                      const SizedBox(height: 14),
                      _Label('Địa chỉ', textColor),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _addressController,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          prefixIcon:
                              Icon(LucideIcons.mapPin, size: 18),
                          hintText: 'Số nhà, đường, quận, thành phố...',
                        ),
                      ),
                    ],

                    if (role == 'doctor') ...[
                      const SizedBox(height: 14),
                      _Label('Chuyên khoa', textColor),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _specialtyController,
                        decoration: const InputDecoration(
                          prefixIcon:
                              Icon(LucideIcons.stethoscope, size: 18),
                          hintText: 'Tim mạch, Nội khoa...',
                        ),
                      ),
                      const SizedBox(height: 14),
                      _Label('Khoa / Đơn vị', textColor),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _departmentController,
                        decoration: const InputDecoration(
                          prefixIcon:
                              Icon(LucideIcons.building2, size: 18),
                          hintText: 'Khoa Tim mạch...',
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        onPressed: _isSaving ? null : _saveProfile,
                        icon: _isSaving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : const Icon(LucideIcons.save, size: 18),
                        label: Text(
                            _isSaving ? 'Đang lưu...' : 'Lưu hồ sơ',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15)),
                        style: ElevatedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  final Color color;
  const _Label(this.text, this.color);

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: TextStyle(
            fontSize: 13, fontWeight: FontWeight.w600, color: color));
  }
}

class _Banner extends StatelessWidget {
  final String message;
  final bool isError;
  final bool isDark;
  const _Banner(
      {required this.message,
      required this.isError,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    final color = isError ? CgColors.critical : const Color(0xFF10B981);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(
            isError ? LucideIcons.alertCircle : LucideIcons.checkCircle,
            color: color,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
              child: Text(message,
                  style: TextStyle(color: color, fontSize: 13))),
        ],
      ),
    );
  }
}
