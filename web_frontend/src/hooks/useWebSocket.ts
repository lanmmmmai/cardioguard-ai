import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '../config';

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

export interface RealtimeEnvelope {
  type: string;
  patient_id?: string;
  data?: any;
  message?: string;
  timestamp?: string;
}

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

    // Resolve URL dynamically if window is available
    let wsUrl = url;
    if (url.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}${url}`;
    }
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (socketRef.current !== socket) return;
        setIsConnected(true);
        reconnectDelayRef.current = 5000; // Reset độ trễ khi kết nối thành công
        if (token) {
          try {
            socket.send(JSON.stringify({ type: 'auth', token }));
          } catch (err) {
            socket.close();
          }
        }
      };

      socket.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data) as RealtimeEnvelope | SensorTelemetryMessage;
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
          console.error('Error parsing WebSocket message data:', err);
        }
      };

      socket.onclose = () => {
        if (socketRef.current !== socket) return;
        socketRef.current = null;
        setIsConnected(false);
        if (intentionalCloseRef.current) return; // Bỏ qua nếu chủ động đóng
        if (!onMessageReceivedRef.current) return;
        if (!token || !authenticatedRef.current) return;
        
        console.warn(`Realtime WebSocket disconnected. Retrying connection in ${reconnectDelayRef.current / 1000} seconds...`);
        
        // Attempt to reconnect with exponential backoff
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 30000); // Tăng dần độ trễ, tối đa 30s
          connect();
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
      console.error('Failed to initialize WebSocket connection:', e);
    }
  }, [url, token]);

  useEffect(() => {
    if (!token) return;

    connect();

    return () => {
      clearReconnectTimer();
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
