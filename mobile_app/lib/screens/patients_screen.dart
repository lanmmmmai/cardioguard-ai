import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/patient_provider.dart';
import '../providers/auth_provider.dart';
import '../core/api_client.dart';
import 'patient_detail_screen.dart';

class PatientsScreen extends StatefulWidget {
  final bool isDarkTheme;
  const PatientsScreen({super.key, required this.isDarkTheme});

  @override
  State<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends State<PatientsScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<PatientProvider>(context, listen: false).fetchPatients();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Admin Modal: Manage Doctor-Patient Assignments
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
      backgroundColor: widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            
            // Initial loader
            if (modalLoading) {
              Future.wait([
                client.get('/admin/assignments'),
                client.get('/cms/users', queryParameters: {'filter': 'role:doctor', 'limit': 100})
              ]).then((responses) {
                setModalState(() {
                  assignments = responses[0].data;
                  doctors = responses[1].data['items'] ?? [];
                  modalLoading = false;
                });
              }).catchError((e) {
                print('Error fetching modal data: $e');
                setModalState(() => modalLoading = false);
              });
            }

            final patientProvider = Provider.of<PatientProvider>(context);
            final itemBg = widget.isDarkTheme ? const Color(0xFF1C222D) : Colors.black.withOpacity(0.02);

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
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        IconButton(
                          icon: const Icon(LucideIcons.x),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const Divider(),
                    const SizedBox(height: 8),
                    
                    // Add Assignment Form
                    const Text('THÊM PHÂN CÔNG MỚI', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFFF3366))),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        // Doctor Dropdown
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            hint: const Text('Bác sĩ', style: TextStyle(fontSize: 12)),
                            value: selectedDoctorId,
                            dropdownColor: widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
                            items: doctors.map((doc) {
                              return DropdownMenuItem<String>(
                                value: doc['id'] as String,
                                child: Text(doc['full_name'] as String, style: const TextStyle(fontSize: 12)),
                              );
                            }).toList(),
                            onChanged: (id) => setModalState(() => selectedDoctorId = id),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Patient Dropdown
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            hint: const Text('Bệnh nhân', style: TextStyle(fontSize: 12)),
                            value: selectedPatientId,
                            dropdownColor: widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
                            items: patientProvider.patients.map((p) {
                              return DropdownMenuItem<String>(
                                value: p.id,
                                child: Text(p.fullName, style: const TextStyle(fontSize: 12)),
                              );
                            }).toList(),
                            onChanged: (id) => setModalState(() => selectedPatientId = id),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Add Button
                        IconButton(
                          icon: const Icon(LucideIcons.plusCircle, color: Color(0xFFFF3366)),
                          onPressed: (selectedDoctorId == null || selectedPatientId == null) ? null : () async {
                            try {
                              final res = await client.post('/admin/assignments', data: {
                                'doctor_id': selectedDoctorId,
                                'patient_id': selectedPatientId,
                              });
                              if (res.statusCode == 200 || res.statusCode == 201) {
                                selectedDoctorId = null;
                                selectedPatientId = null;
                                modalLoading = true; // refresh
                                setModalState(() {});
                                patientProvider.fetchPatients(); // refresh main patients list
                              }
                            } catch (e) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Lỗi phân công (Có thể đã phân công trước đó)')),
                              );
                            }
                          },
                        )
                      ],
                    ),
                    const SizedBox(height: 20),

                    const Text('DANH SÁCH ĐÃ PHÂN CÔNG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFFF3366))),
                    const SizedBox(height: 10),

                    // Assignments list
                    Expanded(
                      child: modalLoading
                          ? const Center(child: CircularProgressIndicator())
                          : assignments.isEmpty
                              ? const Center(child: Text('Chưa có phân công nào.', style: TextStyle(fontSize: 12, color: Colors.grey)))
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
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text('BS: ${item['doctor_name']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                                const SizedBox(height: 2),
                                                Text('BN: ${item['patient_name']}', style: TextStyle(color: widget.isDarkTheme ? Colors.white70 : Colors.black87, fontSize: 12)),
                                              ],
                                            ),
                                          ),
                                          IconButton(
                                            icon: const Icon(LucideIcons.trash2, color: Colors.red, size: 18),
                                            onPressed: () async {
                                              try {
                                                await client.delete('/admin/assignments/${item['doctor_id']}/${item['patient_id']}');
                                                modalLoading = true; // refresh
                                                setModalState(() {});
                                                patientProvider.fetchPatients(); // refresh main patients list
                                              } catch (e) {
                                                print('Error deleting assignment: $e');
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
    final primaryBg = isDark ? const Color(0xFF07080A) : const Color(0xFFF5F6F8);
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark ? Colors.white.withOpacity(0.07) : Colors.black.withOpacity(0.08);

    final role = authProvider.currentUser?.role ?? 'patient';

    // Filter patients based on query
    final filtered = patientProvider.patients.where((p) {
      final name = p.fullName.toLowerCase();
      final history = p.medicalHistory.toLowerCase();
      return name.contains(_searchQuery) || history.contains(_searchQuery);
    }).toList();

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
                        'Danh sách Bệnh nhân',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: textColor),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        role == 'doctor' ? 'Bệnh nhân được phân công khám' : 'Danh sách bệnh nhân toàn viện',
                        style: TextStyle(color: textMuted, fontSize: 13),
                      ),
                    ],
                  ),
                  if (role == 'admin')
                    ElevatedButton.icon(
                      onPressed: _showAssignmentsModal,
                      icon: const Icon(LucideIcons.shieldAlert, size: 16, color: Colors.white),
                      label: const Text('Phân công BS', style: TextStyle(color: Colors.white)),
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
                style: TextStyle(color: textColor),
                decoration: InputDecoration(
                  hintText: 'Tìm kiếm tên hoặc bệnh lý...',
                  hintStyle: TextStyle(color: textMuted),
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

            // Patients List
            Expanded(
              child: patientProvider.isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFFFF3366)))
                  : filtered.isEmpty
                      ? Center(child: Text('Không có bệnh nhân nào.', style: TextStyle(color: textMuted)))
                      : RefreshIndicator(
                          onRefresh: patientProvider.fetchPatients,
                          color: const Color(0xFFFF3366),
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: filtered.length,
                            itemBuilder: (context, index) {
                              final p = filtered[index];
                              final String initials = p.fullName.isNotEmpty ? p.fullName.substring(0, 1).toUpperCase() : '?';

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
                                    backgroundColor: isDark ? const Color(0xFF1A212D) : const Color(0xFFEAECF0),
                                    radius: 22,
                                    child: Text(
                                      initials,
                                      style: TextStyle(color: textColor, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  title: Text(p.fullName, style: TextStyle(fontWeight: FontWeight.bold, color: textColor)),
                                  subtitle: Text(
                                    '${p.gender} - ${p.age} tuổi\nSĐT: ${p.phone}',
                                    style: TextStyle(color: textMuted, fontSize: 12),
                                  ),
                                  trailing: const Icon(LucideIcons.chevronRight, color: Color(0xFFFF3366), size: 18),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) => PatientDetailScreen(
                                          patient: p.toJson(),
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
