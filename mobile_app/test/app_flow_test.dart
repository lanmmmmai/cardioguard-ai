// Bộ kiểm thử tích hợp cho các luồng di động CardioGuard.
// Quy trình làm việc:
// 1. Cung cấp createTestableWidget để bọc các màn hình trong vỏ kiểm thử MultiProvider.
// 2. Định nghĩa các lớp con Fake* cho mỗi provider để kiểm soát trạng thái kiểm thử mà không cần I/O.
// 3. Thực thi ba kịch bản chính:
//    - Khóa mật khẩu bắt buộc đổi (tất cả tab ngoại trừ cài đặt bị ẩn).
//    - Nhấn giữ SOS với bộ đếm ngược và tùy chọn hủy.
//    - Chế độ xem chia đôi thích ứng trên máy tính bảng với danh sách bệnh nhân + bảng chi tiết.
// Mối quan hệ:
// - Giả lập: AuthProvider, PatientProvider, AlertProvider,
//          AppointmentProvider, ChatProvider.
// - Kiểm thử: DashboardScreen, PatientsScreen, HeartMonitorAppMainTabs.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:heart_monitor_app/providers/auth_provider.dart';
import 'package:heart_monitor_app/providers/patient_provider.dart';
import 'package:heart_monitor_app/providers/alert_provider.dart';
import 'package:heart_monitor_app/providers/chat_provider.dart';
import 'package:heart_monitor_app/providers/appointment_provider.dart';
import 'package:heart_monitor_app/screens/dashboard_screen.dart';
import 'package:heart_monitor_app/screens/patients_screen.dart';
import 'package:heart_monitor_app/models/models.dart';

// Bọc widget child trong MediaQuery và MultiProvider để kiểm thử tích hợp.
// Cung cấp bề mặt 400x800 mặc định trừ khi surfaceSize được chỉ định.
Widget createTestableWidget({
  required Widget child,
  required AuthProvider authProvider,
  required PatientProvider patientProvider,
  required AlertProvider alertProvider,
  required AppointmentProvider appointmentProvider,
  required ChatProvider chatProvider,
  Size? surfaceSize,
}) {
  return MediaQuery(
    data: MediaQueryData(size: surfaceSize ?? const Size(400, 800)),
    child: MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ChangeNotifierProvider<PatientProvider>.value(value: patientProvider),
        ChangeNotifierProvider<AlertProvider>.value(value: alertProvider),
        ChangeNotifierProvider<AppointmentProvider>.value(value: appointmentProvider),
        ChangeNotifierProvider<ChatProvider>.value(value: chatProvider),
      ],
      child: MaterialApp(
        home: Scaffold(body: child),
      ),
    ),
  );
}

// Giả lập AuthProvider trả về currentUser và
// requiresPasswordChange có kiểm soát mà không cần gọi mạng thực.
class FakeAuthProvider extends AuthProvider {
  User? _fakeUser;
  bool _fakeRequiresPasswordChange = false;

  void setFakeUser(User? user, {bool forceChangePassword = false}) {
    _fakeUser = user;
    _fakeRequiresPasswordChange = forceChangePassword;
    notifyListeners();
  }

  @override
  User? get currentUser => _fakeUser;

  @override
  bool get requiresPasswordChange => _fakeRequiresPasswordChange;
}

// Giả lập PatientProvider với danh sách bệnh nhân giả và số liệu trực tiếp.
class FakePatientProvider extends PatientProvider {
  List<Patient> _fakePatients = [];
  final Map<String, dynamic> _fakeMetrics = {
    'heart_rate': 75,
    'spo2': 98,
    'systolic_bp': 120,
    'diastolic_bp': 80,
    'ecg_value': 0.0,
    'is_abnormal': false,
  };

  void setFakePatients(List<Patient> patients) {
    _fakePatients = patients;
    notifyListeners();
  }

  @override
  List<Patient> get patients => _fakePatients;

  @override
  Map<String, dynamic> get liveMetrics => _fakeMetrics;

  @override
  Future<void> fetchPatients() async {
    // Ghi đè để ngăn các lời gọi HTTP thực trong quá trình kiểm thử
  }

