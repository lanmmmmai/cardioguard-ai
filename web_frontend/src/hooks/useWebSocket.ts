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

  // Sử dụng ref để giữ tham chiếu callback mới nhất, tránh tình trạng re-connect liên tục khi callback thay đổi
  const onMessageReceivedRef = useRef(onMessageReceived);
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    intentionalCloseRef.current = false;

    // Resolve URL dynamically if window is available
    let wsUrl = url;
    if (url.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}${url}`;
    }
    try {
      const socket = token
        ? new WebSocket(wsUrl, [`cardioguard.jwt.${token}`])
        : new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        console.log('Realtime WebSocket connection established');
      };

      socket.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data) as RealtimeEnvelope | SensorTelemetryMessage;
          if (onMessageReceivedRef.current) {
            onMessageReceivedRef.current(parsedData);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message data:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        if (intentionalCloseRef.current) return; // Bỏ qua nếu chủ động đóng
        if (!onMessageReceivedRef.current) return;
        console.log('Realtime WebSocket disconnected, retrying connection in 3 seconds...');
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      socket.onerror = (error) => {
        if (intentionalCloseRef.current) return; // Bỏ qua thông báo lỗi khi unmount trong StrictMode
        console.error('WebSocket connection error:', error);
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        intentionalCloseRef.current = true; // Đánh dấu chủ động đóng trong React cleanup
        socketRef.current.close();
      }
    };
  }, [connect, token]);

  return { isConnected };
};
