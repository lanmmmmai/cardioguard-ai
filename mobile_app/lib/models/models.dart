// Các mô hình dữ liệu cho các thực thể CardioGuard AI: User, Patient, Appointment,
// MedicalRecord, Prescription, ChatMessage và Alert.
// Quy trình làm việc:
//   - Mỗi mô hình hiển thị một hàm tạo có tên fromJson(Map) để
//     giải mã phản hồi từ máy chủ và toJson() để mã hóa yêu cầu.
//   - Các trường sử dụng giá trị mặc định an toàn khi thiếu khóa JSON.
// Mối quan hệ:
//   - Được tiêu thụ bởi tất cả các lớp provider để biểu diễn trạng thái cục bộ.
//   - Các mô hình phù hợp với lược đồ JSON của backend FastAPI.

// Đại diện cho một người dùng hệ thống đã được xác thực (bệnh nhân, bác sĩ hoặc quản trị viên).
class User {
  // Định danh duy nhất của người dùng.
  final String id;

  // Tên hiển thị của người dùng.
  final String fullName;

  // Địa chỉ email được sử dụng để đăng nhập.
  final String email;

  // Vai trò được gán cho người dùng: patient, doctor, hoặc admin.
  final String role;

  // Trạng thái tài khoản (ví dụ: active, inactive).
  final String status;

  // Liệu người dùng có bắt buộc phải thay đổi mật khẩu ở lần đăng nhập tiếp theo hay không.
  final bool mustChangePassword;
  final String? avatarUrl;

  // Tạo một User với tất cả các trường bắt buộc.
  User({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    required this.status,
    required this.mustChangePassword,
    this.avatarUrl,
  });

  // Giải mã một User từ bản đồ JSON được trả về bởi API.
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      fullName: json['full_name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'patient',
      status: (json['status'] ?? 'active').toString(),
      mustChangePassword: json['must_change_password'] == true,
      avatarUrl: json['avatar_url'],
    );
  }

  // Mã hóa User này thành bản đồ JSON cho các yêu cầu API.
  Map<String, dynamic> toJson() => {
        'id': id,
        'full_name': fullName,
        'email': email,
        'role': role,
        'status': status,
        'must_change_password': mustChangePassword,
        'avatar_url': avatarUrl,
      };
}

// Đại diện cho một bệnh nhân đang được theo dõi với thông tin nhân khẩu học và liên hệ.
class Patient {
  // Định danh duy nhất của bệnh nhân.
  final String id;

  // Họ và tên đầy đủ của bệnh nhân.
  final String fullName;

  // Tuổi tính theo năm.
  final int age;

  // Chuỗi giới tính (ví dụ: Nam, Nữ).
  final String gender;

  // Số điện thoại liên hệ.
  final String phone;

  // Địa chỉ cư trú.
  final String address;

  // Tóm tắt tiền sử bệnh lý liên quan.
  final String medicalHistory;

  // Tạo một Patient với tất cả các trường bắt buộc.
  Patient({
    required this.id,
    required this.fullName,
    required this.age,
    required this.gender,
    required this.phone,
    required this.address,
    required this.medicalHistory,
  });

  // Giải mã một Patient từ bản đồ JSON.
  factory Patient.fromJson(Map<String, dynamic> json) {
    final rawPhone = json['phone']?.toString() ?? '';
    return Patient(
      id: json['id'] ?? '',
      fullName: json['full_name'] ?? '',
      age: json['age'] is int
          ? json['age']
          : int.tryParse(json['age']?.toString() ?? '0') ?? 0,
      gender: json['gender'] ?? 'Chưa cập nhật',
      phone: (rawPhone.isNotEmpty && !rawPhone.contains('@')) ? rawPhone : 'Chưa cập nhật',
      address: json['address'] ?? 'Chưa cập nhật',
      medicalHistory: json['medical_history'] ?? '',
    );
  }

