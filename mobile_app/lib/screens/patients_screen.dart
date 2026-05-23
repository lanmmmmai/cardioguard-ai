import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/api_service.dart';
import 'patient_detail_screen.dart';

class PatientsScreen extends StatefulWidget {
  final bool isDarkTheme;
  const PatientsScreen({super.key, required this.isDarkTheme});

  @override
  State<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends State<PatientsScreen> {
  List<dynamic> _patients = [];
  List<dynamic> _filteredPatients = [];
  bool _isLoading = false;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPatients();
    _searchController.addListener(_onSearchChanged);
  }

  Future<void> _loadPatients() async {
    setState(() {
      _isLoading = true;
    });
    final list = await ApiService.getPatients();
    setState(() {
      _patients = list;
      _filteredPatients = list;
      _isLoading = false;
    });
  }

  void _onSearchChanged() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredPatients = _patients.where((p) {
        final name = (p['full_name'] as String).toLowerCase();
        final history = (p['medical_history'] as String? ?? '').toLowerCase();
        return name.contains(query) || history.contains(query);
      }).toList();
    });
  }

  void _showAddPatientBottomSheet() {
    final nameController = TextEditingController();
    final ageController = TextEditingController();
    final phoneController = TextEditingController();
    final addressController = TextEditingController();
    final historyController = TextEditingController();
    String gender = 'Nam';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: widget.isDarkTheme ? const Color(0xFF131720) : Colors.white,
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
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Thêm Bệnh Nhân Mới',
                      style: TextStyle(
                        fontFamily: 'Futura',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: widget.isDarkTheme ? Colors.white : const Color(0xFF1D2939),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: nameController,
                      style: TextStyle(color: widget.isDarkTheme ? Colors.white : Colors.black, fontFamily: 'Futura'),
                      decoration: const InputDecoration(labelText: 'Họ và tên'),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: ageController,
                            keyboardType: TextInputType.number,
                            style: TextStyle(color: widget.isDarkTheme ? Colors.white : Colors.black, fontFamily: 'Futura'),
                            decoration: const InputDecoration(labelText: 'Tuổi'),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: gender,
                            dropdownColor: widget.isDarkTheme ? const Color(0xFF131720) : Colors.white,
                            style: TextStyle(color: widget.isDarkTheme ? Colors.white : Colors.black, fontFamily: 'Futura'),
                            decoration: const InputDecoration(labelText: 'Giới tính'),
                            items: const [
                              DropdownMenuItem(value: 'Nam', child: Text('Nam')),
                              DropdownMenuItem(value: 'Nữ', child: Text('Nữ')),
                              DropdownMenuItem(value: 'Khác', child: Text('Khác')),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setModalState(() {
                                  gender = val;
                                });
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: phoneController,
                      keyboardType: TextInputType.phone,
                      style: TextStyle(color: widget.isDarkTheme ? Colors.white : Colors.black, fontFamily: 'Futura'),
                      decoration: const InputDecoration(labelText: 'Số điện thoại'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: addressController,
                      style: TextStyle(color: widget.isDarkTheme ? Colors.white : Colors.black, fontFamily: 'Futura'),
                      decoration: const InputDecoration(labelText: 'Địa chỉ'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: historyController,
                      maxLines: 2,
                      style: TextStyle(color: widget.isDarkTheme ? Colors.white : Colors.black, fontFamily: 'Futura'),
                      decoration: const InputDecoration(labelText: 'Tiền sử bệnh lý'),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFF3366)),
                        onPressed: () async {
                          final name = nameController.text.trim();
                          final age = int.tryParse(ageController.text.trim()) ?? 0;
                          final phone = phoneController.text.trim();
                          final address = addressController.text.trim();
                          final history = historyController.text.trim();

                          if (name.isEmpty || age == 0 || phone.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Vui lòng nhập đầy đủ các trường bắt buộc')),
                            );
                            return;
                          }

                          final success = await ApiService.addPatient(name, age, gender, phone, address, history);
                          if (success) {
                            if (context.mounted) {
                              Navigator.pop(context);
                              _loadPatients();
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Thêm bệnh nhân thành công!')),
                              );
                            }
                          }
                        },
                        child: const Text('Thêm Bệnh Nhân', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Futura')),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkTheme;
    final primaryBg = isDark ? const Color(0xFF07080A) : const Color(0xFFF5F6F8);
    final cardBg = isDark ? const Color(0xFF11151D).withOpacity(0.7) : Colors.white.withOpacity(0.9);
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark ? Colors.white.withOpacity(0.07) : Colors.black.withOpacity(0.08);

    return Scaffold(
      backgroundColor: primaryBg,
      body: SafeArea(
        child: Column(
          children: [
            // Page Header
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hồ Sơ Bệnh Nhân',
                        style: TextStyle(
                          fontFamily: 'Futura',
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: textColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Danh sách quản lý bệnh nhân nội trú',
                        style: TextStyle(color: textMuted, fontSize: 13, fontFamily: 'Futura'),
                      ),
                    ],
                  ),
                  ElevatedButton.icon(
                    onPressed: _showAddPatientBottomSheet,
                    icon: const Icon(LucideIcons.userPlus, size: 16, color: Colors.white),
                    label: const Text('Thêm mới', style: TextStyle(color: Colors.white, fontFamily: 'Futura')),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFF3366),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  )
                ],
              ),
            ),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: TextField(
                controller: _searchController,
                style: TextStyle(color: textColor, fontFamily: 'Futura'),
                decoration: InputDecoration(
                  hintText: 'Tìm kiếm theo tên hoặc bệnh lý...',
                  hintStyle: TextStyle(color: textMuted, fontFamily: 'Futura'),
                  prefixIcon: Icon(LucideIcons.search, color: textMuted, size: 18),
                  filled: true,
                  fillColor: cardBg,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: borderColor),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFFF3366)),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // List of Patients
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFFFF3366)))
                  : _filteredPatients.isEmpty
                      ? Center(
                          child: Text(
                            'Không tìm thấy bệnh nhân nào.',
                            style: TextStyle(color: textMuted, fontFamily: 'Futura'),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _loadPatients,
                          color: const Color(0xFFFF3366),
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: _filteredPatients.length,
                            itemBuilder: (context, index) {
                              final p = _filteredPatients[index];
                              final String initials = p['full_name'].isNotEmpty ? p['full_name'].substring(0, 1).toUpperCase() : '?';
                              
                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: cardBg,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: borderColor),
                                ),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                  leading: CircleAvatar(
                                    backgroundColor: isDark ? const Color(0xFF131720) : const Color(0xFFEAECF0),
                                    radius: 22,
                                    child: Text(
                                      initials,
                                      style: TextStyle(
                                        color: textColor,
                                        fontWeight: FontWeight.bold,
                                        fontFamily: 'Futura',
                                      ),
                                    ),
                                  ),
                                  title: Text(
                                    p['full_name'],
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: textColor,
                                      fontFamily: 'Futura',
                                    ),
                                  ),
                                  subtitle: Text(
                                    '${p['gender']} - ${p['age']} tuổi\nSĐT: ${p['phone']}',
                                    style: TextStyle(color: textMuted, fontSize: 12, fontFamily: 'Futura'),
                                  ),
                                  trailing: const Icon(LucideIcons.chevronRight, color: Color(0xFFFF3366), size: 18),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => PatientDetailScreen(
                                          patient: p,
                                          isDarkTheme: isDark,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