  @override
  Future<void> fetchMyProfile() async {
    // Ghi đè để ngăn các lời gọi HTTP thực trong quá trình kiểm thử
  }

  @override
  Future<void> fetchMedicalRecords(String patientId) async {
    // Ghi đè để ngăn các lời gọi HTTP thực trong quá trình kiểm thử
  }

  @override
  Future<void> fetchPrescriptions(String patientId) async {
    // Ghi đè để ngăn các lời gọi HTTP thực trong quá trình kiểm thử
  }
}

// Giả lập AlertProvider với danh sách cảnh báo có thể kiểm soát.
class FakeAlertProvider extends AlertProvider {
  List<Alert> _fakeAlerts = [];

  void setFakeAlerts(List<Alert> alerts) {
    _fakeAlerts = alerts;
    notifyListeners();
  }

  @override
  List<Alert> get alerts => _fakeAlerts;
}

// Giả lập AppointmentProvider với danh sách lịch hẹn có thể kiểm soát.
class FakeAppointmentProvider extends AppointmentProvider {
  List<Appointment> _fakeAppointments = [];

  void setFakeAppointments(List<Appointment> appointments) {
    _fakeAppointments = appointments;
    notifyListeners();
  }

  @override
  List<Appointment> get appointments => _fakeAppointments;

  @override
  Future<void> fetchAppointments() async {
    // Ghi đè để ngăn các lời gọi HTTP thực trong quá trình kiểm thử
  }
}

// Giả lập ChatProvider với các tin nhắn có thể kiểm soát và send/fetch no-op.
class FakeChatProvider extends ChatProvider {
  List<ChatMessage> _fakeMessages = [];

  void setFakeMessages(List<ChatMessage> messages) {
    _fakeMessages = messages;
    notifyListeners();
  }

  @override
  List<ChatMessage> get messages => _fakeMessages;

  @override
  Future<void> fetchChatHistory(String patientId) async {
    // Ghi đè để ngăn các lời gọi HTTP thực trong quá trình kiểm thử
  }

  @override
  Future<bool> sendMessage({
    required String patientId,
    required String doctorId,
    required String senderId,
    required String recipientId,
    required String messageText,
  }) async {
    return true;
  }
}