  // Mã hóa Patient này thành bản đồ JSON cho các yêu cầu API.
  Map<String, dynamic> toJson() => {
        'id': id,
        'full_name': fullName,
        'age': age,
        'gender': gender,
        'phone': phone,
        'address': address,
        'medical_history': medicalHistory,
      };
}

// Đại diện cho một cuộc hẹn khám bệnh đã được lên lịch giữa bệnh nhân và bác sĩ.
class Appointment {
  // Định danh duy nhất của cuộc hẹn.
  final String id;

  // ID của bệnh nhân đã đặt lịch hẹn.
  final String patientId;

  // ID của bác sĩ được phân công.
  final String doctorId;

  // Tiêu đề hoặc lý do của cuộc hẹn.
  final String title;

  // Trạng thái hiện tại: pending, confirmed, completed, cancelled.
  final String status;

  // Kênh tư vấn: offline hoặc online.
  final String channel;

  // Ngày và giờ cuộc hẹn được lên lịch.
  final DateTime scheduledAt;

  // Ghi chú hoặc hướng dẫn bổ sung cho cuộc hẹn.
  final String notes;

  // Tạo một Appointment với tất cả các trường bắt buộc.
  Appointment({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.title,
    required this.status,
    required this.channel,
    required this.scheduledAt,
    required this.notes,
  });

  // Giải mã một Appointment từ bản đồ JSON.
  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      title: json['title'] ?? '',
      status: json['status'] ?? 'pending',
      channel: json['channel'] ?? 'offline',
      scheduledAt: _parseDateTime(json['scheduled_at']),
      notes: json['notes'] ?? '',
    );
  }

  // Mã hóa Appointment này thành bản đồ JSON cho các yêu cầu API.
  Map<String, dynamic> toJson() => {
        'id': id,
        'patient_id': patientId,
        'doctor_id': doctorId,
        'title': title,
        'status': status,
        'channel': channel,
        'scheduled_at': scheduledAt.toIso8601String(),
        'notes': notes,
      };
}

// Đại diện cho một mục hồ sơ bệnh án lâm sàng của bệnh nhân.
class MedicalRecord {
  // Định danh duy nhất của hồ sơ bệnh án.
  final String id;

  // ID của bệnh nhân mà hồ sơ này thuộc về.
  final String patientId;

  // ID của bác sĩ đã tạo hồ sơ.
  final String doctorId;

  // Loại hồ sơ (ví dụ: Khám lâm sàng, Xét nghiệm).
  final String type;

  // Văn bản chẩn đoán y tế.
  final String diagnosis;

  // Tóm tắt các phát hiện lâm sàng.
  final String summary;

  // Các tệp đính kèm tùy chọn (định dạng phụ thuộc vào phản hồi máy chủ).
  final dynamic files;

  // Dấu thời gian khi hồ sơ được tạo.
  final DateTime createdAt;

  // Tạo một MedicalRecord với tất cả các trường bắt buộc.
  MedicalRecord({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.type,
    required this.diagnosis,
    required this.summary,
    this.files,
    required this.createdAt,
  });

  // Giải mã một MedicalRecord từ bản đồ JSON.
  factory MedicalRecord.fromJson(Map<String, dynamic> json) {
    return MedicalRecord(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      type: json['type'] ?? 'Khám lâm sàng',
      diagnosis: json['diagnosis'] ?? '',
      summary: json['summary'] ?? '',
      files: json['files'],
      createdAt: _parseDateTime(json['created_at']),
    );
  }

  // Mã hóa MedicalRecord này thành bản đồ JSON cho các yêu cầu API.
  Map<String, dynamic> toJson() => {
        'id': id,
        'patient_id': patientId,
        'doctor_id': doctorId,
        'type': type,
        'diagnosis': diagnosis,
        'summary': summary,
        'files': files,
        'created_at': createdAt.toIso8601String(),
      };
}

