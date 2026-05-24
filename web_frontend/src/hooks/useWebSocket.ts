import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from '../config';

interface WebSocketMessage {
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

export const useWebSocket = (
  url: string = `${WS_URL}/ws/realtime`,
  onMessageReceived?: (data: WebSocketMessage) => void
) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

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
        setIsConnected(true);
        console.log('Realtime WebSocket connection established');
      };

      socket.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data) as WebSocketMessage;
          if (onMessageReceived) {
            onMessageReceived(parsedData);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message data:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        console.log('Realtime WebSocket disconnected, retrying connection in 3 seconds...');
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      socket.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        socket.close();
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket connection:', e);
    }
  }, [url, onMessageReceived]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent reconnect on cleanup
        socketRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
};
