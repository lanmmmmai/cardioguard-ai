import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:heart_monitor_app/providers/appointment_provider.dart';
import 'package:heart_monitor_app/core/api_client.dart';

class MockHttpAdapter implements HttpClientAdapter {
  ResponseBody? mockResponse;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (mockResponse != null) {
      return mockResponse!;
    }
    return ResponseBody.fromString(
      json.encode({
        'items': [
          {
            'id': 'appt-1',
            'patient_id': 'p-1',
            'doctor_id': 'd-1',
            'title': 'Khám định kỳ',
            'status': 'pending',
            'channel': 'offline',
            'scheduled_at': '2026-06-04T16:00:00Z',
            'notes': 'Notes test',
            'created_at': '2026-06-04T15:00:00Z',
          }
        ],
        'total': 1
      }),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('AppointmentProvider Unit Tests', () {
    late AppointmentProvider provider;
    late MockHttpAdapter mockAdapter;
    late HttpClientAdapter originalAdapter;

    setUp(() {
      provider = AppointmentProvider();
      mockAdapter = MockHttpAdapter();
      originalAdapter = ApiClient().dio.httpClientAdapter;
      ApiClient().dio.httpClientAdapter = mockAdapter;
    });

    tearDown(() {
      ApiClient().dio.httpClientAdapter = originalAdapter;
    });

    test('fetchAppointments updates appointments list and orders them correctly', () async {
      mockAdapter.mockResponse = ResponseBody.fromString(
        json.encode([
          {
            'id': 'appt-1',
            'patient_id': 'p-1',
            'doctor_id': 'd-1',
            'title': 'Appointment 1',
            'status': 'pending',
            'channel': 'offline',
            'scheduled_at': '2026-06-04T10:00:00.000Z',
            'notes': 'Notes',
            'created_at': '2026-06-04T09:00:00.000Z',
          },
          {
            'id': 'appt-2',
            'patient_id': 'p-1',
            'doctor_id': 'd-1',
            'title': 'Appointment 2',
            'status': 'pending',
            'channel': 'offline',
            'scheduled_at': '2026-06-04T12:00:00.000Z',
            'notes': 'Notes',
            'created_at': '2026-06-04T09:00:00.000Z',
          }
        ]),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

      await provider.fetchAppointments();

      expect(provider.isLoading, false);
      expect(provider.errorMessage, null);
      expect(provider.appointments.length, 2);
      // Sắp xếp scheduledAt giảm dần, do đó appt-2 (12:00) phải ở đầu danh sách trước appt-1 (10:00)
      expect(provider.appointments.first.id, 'appt-2');
    });

    test('bookAppointment submits request successfully and inserts new appointment locally', () async {
      mockAdapter.mockResponse = ResponseBody.fromString(
        json.encode({
          'id': 'new-appt-3',
          'patient_id': 'p-1',
          'doctor_id': 'd-1',
          'title': 'New Appointment',
          'status': 'pending',
          'channel': 'offline',
          'scheduled_at': '2026-06-05T09:00:00.000Z',
          'notes': 'New notes',
          'created_at': '2026-06-04T09:00:00.000Z',
        }),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

      final success = await provider.bookAppointment(
        doctorId: 'd-1',
        title: 'New Appointment',
        scheduledAt: DateTime.parse('2026-06-05T09:00:00.000Z'),
        notes: 'New notes',
      );

      expect(success, true);
      expect(provider.appointments.length, 1);
      expect(provider.appointments.first.id, 'new-appt-3');
    });

    test('updateAppointmentStatus updates the local appointment status correctly', () async {
      provider.addOrUpdateRealtimeAppointment({
        'id': 'appt-update',
        'patient_id': 'p-1',
        'doctor_id': 'd-1',
        'title': 'Appointment Update',
        'status': 'pending',
        'channel': 'offline',
        'scheduled_at': '2026-06-04T10:00:00.000Z',
        'notes': 'Notes',
        'created_at': '2026-06-04T09:00:00.000Z',
      });

      expect(provider.appointments.first.status, 'pending');

      mockAdapter.mockResponse = ResponseBody.fromString(
        json.encode({
          'id': 'appt-update',
          'patient_id': 'p-1',
          'doctor_id': 'd-1',
          'title': 'Appointment Update',
          'status': 'completed',
          'channel': 'offline',
          'scheduled_at': '2026-06-04T10:00:00.000Z',
          'notes': 'Notes',
          'created_at': '2026-06-04T09:00:00.000Z',
        }),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

      final success = await provider.updateAppointmentStatus('appt-update', 'completed');

      expect(success, true);
      expect(provider.appointments.first.status, 'completed');
    });
  });
}
