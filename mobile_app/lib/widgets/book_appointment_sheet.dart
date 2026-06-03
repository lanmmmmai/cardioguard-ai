// Biểu mẫu bottom-sheet để đặt lịch hẹn khám mới.
// Quy trình làm việc:
// 1. Khi khởi tạo, tìm nạp danh sách bác sĩ từ /cms/users qua ApiClient.
// 2. Người dùng chọn bác sĩ, nhập tiêu đề (lý do), chọn ngày/giờ qua
//    showDatePicker / showTimePicker, chọn kênh (offline/online),
//    và tùy chọn thêm ghi chú.
// 3. Khi gửi, gọi AppointmentProvider.bookAppointment và đóng với true.
// Mối quan hệ:
// - Được sử dụng bởi: AppointmentsScreen.
// - Sở hữu: AppointmentProvider, ApiClient.
// - Trả về: true (thành công) hoặc null (đã đóng/lỗi) dưới dạng kết quả pop Navigator.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/appointment_provider.dart';
import '../core/api_client.dart';
import '../core/app_logger.dart';
import '../ui/cg_tokens.dart';

// Biểu mẫu bottom-sheet để đặt lịch hẹn khám mới.
class BookAppointmentSheet extends StatefulWidget {
  // Liệu sheet có sử dụng màu chủ đề tối hay không.
  final bool isDarkTheme;

  const BookAppointmentSheet({super.key, required this.isDarkTheme});

  @override
  State<BookAppointmentSheet> createState() => _BookAppointmentSheetState();
}