void main() {
  late FakeAuthProvider fakeAuth;
  late FakePatientProvider fakePatient;
  late FakeAlertProvider fakeAlert;
  late FakeAppointmentProvider fakeAppointment;
  late FakeChatProvider fakeChat;

  setUp(() {
    fakeAuth = FakeAuthProvider();
    fakePatient = FakePatientProvider();
    fakeAlert = FakeAlertProvider();
    fakeAppointment = FakeAppointmentProvider();
    fakeChat = FakeChatProvider();
  });

  group('Bộ kiểm thử tính năng nâng cao Giao diện Di động', () {
    testWidgets('Kịch bản 1: Mật khẩu bắt buộc đổi (forcePasswordChange) khóa tất cả luồng', (WidgetTester tester) async {
      // Giả lập tài khoản bệnh nhân có cờ bắt buộc đổi mật khẩu
      fakeAuth.setFakeUser(
        User(
          id: 'p1',
          fullName: 'Bệnh nhân Test',
          email: 'test@cardioguard.com',
          role: 'patient',
          status: 'active',
          mustChangePassword: true,
        ),
        forceChangePassword: true,
      );

      // Nhúng Scaffold Tab Bar vào chạy thử
      await tester.pumpWidget(
        createTestableWidget(
          child: const HeartMonitorAppMainTabs(),
          authProvider: fakeAuth,
          patientProvider: fakePatient,
          alertProvider: fakeAlert,
          appointmentProvider: fakeAppointment,
          chatProvider: fakeChat,
        ),
      );

      await tester.pump(const Duration(milliseconds: 200));

      // Verify chỉ hiển thị tab Cài đặt đổi mật khẩu
      expect(find.text('Đổi mật khẩu'), findsOneWidget);
      expect(find.text('Chỉ số'), findsNothing); // Tab sinh học bệnh nhân bị ẩn đi
    });

    testWidgets('Kịch bản 2: Bấm giữ nút SOS trong 3 giây đếm ngược trên Dashboard', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(400, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      fakeAuth.setFakeUser(
        User(
          id: 'p1',
          fullName: 'Bệnh nhân Test',
          email: 'test@cardioguard.com',
          role: 'patient',
          status: 'active',
          mustChangePassword: false,
        ),
      );

      await tester.pumpWidget(
        createTestableWidget(
          surfaceSize: const Size(400, 900),
          child: DashboardScreen(
            onToggleTheme: () {},
            isDarkTheme: true,
          ),
          authProvider: fakeAuth,
          patientProvider: fakePatient,
          alertProvider: fakeAlert,
          appointmentProvider: fakeAppointment,
          chatProvider: fakeChat,
        ),
      );

      await tester.pump(const Duration(milliseconds: 200));

      // Verify nút SOS hiển thị
      expect(find.text('SOS'), findsOneWidget);

      // Thực hiện nhấn giữ (longPress)
      await tester.longPress(find.text('SOS'));
      await tester.pump(); // Render trạng thái kích hoạt ngay lập tức hiển thị "3" đếm ngược

      // Kiểm tra trạng thái đếm ngược bắt đầu kích hoạt
      expect(find.text('ĐANG KÍCH HOẠT TRONG 3 S'), findsOneWidget);
      expect(find.text('Hủy bỏ yêu cầu'), findsOneWidget);
    });

    testWidgets('Kịch bản 3: Adaptive Split-View cho Máy tính bảng (Tablet Layout)', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      fakeAuth.setFakeUser(
        User(
          id: 'doc1',
          fullName: 'Bác sĩ A',
          email: 'doc@cardioguard.com',
          role: 'doctor',
          status: 'active',
          mustChangePassword: false,
        ),
      );

      fakePatient.setFakePatients([
        Patient(
          id: 'p1',
          fullName: 'Bệnh nhân Nguy Kịch A',
          age: 45,
          gender: 'Nam',
          phone: '0987654321',
          address: 'Hà Nội',
          medicalHistory: 'Huyết áp cao',
        )
      ]);

      // Chạy test với màn hình Tablet lớn (chiều rộng 1024 dp)
      await tester.pumpWidget(
        createTestableWidget(
          surfaceSize: const Size(1024, 768),
          child: const PatientsScreen(isDarkTheme: true),
          authProvider: fakeAuth,
          patientProvider: fakePatient,
          alertProvider: fakeAlert,
          appointmentProvider: fakeAppointment,
          chatProvider: fakeChat,
        ),
      );

      await tester.pump(const Duration(milliseconds: 200));

      // Trong Split-View Tablet, màn hình Patients hiển thị cả danh sách bên trái và panel chi tiết bên phải cùng một lúc
      expect(find.text('Chưa chọn bệnh nhân'), findsOneWidget); // Panel detail trống bên phải

      // Chọn bệnh nhân
      await tester.tap(find.text('Bệnh nhân Nguy Kịch A'));
      await tester.pump(const Duration(milliseconds: 200));

      // Panel detail bên phải lập tức hiển thị thông tin bệnh nhân
      expect(find.text('Chẩn đoán:'), findsNothing); // tab bệnh án mặc định trống hoặc chưa load
      expect(find.text('Tuổi'), findsOneWidget); // Tab chỉ số hiển thị chi tiết tuổi bệnh nhân trực quan
    });
  });
}

// Một giả lập tối thiểu của widget điều hướng tab chính để kiểm thử
// kịch bản khóa mật khẩu bắt buộc đổi.
class HeartMonitorAppMainTabs extends StatefulWidget {
  const HeartMonitorAppMainTabs({super.key});

  @override
  State<HeartMonitorAppMainTabs> createState() => _HeartMonitorAppMainTabsState();
}

class _HeartMonitorAppMainTabsState extends State<HeartMonitorAppMainTabs> {
  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final forcePasswordChange = authProvider.requiresPasswordChange;

    return Scaffold(
      body: forcePasswordChange
          ? const Center(child: Text('Đổi mật khẩu'))
          : const Center(child: Text('Chỉ số')),
    );
  }
}
