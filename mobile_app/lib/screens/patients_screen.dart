// Màn hình danh sách bệnh nhân với tìm kiếm, chế độ xem chia đôi thích ứng và hộp thoại phân công quản trị viên.
// Quy trình làm việc:
// 1. Khi khởi tạo, tìm nạp danh sách bệnh nhân từ PatientProvider.
// 2. Người dùng có thể tìm kiếm theo tên hoặc tiền sử bệnh lý qua TextField cục bộ.
// 3. Trên điện thoại: nhấn vào bệnh nhân sẽ chuyển đến PatientDetailScreen.
//    Trên máy tính bảng (>= 600 dp): ngăn trái hiển thị danh sách, ngăn phải hiển thị chi tiết cạnh nhau.
// 4. Người dùng quản trị viên thấy nút "Phân công BS" mở _showAssignmentsModal
//    để quản lý phân công bác sĩ-bệnh nhân qua API CMS quản trị viên.
// Mối quan hệ:
// - Sở hữu: PatientProvider, AuthProvider.
// - Sử dụng: ApiClient, CgScreenScaffold, CgInlineState, PatientDetailScreen.
// - Hộp thoại quản trị viên tìm nạp phân công và danh sách bác sĩ từ /admin/assignments và /cms/users.
import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/patient_provider.dart';
import '../providers/auth_provider.dart';
import '../core/api_client.dart';
import 'patient_detail_screen.dart';
import '../widgets/cg_widgets.dart';
import '../ui/cg_tokens.dart';

// Màn hình liệt kê tất cả bệnh nhân với tìm kiếm, chế độ xem chia đôi thích ứng và phân công quản trị viên.
class PatientsScreen extends StatefulWidget {
  // Liệu màn hình có sử dụng màu chủ đề tối hay không.
  final bool isDarkTheme;
  const PatientsScreen({super.key, required this.isDarkTheme});