class _BookAppointmentSheetState extends State<BookAppointmentSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _notesController = TextEditingController();

  List<dynamic> _doctors = [];
  bool _isLoadingDoctors = true;
  String? _selectedDoctorId;

  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  String _selectedChannel = 'offline'; // offline hoặc online
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchDoctors();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  // Tìm nạp danh sách bác sĩ từ API CMS cho dropdown chọn bác sĩ.
  Future<void> _fetchDoctors() async {
    try {
      final client = ApiClient();
      final response = await client.get('/cms/users',
          queryParameters: {'filter': 'role:doctor', 'limit': 100});
      if (mounted) {
        setState(() {
          _doctors = response.data['items'] ?? [];
          _isLoadingDoctors = false;
        });
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp bác sĩ trong sheet: $e');
      if (mounted) {
        setState(() {
          _isLoadingDoctors = false;
        });
      }
    }
  }

  // Mở bộ chọn ngày và cập nhật _selectedDate.
  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 90)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: widget.isDarkTheme
                ? const ColorScheme.dark(
                    primary: CgColors.primary,
                    onPrimary: Colors.white,
                    surface: Color(0xFF11151D),
                    onSurface: Colors.white,
                  )
                : const ColorScheme.light(
                    primary: CgColors.primary,
                    onPrimary: Colors.white,
                    surface: Colors.white,
                    onSurface: Colors.black,
                  ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  // Mở bộ chọn giờ và cập nhật _selectedTime.
  Future<void> _selectTime(BuildContext context) async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? const TimeOfDay(hour: 9, minute: 0),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: widget.isDarkTheme
                ? const ColorScheme.dark(
                    primary: CgColors.primary,
                    onPrimary: Colors.white,
                    surface: Color(0xFF11151D),
                    onSurface: Colors.white,
                  )
                : const ColorScheme.light(
                    primary: CgColors.primary,
                    onPrimary: Colors.white,
                    surface: Colors.white,
                    onSurface: Colors.black,
                  ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedTime) {
      setState(() {
        _selectedTime = picked;
      });
    }
  }

  // Xác thực tất cả các trường và gửi lịch hẹn qua AppointmentProvider.bookAppointment.
  Future<void> _submitForm() async {
    setState(() => _errorMessage = null);
    if (!_formKey.currentState!.validate()) return;

    if (_selectedDoctorId == null) {
      setState(() => _errorMessage = 'Vui lòng chọn bác sĩ khám');
      return;
    }
    if (_selectedDate == null) {
      setState(() => _errorMessage = 'Vui lòng chọn ngày khám');
      return;
    }
    if (_selectedTime == null) {
      setState(() => _errorMessage = 'Vui lòng chọn giờ khám');
      return;
    }

    setState(() => _isSubmitting = true);

    final scheduledDateTime = DateTime(
      _selectedDate!.year,
      _selectedDate!.month,
      _selectedDate!.day,
      _selectedTime!.hour,
      _selectedTime!.minute,
    );

    final provider = Provider.of<AppointmentProvider>(context, listen: false);
    final ok = await provider.bookAppointment(
      doctorId: _selectedDoctorId!,
      title: _titleController.text.trim(),
      scheduledAt: scheduledDateTime,
      notes: _notesController.text.trim(),
      channel: _selectedChannel,
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (ok) {
        Navigator.pop(context, true);
      } else {
        setState(() => _errorMessage = 'Gửi yêu cầu lịch hẹn thất bại. Vui lòng thử lại.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkTheme;
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.08);

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Đăng Ký Lịch Hẹn Mới',
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: textColor),
                  ),
                  IconButton(
                    icon: Icon(LucideIcons.x, color: textColor),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (_errorMessage != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: CgColors.critical.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: CgColors.critical, fontSize: 12),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Chọn bác sĩ
              Text(
                'BÁC SĨ ĐIỀU TRỊ',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: textMuted,
                    letterSpacing: 0.5),
              ),
              const SizedBox(height: 6),
              _isLoadingDoctors
                  ? const LinearProgressIndicator(color: CgColors.primary)
                  : DropdownButtonFormField<String>(
                      initialValue: _selectedDoctorId,
                      dropdownColor: cardBg,
                      style: TextStyle(color: textColor, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Chọn bác sĩ khám',
                        hintStyle: TextStyle(color: textMuted),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(CgRadius.md),
                          borderSide: BorderSide(color: borderColor),
                        ),
                      ),
                      items: _doctors.map((doc) {
                        return DropdownMenuItem<String>(
                          value: doc['id'] as String,
                          child: Text('BS. ${doc['full_name']}'),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _selectedDoctorId = val;
                          });
                        }
                      },
                    ),
              const SizedBox(height: 14),

              // Nhập tiêu đề
              TextFormField(
                controller: _titleController,
                style: TextStyle(color: textColor, fontSize: 13),
                decoration: const InputDecoration(
                  labelText: 'Lý do khám / Tiêu đề lịch hẹn',
                  hintText: 'e.g. Tái khám nhịp tim, Tư vấn đau ngực...',
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'Vui lòng nhập lý do khám';
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Hàng chọn ngày và giờ
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'NGÀY HẸN KHÁM',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: textMuted),
                        ),
                        const SizedBox(height: 6),
                        InkWell(
                          onTap: () => _selectDate(context),
                          borderRadius: BorderRadius.circular(CgRadius.md),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? Colors.white.withValues(alpha: 0.03)
                                  : Colors.black.withValues(alpha: 0.03),
                              borderRadius: BorderRadius.circular(CgRadius.md),
                              border: Border.all(color: borderColor),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  _selectedDate == null
                                      ? 'Chọn ngày'
                                      : '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}',
                                  style: TextStyle(
                                      color: _selectedDate == null ? textMuted : textColor,
                                      fontSize: 13),
                                ),
                                Icon(LucideIcons.calendar, color: textMuted, size: 16),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'GIỜ HẸN KHÁM',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: textMuted),
                        ),
                        const SizedBox(height: 6),
                        InkWell(
                          onTap: () => _selectTime(context),
                          borderRadius: BorderRadius.circular(CgRadius.md),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? Colors.white.withValues(alpha: 0.03)
                                  : Colors.black.withValues(alpha: 0.03),
                              borderRadius: BorderRadius.circular(CgRadius.md),
                              border: Border.all(color: borderColor),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  _selectedTime == null
                                      ? 'Chọn giờ'
                                      : _selectedTime!.format(context),
                                  style: TextStyle(
                                      color: _selectedTime == null ? textMuted : textColor,
                                      fontSize: 13),
                                ),
                                Icon(LucideIcons.clock, color: textMuted, size: 16),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Chọn kênh khám (Trực tiếp / Trực tuyến)
              Text(
                'HÌNH THỨC KHÁM',
                style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: textMuted,
                    letterSpacing: 0.5),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(
                        child: Text(
                          'Khám Trực Tiếp (Offline)',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                      selected: _selectedChannel == 'offline',
                      onSelected: (val) {
                        if (val) setState(() => _selectedChannel = 'offline');
                      },
                      selectedColor: CgColors.primary.withValues(alpha: 0.15),
                      checkmarkColor: CgColors.primary,
                      backgroundColor: Colors.transparent,
                      labelStyle: TextStyle(
                        color: _selectedChannel == 'offline' ? CgColors.primary : textMuted,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(CgRadius.md),
                        side: BorderSide(
                          color: _selectedChannel == 'offline' ? CgColors.primary : borderColor,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(
                        child: Text(
                          'Khám Trực Tuyến (Online)',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                      selected: _selectedChannel == 'online',
                      onSelected: (val) {
                        if (val) setState(() => _selectedChannel = 'online');
                      },
                      selectedColor: CgColors.primary.withValues(alpha: 0.15),
                      checkmarkColor: CgColors.primary,
                      backgroundColor: Colors.transparent,
                      labelStyle: TextStyle(
                        color: _selectedChannel == 'online' ? CgColors.primary : textMuted,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(CgRadius.md),
                        side: BorderSide(
                          color: _selectedChannel == 'online' ? CgColors.primary : borderColor,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Nhập ghi chú
              TextFormField(
                controller: _notesController,
                style: TextStyle(color: textColor, fontSize: 13),
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Mô tả triệu chứng / Ghi chú cho bác sĩ',
                  hintText: 'Nhập chi tiết các triệu chứng của bạn để bác sĩ nắm được tình hình...',
                ),
              ),
              const SizedBox(height: 20),

              // Nút gửi
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitForm,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Gửi yêu cầu lịch hẹn'),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
