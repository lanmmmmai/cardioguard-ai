import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:heart_monitor_app/providers/alert_provider.dart';
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
      json.encode([]),
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
  group('AlertProvider Unit Tests', () {
    late AlertProvider provider;
    late MockHttpAdapter mockAdapter;
    late HttpClientAdapter originalAdapter;

    setUp(() {
      provider = AlertProvider();
      mockAdapter = MockHttpAdapter();
      originalAdapter = ApiClient().dio.httpClientAdapter;
      ApiClient().dio.httpClientAdapter = mockAdapter;
    });

    tearDown(() {
      ApiClient().dio.httpClientAdapter = originalAdapter;
    });

    test('fetchAlerts nạp danh sách cảnh báo thành công', () async {
      mockAdapter.mockResponse = ResponseBody.fromString(
        json.encode([
          {
            'id': 'alert-1',
            'patient_id': 'p-1',
            'full_name': 'Nguyen Van A',
            'alert_type': 'HIGH_HEART_RATE',
            'message': 'Nhịp tim cao (>120 bpm)',
            'severity': 'high',
            'is_resolved': false,
            'created_at': '2026-06-04T10:00:00.000Z',
          },
          {
            'id': 'alert-2',
            'patient_id': 'p-1',
            'full_name': 'Nguyen Van A',
            'alert_type': 'LOW_SPO2',
            'message': 'SpO2 thấp (<92%)',
            'severity': 'high',
            'is_resolved': true,
            'created_at': '2026-06-04T09:00:00.000Z',
          }
        ]),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

      await provider.fetchAlerts();

      expect(provider.isLoading, false);
      expect(provider.alerts.length, 2);
      expect(provider.alerts.first.id, 'alert-1');
      expect(provider.activeAlertCount, 1); // alert-2 đã resolved, alert-1 chưa resolved
    });

    test('resolveAlert đánh dấu đã xử lý cảnh báo cục bộ sau khi gọi API thành công', () async {
      // Khởi tạo trước cảnh báo chưa resolved cục bộ
      provider.addOrUpdateRealtimeAlert({
        'id': 'alert-resolve-test',
        'patient_id': 'p-1',
        'full_name': 'Nguyen Van A',
        'alert_type': 'SOS',
        'message': 'Cần giúp đỡ',
        'severity': 'critical',
        'is_resolved': false,
        'created_at': '2026-06-04T10:00:00.000Z',
      });

      expect(provider.alerts.first.isResolved, false);

      mockAdapter.mockResponse = ResponseBody.fromString(
        json.encode({'message': 'Success'}),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

      final success = await provider.resolveAlert('alert-resolve-test');

      expect(success, true);
      expect(provider.alerts.first.isResolved, true);
      expect(provider.activeAlertCount, 0);
    });

    test('triggerSosAlert gửi SOS thành công và chèn vào đầu danh sách', () async {
      mockAdapter.mockResponse = ResponseBody.fromString(
        json.encode({
          'id': 'alert-sos',
          'patient_id': 'p-1',
          'full_name': 'Nguyen Van A',
          'alert_type': 'SOS',
          'message': 'SOS khẩn cấp',
          'severity': 'critical',
          'is_resolved': false,
          'created_at': '2026-06-04T11:00:00.000Z',
        }),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

      final success = await provider.triggerSosAlert('SOS khẩn cấp');

      expect(success, true);
      expect(provider.alerts.length, 1);
      expect(provider.alerts.first.id, 'alert-sos');
      expect(provider.alerts.first.alertType, 'SOS');
    });

    test('addOrUpdateRealtimeAlert xử lý sự kiện websocket cập nhật hoặc thêm mới cảnh báo', () {
      // 1. Thêm cảnh báo mới qua realtime
      provider.addOrUpdateRealtimeAlert({
        'id': 'alert-rt-1',
        'patient_id': 'p-1',
        'full_name': 'Nguyen Van A',
        'alert_type': 'HIGH_BP',
        'message': 'Huyết áp cao',
        'severity': 'warning',
        'is_resolved': false,
        'created_at': '2026-06-04T12:00:00.000Z',
      });

      expect(provider.alerts.length, 1);
      expect(provider.alerts.first.id, 'alert-rt-1');
      expect(provider.alerts.first.isResolved, false);

      // 2. Cập nhật cảnh báo đó sang resolved qua realtime
      provider.addOrUpdateRealtimeAlert({
        'id': 'alert-rt-1',
        'patient_id': 'p-1',
        'full_name': 'Nguyen Van A',
        'alert_type': 'HIGH_BP',
        'message': 'Huyết áp cao',
        'severity': 'warning',
        'is_resolved': true,
        'created_at': '2026-06-04T12:00:00.000Z',
      });

      expect(provider.alerts.length, 1);
      expect(provider.alerts.first.isResolved, true);
    });

    test('fetchWeeklyStats nạp thống kê cảnh báo 7 ngày thành công', () async {
      mockAdapter.mockResponse = ResponseBody.fromString(
        json.encode([
          {'label': '03/06', 'count': 2},
          {'label': '04/06', 'count': 5}
        ]),
        200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

      await provider.fetchWeeklyStats();

      expect(provider.weeklyStats.length, 2);
      expect(provider.weeklyStats[0]['label'], '03/06');
      expect(provider.weeklyStats[0]['count'], 2);
      expect(provider.weeklyStats[1]['label'], '04/06');
      expect(provider.weeklyStats[1]['count'], 5);
    });
  });
}