  @override
  State<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends State<PatientsScreen> {
  // Bộ điều khiển cho trường văn bản tìm kiếm bệnh nhân.
  final _searchController = TextEditingController();
  // Truy vấn tìm kiếm đã được chuyển thành chữ thường được sử dụng để lọc danh sách bệnh nhân cục bộ.
  String _searchQuery = '';
  // Bệnh nhân hiện được chọn (cho bảng chi tiết chế độ xem chia đôi trên máy tính bảng).
  Map<String, dynamic>? _selectedPatient;
  List<dynamic> _adminAssignments = [];

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final patientProvider = Provider.of<PatientProvider>(context, listen: false);
      await patientProvider.fetchPatients();
      if (authProvider.currentUser?.role == 'admin') {
        _fetchAdminAssignments();
      }
    });
  }

  Future<void> _fetchAdminAssignments() async {
    try {
      final client = ApiClient();
      final response = await client.get('/admin/assignments');
      if (response.statusCode == 200) {
        setState(() {
          _adminAssignments = response.data as List<dynamic>? ?? [];
        });
      }
    } catch (e) {
      AppLogger.log('Error fetching admin assignments: $e');
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Mở một bottom-sheet để quản trị viên xem/thêm/xóa phân công bác sĩ-bệnh nhân.
  void _showAssignmentsModal() {
    final client = ApiClient();
    List<dynamic> assignments = [];
    List<dynamic> doctors = [];
    bool modalLoading = true;
    String? selectedDoctorId;
    String? selectedPatientId;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor:
          widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            // Trình tải ban đầu
            if (modalLoading) {
              Future.wait([
                client.get('/admin/assignments'),
                client.get('/cms/users',
                    queryParameters: {'filter': 'role:doctor', 'limit': 100})
              ]).then((responses) {
                setModalState(() {
                  assignments = responses[0].data;
                  doctors = responses[1].data['items'] ?? [];
                  modalLoading = false;
                });
              }).catchError((e) {
                AppLogger.log('Lỗi tìm nạp dữ liệu hộp thoại: $e');
                setModalState(() => modalLoading = false);
              });
            }

            final patientProvider = Provider.of<PatientProvider>(context);
            final itemBg = widget.isDarkTheme
                ? const Color(0xFF1C222D)
                : Colors.black.withValues(alpha: 0.02);

            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
                left: 20,
                right: 20,
                top: 20,
              ),
              child: SizedBox(
                height: MediaQuery.of(context).size.height * 0.75,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Quản Lý Phân Công Bác Sĩ',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        IconButton(
                          icon: const Icon(LucideIcons.x),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const Divider(),
                    const SizedBox(height: 8),

                    // Biểu mẫu thêm phân công
                    const Text('THÊM PHÂN CÔNG MỚI',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFFF3366))),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        // Dropdown bác sĩ
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            hint: const Text('Bác sĩ',
                                style: TextStyle(fontSize: 12)),
                            initialValue: selectedDoctorId,
                            dropdownColor: widget.isDarkTheme
                                ? const Color(0xFF11151D)
                                : Colors.white,
                            items: doctors.map((doc) {
                              return DropdownMenuItem<String>(
                                value: doc['id'] as String,
                                child: Text(doc['full_name'] as String,
                                    style: const TextStyle(fontSize: 12)),
                              );
                            }).toList(),
                            onChanged: (id) =>
                                setModalState(() => selectedDoctorId = id),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Dropdown bệnh nhân
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            hint: const Text('Bệnh nhân',
                                style: TextStyle(fontSize: 12)),
                            initialValue: selectedPatientId,
                            dropdownColor: widget.isDarkTheme
                                ? const Color(0xFF11151D)
                                : Colors.white,
                            items: patientProvider.patients.map((p) {
                              return DropdownMenuItem<String>(
                                value: p.id,
                                child: Text(p.fullName,
                                    style: const TextStyle(fontSize: 12)),
                              );
                            }).toList(),
                            onChanged: (id) =>
                                setModalState(() => selectedPatientId = id),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Nút thêm
                        IconButton(
                          icon: const Icon(LucideIcons.plusCircle,
                              color: Color(0xFFFF3366)),
                          onPressed: (selectedDoctorId == null ||
                                  selectedPatientId == null)
                              ? null
                              : () async {
                                  try {
                                    final res = await client
                                        .post('/admin/assignments', data: {
                                      'doctor_id': selectedDoctorId,
                                      'patient_id': selectedPatientId,
                                    });
                                    if (res.statusCode == 200 ||
                                        res.statusCode == 201) {
                                      selectedDoctorId = null;
                                      selectedPatientId = null;
                                      modalLoading = true; // làm mới
                                      setModalState(() {});
                                      patientProvider
                                          .fetchPatients(); // làm mới danh sách bệnh nhân chính
                                    }
                                  } catch (e) {
                                    if (!context.mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                          content: Text(
                                              'Lỗi phân công (Có thể đã phân công trước đó)')),
                                    );
                                  }
                                },
                        )
                      ],
                    ),
                    const SizedBox(height: 20),

                    const Text('DANH SÁCH ĐÃ PHÂN CÔNG',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFFF3366))),
                    const SizedBox(height: 10),

                    // Danh sách phân công
                    Expanded(
                      child: modalLoading
                          ? const Center(child: CircularProgressIndicator())
                          : assignments.isEmpty
                              ? const Center(
                                  child: Text('Chưa có phân công nào.',
                                      style: TextStyle(
                                          fontSize: 12, color: Colors.grey)))
                              : ListView.builder(
                                  itemCount: assignments.length,
                                  itemBuilder: (context, index) {
                                    final item = assignments[index];
                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: itemBg,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                    'BS: ${item['doctor_name']}',
                                                    style: const TextStyle(
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        fontSize: 13)),
                                                const SizedBox(height: 2),
                                                Text(
                                                    'BN: ${item['patient_name']}',
                                                    style: TextStyle(
                                                        color: widget
                                                                .isDarkTheme
                                                            ? Colors.white70
                                                            : Colors.black87,
                                                        fontSize: 12)),
                                              ],
                                            ),
                                          ),
                                          IconButton(
                                            icon: const Icon(LucideIcons.trash2,
                                                color: Colors.red, size: 18),
                                            onPressed: () async {
                                              try {
                                                await client.delete(
                                                    '/admin/assignments/${item['doctor_id']}/${item['patient_id']}');
                                                modalLoading = true; // làm mới
                                                setModalState(() {});
                                                patientProvider
                                                    .fetchPatients(); // làm mới danh sách bệnh nhân chính
                                              } catch (e) {
                                                AppLogger.log(
                                                    'Lỗi xóa phân công: $e');
                                              }
                                            },
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
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

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final patientProvider = Provider.of<PatientProvider>(context);

    final isDark = widget.isDarkTheme;
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted =
        isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.08);

    final role = authProvider.currentUser?.role ?? 'patient';

    // Lọc bệnh nhân dựa trên truy vấn
    final filtered = patientProvider.patients.where((p) {
      final name = p.fullName.toLowerCase();
      final history = p.medicalHistory.toLowerCase();
      return name.contains(_searchQuery) || history.contains(_searchQuery);
    }).toList();

    return CgScreenScaffold(
      title: 'Danh sách bệnh nhân',
      subtitle: role == 'doctor'
          ? 'Bệnh nhân được phân công khám'
          : 'Danh sách bệnh nhân toàn viện',
      trailing: role == 'admin'
          ? ElevatedButton.icon(
              onPressed: _showAssignmentsModal,
              icon: const Icon(LucideIcons.shieldAlert,
                  size: 16, color: Colors.white),
              label: const Text('Phân công BS',
                  style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: CgColors.primary,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            )
          : null,
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isTablet = constraints.maxWidth >= 600;

          final listColumnWidget = Column(
            children: [
              // Thanh tìm kiếm
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: TextField(
                  controller: _searchController,
                  style: TextStyle(color: textColor),
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm tên hoặc bệnh lý...',
                    hintStyle: TextStyle(color: textMuted),
                    prefixIcon:
                        Icon(LucideIcons.search, color: textMuted, size: 18),
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

              // Danh sách bệnh nhân
              Expanded(
                child: patientProvider.isLoading
                    ? const CgInlineState(
                        type: CgStateType.loading,
                        title: 'Đang tải danh sách bệnh nhân',
                        message: 'Vui lòng chờ hệ thống đồng bộ hồ sơ.',
                      )
                    : filtered.isEmpty
                        ? const CgInlineState(
                            type: CgStateType.empty,
                            title: 'Không có bệnh nhân',
                            message:
                                'Không tìm thấy bệnh nhân phù hợp với điều kiện hiện tại.',
                          )
                        : RefreshIndicator(
                            onRefresh: () async {
                              await patientProvider.fetchPatients();
                              if (role == 'admin') {
                                await _fetchAdminAssignments();
                              }
                            },
                            color: CgColors.primary,
                            child: ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 8),
                              itemCount: filtered.length,
                              itemBuilder: (context, index) {
                                final p = filtered[index];
                                final String initials = p.fullName.isNotEmpty
                                    ? p.fullName.substring(0, 1).toUpperCase()
                                    : '?';

                                final isSelected = _selectedPatient != null && _selectedPatient!['id'] == p.id;

                                String? doctorName;
                                if (role == 'admin') {
                                  final match = _adminAssignments.firstWhere(
                                    (a) => a['patient_id'] == p.id,
                                    orElse: () => null,
                                  );
                                  if (match != null) {
                                    doctorName = match['doctor_name'];
                                  }
                                }

                                return Container(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  decoration: BoxDecoration(
                                    color: isSelected && isTablet
                                        ? const Color(0xFFFF3366).withValues(alpha: 0.08)
                                        : cardBg,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: isSelected && isTablet
                                          ? const Color(0xFFFF3366)
                                          : borderColor,
                                    ),
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    child: ListTile(
                                      contentPadding: const EdgeInsets.symmetric(
                                          horizontal: 16, vertical: 8),
                                      leading: CircleAvatar(
                                        backgroundColor: isDark
                                            ? const Color(0xFF1A212D)
                                            : const Color(0xFFEAECF0),
                                        radius: 22,
                                        child: Text(
                                          initials,
                                          style: TextStyle(
                                              color: textColor,
                                              fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                      title: Text(p.fullName,
                                          style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              color: textColor)),
                                      subtitle: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${p.gender} - ${p.age} tuổi\nSĐT: ${p.phone}',
                                            style: TextStyle(color: textMuted, fontSize: 12),
                                          ),
                                          if (role == 'admin') ...[
                                            const SizedBox(height: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(
                                                  horizontal: 8, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: doctorName != null
                                                    ? const Color(0xFF12B76A).withValues(alpha: 0.1)
                                                    : const Color(0xFFF79009).withValues(alpha: 0.1),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(
                                                    doctorName != null
                                                        ? LucideIcons.checkCircle
                                                        : LucideIcons.alertTriangle,
                                                    size: 12,
                                                    color: doctorName != null
                                                        ? const Color(0xFF12B76A)
                                                        : const Color(0xFFF79009),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    doctorName != null
                                                        ? 'BS: $doctorName'
                                                        : 'Chưa phân công bác sĩ',
                                                    style: TextStyle(
                                                      color: doctorName != null
                                                          ? const Color(0xFF12B76A)
                                                          : const Color(0xFFF79009),
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      trailing: const Icon(LucideIcons.chevronRight,
                                          color: Color(0xFFFF3366), size: 18),
                                      onTap: () {
                                        if (isTablet) {
                                          setState(() {
                                            _selectedPatient = p.toJson();
                                          });
                                        } else {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) => PatientDetailScreen(
                                                patient: p.toJson(),
                                                isDarkTheme: isDark,
                                              ),
                                            ),
                                          );
                                        }
                                      },
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
              ),
            ],
          );

          if (isTablet) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Cột trái: Danh sách
                Expanded(
                  flex: 4,
                  child: listColumnWidget,
                ),
                VerticalDivider(width: 1, thickness: 0.8, color: borderColor),
                // Cột phải: Chi tiết
                Expanded(
                  flex: 6,
                  child: _selectedPatient == null
                      ? const CgInlineState(
                          type: CgStateType.empty,
                          title: 'Chưa chọn bệnh nhân',
                          message: 'Vui lòng chọn một bệnh nhân từ danh sách bên trái để xem hồ sơ và chỉ số realtime.',
                        )
                      : PatientDetailScreen(
                          key: ValueKey(_selectedPatient!['id']),
                          patient: _selectedPatient!,
                          isDarkTheme: isDark,
                          showBackButton: false,
                        ),
                ),
              ],
            );
          } else {
            return listColumnWidget;
          }
        },
      ),
    );
  }
}