// Đại diện cho một đơn thuốc được kê bởi bác sĩ.
class Prescription {
  // Định danh duy nhất của đơn thuốc.
  final String id;

  // ID của bệnh nhân nhận thuốc.
  final String patientId;

  // ID của bác sĩ đã kê đơn.
  final String doctorId;

  // Tên của thuốc.
  final String medicationName;

  // Hướng dẫn liều lượng (ví dụ: 500mg).
  final String dosage;

  // Tần suất sử dụng (ví dụ: 3 lần/ngày).
  final String frequency;

  // Hướng dẫn sử dụng bổ sung.
  final String instructions;

  // Trạng thái đơn thuốc: active, completed, cancelled.
  final String status;

  // Dấu thời gian khi đơn thuốc được tạo.
  final DateTime createdAt;

  // Tạo một Prescription với tất cả các trường bắt buộc.
  Prescription({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.medicationName,
    required this.dosage,
    required this.frequency,
    required this.instructions,
    required this.status,
    required this.createdAt,
  });

  // Giải mã một Prescription từ bản đồ JSON.
  factory Prescription.fromJson(Map<String, dynamic> json) {
    return Prescription(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      medicationName: json['medication_name'] ?? '',
      dosage: json['dosage'] ?? '',
      frequency: json['frequency'] ?? '',
      instructions: json['instructions'] ?? '',
      status: json['status'] ?? 'active',
      createdAt: _parseDateTime(json['created_at']),
    );
  }

  // Mã hóa Prescription này thành bản đồ JSON cho các yêu cầu API.
  Map<String, dynamic> toJson() => {
        'id': id,
        'patient_id': patientId,
        'doctor_id': doctorId,
        'medication_name': medicationName,
        'dosage': dosage,
        'frequency': frequency,
        'instructions': instructions,
        'status': status,
        'created_at': createdAt.toIso8601String(),
      };
}

// Đại diện cho một tin nhắn trò chuyện duy nhất được trao đổi giữa bệnh nhân và bác sĩ.
class ChatMessage {
  // Định danh duy nhất của tin nhắn.
  final String id;

  // ID của bệnh nhân tham gia cuộc trò chuyện.
  final String patientId;

  // ID của bác sĩ tham gia cuộc trò chuyện.
  final String doctorId;

  // ID của người dùng đã gửi tin nhắn.
  final String senderId;

  // ID của người nhận dự kiến.
  final String recipientId;

  // Nội dung văn bản của tin nhắn.
  final String message;

  // Liệu tin nhắn đã được người nhận đọc hay chưa.
  final bool isRead;

  // Dấu thời gian khi tin nhắn được gửi.
  final DateTime createdAt;

  // Tạo một ChatMessage với tất cả các trường bắt buộc.
  ChatMessage({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.senderId,
    required this.recipientId,
    required this.message,
    required this.isRead,
    required this.createdAt,
  });

  // Giải mã một ChatMessage từ bản đồ JSON.
  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      senderId: json['sender_id'] ?? '',
      recipientId: json['recipient_id'] ?? '',
      message: json['message'] ?? '',
      isRead: json['is_read'] ?? false,
      createdAt: _parseDateTime(json['created_at']),
    );
  }

  // Mã hóa ChatMessage này thành bản đồ JSON cho các yêu cầu API.
  Map<String, dynamic> toJson() => {
        'id': id,
        'patient_id': patientId,
        'doctor_id': doctorId,
        'sender_id': senderId,
        'recipient_id': recipientId,
        'message': message,
        'is_read': isRead,
        'created_at': createdAt.toIso8601String(),
      };
}

// Đại diện cho một phiên hội thoại AI đã lưu.
class AiChatSession {
  final String id;
  final String title;
  final DateTime createdAt;

  AiChatSession({
    required this.id,
    required this.title,
    required this.createdAt,
  });

  factory AiChatSession.fromJson(Map<String, dynamic> json) {
    return AiChatSession(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Cuộc hội thoại y tế',
      createdAt: _parseDateTime(json['created_at']),
    );
  }
}

