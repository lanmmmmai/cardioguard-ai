import 'package:flutter_test/flutter_test.dart';
import 'package:heart_monitor_app/core/api_client.dart';

void main() {
  group('ApiClient.extractListData', () {
    test('returns direct list payloads unchanged', () {
      final data = [
        {'id': '1'},
        {'id': '2'},
      ];

      expect(ApiClient.extractListData(data), same(data));
    });

    test('extracts items from paginated envelopes', () {
      final data = {
        'items': [
          {'id': '1'},
          {'id': '2'},
        ],
        'total': 2,
        'limit': 50,
        'offset': 0,
      };

      expect(ApiClient.extractListData(data), equals(data['items']));
    });
  });
}
