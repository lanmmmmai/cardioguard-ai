// Unified models for CardioGuard AI Application

class User {
  final String id;
  final String fullName;
  final String email;
  final String role;
  final String status;
  final bool mustChangePassword;

  User({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    required this.status,
    required this.mustChangePassword,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      fullName: json['full_name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'patient',
      status: (json['status'] ?? 'active').toString(),
      mustChangePassword: json['must_change_password'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'full_name': fullName,
        'email': email,
        'role': role,
        'status': status,
        'must_change_password': mustChangePassword,
      };
}

class Patient {
  final String id;
  final String fullName;
  final int age;
  final String gender;
  final String phone;
  final String address;
  final String medicalHistory;

  Patient({
    required this.id,
    required this.fullName,
    required this.age,
    required this.gender,
    required this.phone,
    required this.address,
    required this.medicalHistory,
  });

  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: json['id'] ?? '',
      fullName: json['full_name'] ?? '',
      age: json['age'] is int
          ? json['age']
          : int.tryParse(json['age']?.toString() ?? '0') ?? 0,
      gender: json['gender'] ?? 'Chưa cập nhật',
      phone: json['phone'] ?? json['email'] ?? '',
      address: json['address'] ?? 'Chưa cập nhật',
      medicalHistory: json['medical_history'] ?? '',
    );
  }

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

class Appointment {
  final String id;
  final String patientId;
  final String doctorId;
  final String title;
  final String status;
  final String channel;
  final DateTime scheduledAt;
  final String notes;

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

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      title: json['title'] ?? '',
      status: json['status'] ?? 'pending',
      channel: json['channel'] ?? 'offline',
      scheduledAt: json['scheduled_at'] != null
          ? DateTime.parse(json['scheduled_at'])
          : DateTime.now(),
      notes: json['notes'] ?? '',
    );
  }

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

class MedicalRecord {
  final String id;
  final String patientId;
  final String doctorId;
  final String type;
  final String diagnosis;
  final String summary;
  final dynamic files;
  final DateTime createdAt;

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

  factory MedicalRecord.fromJson(Map<String, dynamic> json) {
    return MedicalRecord(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      type: json['type'] ?? 'Khám lâm sàng',
      diagnosis: json['diagnosis'] ?? '',
      summary: json['summary'] ?? '',
      files: json['files'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

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

class Prescription {
  final String id;
  final String patientId;
  final String doctorId;
  final String medicationName;
  final String dosage;
  final String frequency;
  final String instructions;
  final String status;
  final DateTime createdAt;

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
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

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

class ChatMessage {
  final String id;
  final String patientId;
  final String doctorId;
  final String senderId;
  final String recipientId;
  final String message;
  final bool isRead;
  final DateTime createdAt;

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

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      senderId: json['sender_id'] ?? '',
      recipientId: json['recipient_id'] ?? '',
      message: json['message'] ?? '',
      isRead: json['is_read'] ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

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

class Alert {
  final String id;
  final String patientId;
  final String fullName;
  final String alertType;
  final String message;
  final String severity;
  final bool isResolved;
  final DateTime createdAt;

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

  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      fullName: json['full_name'] ?? 'Bệnh nhân',
      alertType: json['alert_type'] ?? '',
      message: json['message'] ?? '',
      severity: json['severity'] ?? 'warning',
      isResolved: json['is_resolved'] ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

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