// Đại diện cho một tin nhắn AI chatbot trong một session.
class AiChatMessage {
  final String id;
  final String sender;
  final String message;
  final DateTime createdAt;

  AiChatMessage({
    required this.id,
    required this.sender,
    required this.message,
    required this.createdAt,
  });

  factory AiChatMessage.fromJson(Map<String, dynamic> json) {
    return AiChatMessage(
      id: json['id']?.toString() ?? '',
      sender: json['sender']?.toString() ?? 'ai',
      message: json['message']?.toString() ?? '',
      createdAt: _parseDateTime(json['created_at']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'sender': sender,
        'message': message,
        'created_at': createdAt.toUtc().toIso8601String(),
      };
}

// Đại diện cho một sự kiện cảnh báo sức khỏe được kích hoạt cho bệnh nhân đang theo dõi.
class Alert {
  // Định danh duy nhất của cảnh báo.
  final String id;

  // ID của bệnh nhân đã kích hoạt cảnh báo.
  final String patientId;

  // Tên hiển thị của bệnh nhân.
  final String fullName;

  // Loại cảnh báo (ví dụ: SOS, vital_signs).
  final String alertType;

  // Mô tả thông báo cảnh báo.
  final String message;

  // Mức độ nghiêm trọng: critical, warning, normal.
  final String severity;

  // Liệu cảnh báo đã được nhân viên y tế giải quyết hay chưa.
  final bool isResolved;

  // Dấu thời gian khi cảnh báo được tạo.
  final DateTime createdAt;

  // Tạo một Alert với tất cả các trường bắt buộc.
  Alert({
    required this.id,
    required this.patientId,
    required this.fullName,
    required this.alertType,
    required this.message,
    required this.severity,
    required this.isResolved,
    required this.createdAt,
  });

  // Giải mã một Alert từ bản đồ JSON.
  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      fullName: json['full_name'] ?? 'Bệnh nhân',
      alertType: json['alert_type'] ?? '',
      message: json['message'] ?? '',
      severity: json['severity'] ?? 'warning',
      isResolved: json['is_resolved'] ?? false,
      createdAt: _parseDateTime(json['created_at']),
    );
  }

  // Mã hóa Alert này thành bản đồ JSON cho các yêu cầu API.
  Map<String, dynamic> toJson() => {
        'id': id,
        'patient_id': patientId,
        'full_name': fullName,
        'alert_type': alertType,
        'message': message,
        'severity': severity,
        'is_resolved': isResolved,
        'created_at': createdAt.toIso8601String(),
      };
}

/// Helper an toàn để parse chuỗi thời gian từ JSON mà không gây crash ứng dụng.
DateTime _parseDateTime(dynamic value) {
  if (value == null) return DateTime.now();
  try {
    if (value is String) {
      return DateTime.parse(value);
    }
    return DateTime.now();
  } catch (e) {
    return DateTime.now();
  }
}

// Đại diện cho một thiết bị IoT phần cứng.
class Device {
  final String id;
  final String? patientId;
  final String deviceName;
  final String deviceType;
  final String deviceMac;
  final String status;
  final DateTime createdAt;

  Device({
    required this.id,
    this.patientId,
    required this.deviceName,
    required this.deviceType,
    required this.deviceMac,
    required this.status,
    required this.createdAt,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'] ?? '',
      patientId: json['patient_id'],
      deviceName: json['device_name'] ?? 'CardioGuard Prototype',
      deviceType: json['device_type'] ?? 'Wearable',
      deviceMac: json['device_mac'] ?? '',
      status: json['status'] ?? 'offline',
      createdAt: _parseDateTime(json['created_at']),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'patient_id': patientId,
        'device_name': deviceName,
        'device_type': deviceType,
        'device_mac': deviceMac,
        'status': status,
        'created_at': createdAt.toIso8601String(),
      };
}

