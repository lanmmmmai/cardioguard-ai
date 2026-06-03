/**
 * Tệp: CardioGuard AI – Hook kết nối WebSocket thời gian thực
 * Mục đích: Quản lý kết nối WebSocket liên tục đến backend để
 *           nhận dữ liệu telemetry cảm biến trực tiếp. Xử lý xác thực,
 *           kết nối lại với backoff theo cấp số nhân, ping duy trì kết nối
 *           và dọn dẹp khi hủy gắn.
 * Luồng xử lý: 1. connect() tạo WebSocket, gửi token xác thực khi mở.
 *              2. Duy trì kết nối với khoảng thời gian ping 25 giây.
 *              3. Khi đóng (ngoài ý muốn), kết nối lại với backoff (5s→30s tối đa).
 *              4. Dọn dẹp khi token thay đổi hoặc hủy gắn sẽ đóng socket.
 * Quan hệ:
 *   - sử dụng: ../config (WS_URL)
 *   - được tiêu thụ bởi: widget dashboard thời gian thực
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '../config';

/** Tải trọng telemetry cảm biến đến từ server */
export interface SensorTelemetryMessage {
  patient_id: string;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  ecg_value: number;
  is_abnormal: boolean;
  alerts: Array<{
    alert_type: string;
    message: string;
    severity: string;
  }>;
}

/** Phong bì thông báo WebSocket chung (sự kiện kết nối, siêu dữ liệu) */
export interface RealtimeEnvelope {
  type: string;
  patient_id?: string;
  data?: any;
  message?: string;
  timestamp?: string;
}

/**
 * Thiết lập kết nối WebSocket cho dữ liệu telemetry cảm biến thời gian thực.
 * Tự động kết nối lại với backoff theo cấp số nhân và gửi ping định kỳ.
 *
 * @param url   - Điểm cuối WebSocket (mặc định là WS_URL config)
 * @param onMessageReceived - Callback tùy chọn cho mỗi thông báo nhận được
 * @param token - Token Bearer cho bắt tay WebSocket đã xác thực
 */
export const useWebSocket = (
  url: string = WS_URL,
  onMessageReceived?: (data: RealtimeEnvelope | SensorTelemetryMessage) => void,
  token?: string | null
) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const intentionalCloseRef = useRef<boolean>(false);
  const authenticatedRef = useRef<boolean>(false);
  const reconnectDelayRef = useRef<number>(5000); // Khởi đầu từ 5 giây
  const pingIntervalRef = useRef<number | null>(null);

  // Sử dụng ref để giữ tham chiếu callback mới nhất, tránh tình trạng re-connect liên tục khi callback thay đổi
  const onMessageReceivedRef = useRef(onMessageReceived);
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);


  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    intentionalCloseRef.current = false;
    authenticatedRef.current = false;
    clearReconnectTimer();

    // Phân giải URL động nếu window có sẵn
    let wsUrl = url;
    if (url.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}${url}`;
    } else if (window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
      wsUrl = wsUrl.replace(/^ws:\/\//i, 'wss://');
    }
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (socketRef.current !== socket) return;
        console.debug('[useWebSocket] connection opened -> isConnected=true');
        setIsConnected(true);
        reconnectDelayRef.current = 5000; // Reset độ trễ khi kết nối thành công
        if (token) {
          try {
            socket.send(JSON.stringify({ type: 'auth', token }));
          } catch (err) {
            socket.close();
          }
        }
        pingIntervalRef.current = window.setInterval(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send('ping');
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : '';
          const parsedData = JSON.parse(raw) as RealtimeEnvelope | SensorTelemetryMessage;
          const msgType = parsedData && typeof parsedData === 'object' && 'type' in parsedData ? (parsedData as RealtimeEnvelope).type : 'unknown';
          console.debug('[useWebSocket] message type=%s size=%d bytes', msgType, raw.length);
          if (
            typeof parsedData === 'object' &&
            parsedData !== null &&
            'type' in parsedData &&
            (parsedData as RealtimeEnvelope).type === 'connected'
          ) {
            authenticatedRef.current = true;
          }
          if (onMessageReceivedRef.current) {
            onMessageReceivedRef.current(parsedData);
          }
        } catch (err) {
          console.error('Lỗi phân tích dữ liệu thông báo WebSocket:', err);
        }
      };

      socket.onclose = () => {
        if (socketRef.current !== socket) return;
        socketRef.current = null;
        console.debug('[useWebSocket] connection closed -> isConnected=false');
        setIsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        if (intentionalCloseRef.current) return; // Bỏ qua nếu chủ động đóng
        if (!onMessageReceivedRef.current) return;
        if (!token || !authenticatedRef.current) return;

        console.warn(`WebSocket thời gian thực bị ngắt kết nối. Đang thử kết nối lại sau ${reconnectDelayRef.current / 1000} giây...`);

        // Cố gắng kết nối lại với backoff theo cấp số nhân
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 30000); // Tăng dần độ trễ, tối đa 30s
          connectRef.current?.();
        }, reconnectDelayRef.current);
      };

      socket.onerror = () => {
        if (socketRef.current !== socket) return;
        if (intentionalCloseRef.current) return; // Bỏ qua thông báo lỗi khi unmount trong StrictMode
        // Không sử dụng console.error để tránh làm ngập tràn (flooding) console đỏ khi server offline.
        // Trình duyệt đã tự động log lỗi kết nối thất bại mặc định.
        socket.close();
      };
    } catch (e) {
      console.error('Không thể khởi tạo kết nối WebSocket:', e);
    }
  }, [url, token]);

  const connectRef = useRef<() => void>();
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!token) return;

    connect();

    return () => {
      clearReconnectTimer();
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (socketRef.current) {
        intentionalCloseRef.current = true; // Đánh dấu chủ động đóng trong React cleanup
        const currentSocket = socketRef.current;
        socketRef.current = null;
        setIsConnected(false);
        currentSocket.close();
      }
    };
  }, [clearReconnectTimer, connect, token]);

  return { isConnected };
};
