/**
 * @purpose Dạng sóng ECG thời gian thực được hiển thị trên Canvas HTML5.
 *          Vẽ nền lưới và đường ECG phát sáng màu neon. Khi có dữ liệu trực tiếp,
 *          nó hiển thị các giá trị đến; nếu không, nó tạo phức hợp P-Q-R-S-T
 *          tổng hợp dựa trên heartRate.
 * @workflow  1. Khởi tạo bộ đệm 300 điểm với giá trị đường cơ sở → 2. Nếu
 *            liveEcgValue được định nghĩa, dịch chuyển bộ đệm và thêm giá trị mới
 *            trên mỗi lần thay đổi prop → 3. Nếu không có dữ liệu trực tiếp, mô phỏng
 *            dạng sóng ECG bằng mô hình chu kỳ tim toán học trong vòng lặp hoạt hình →
 *            4. Mỗi khung hình hoạt hình: xóa canvas, vẽ đường lưới, vẽ đường ECG với
 *            hiệu ứng phát sáng neon và hiển thị chấm dẫn đầu.
 * @relationships
 *   - Được sử dụng bởi Dashboard.tsx trong bảng ECG
 *   - Nhận props liveEcgValue tùy chọn và heartRate bắt buộc
 */
import React, { useEffect, useRef } from 'react';

interface ECGChartProps {
  liveEcgValue?: number;
  heartRate: number;
}

/**
 * Dạng sóng ECG dựa trên Canvas. Sử dụng giá trị trực tiếp khi có sẵn, nếu không
 * thì tạo dạng sóng P-Q-R-S-T tổng hợp chân thực.
 */
export const ECGChart: React.FC<ECGChartProps> = ({ liveEcgValue, heartRate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataPointsRef = useRef<number[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const heartRateRef = useRef(heartRate);
  const liveEcgValueRef = useRef(liveEcgValue);

  useEffect(() => {
    heartRateRef.current = heartRate;
  }, [heartRate]);

  useEffect(() => {
    liveEcgValueRef.current = liveEcgValue;
  }, [liveEcgValue]);

  useEffect(() => {
    dataPointsRef.current = Array(300).fill(0);
  }, []);

  useEffect(() => {
    if (liveEcgValue !== undefined) {
      dataPointsRef.current.shift();
      dataPointsRef.current.push(liveEcgValue);
    }
  }, [liveEcgValue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (timestamp: number) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const currentWidth = rect.width * dpr;
      const currentHeight = rect.height * dpr;
      
      if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
        canvas.width = currentWidth;
        canvas.height = currentHeight;
        ctx.scale(dpr, dpr);
      }
      
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;
      if (liveEcgValueRef.current === undefined) {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const elapsed = timestamp - lastTimeRef.current;

        const cycleDuration = (60 / Math.max(heartRateRef.current, 40)) * 1000;
        
        if (elapsed > 16) {
          lastTimeRef.current = timestamp;
          
          const t = (timestamp % cycleDuration) / cycleDuration;
          let simVal = 0;

          if (t > 0.1 && t < 0.15) {
            simVal = 0.15 * Math.sin((t - 0.1) * Math.PI / 0.05);
          } else if (t >= 0.18 && t < 0.2) {
            simVal = -0.2 * (t - 0.18) / 0.02;
          } else if (t >= 0.2 && t < 0.23) {
            simVal = -0.2 + 1.2 * (t - 0.2) / 0.03;
          } else if (t >= 0.23 && t < 0.26) {
            simVal = 1.0 - 1.4 * (t - 0.23) / 0.03;
          } else if (t >= 0.26 && t < 0.29) {
            simVal = -0.4 + 0.4 * (t - 0.26) / 0.03;
          } else if (t >= 0.35 && t < 0.45) {
            simVal = 0.25 * Math.sin((t - 0.35) * Math.PI / 0.1);
          } else {
            simVal = (Math.random() - 0.5) * 0.02;
          }

          dataPointsRef.current.shift();
          dataPointsRef.current.push(simVal);
        }
      }

      ctx.clearRect(0, 0, width, height);
      
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.06)';
      ctx.lineWidth = 0.5;

      for (let x = 0; x < width; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 51, 102, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.shadowBlur = 10;
      const computedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-spo2').trim() || '#00e5ff';
      ctx.shadowColor = computedColor;
      ctx.strokeStyle = computedColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      const points = dataPointsRef.current;
      const step = width / (points.length - 1);

      for (let i = 0; i < points.length; i++) {
        const x = i * step;
        const y = centerY - points[i] * (height * 0.35);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.shadowBlur = 0;

      if (points.length > 0) {
        const lastX = width;
        const lastY = centerY - points[points.length - 1] * (height * 0.35);

        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        ctx.arc(lastX - 4, lastY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    animationFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  return (
    <div className="ecg-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TÍN HIỆU ĐIỆN TÂM ĐỒ (ECG)</span>
        <span className="badge" style={{ background: 'var(--color-spo2-glow)', color: 'var(--color-spo2)' }}>LIVE MONITOR</span>
      </div>
      <div className="ecg-canvas-wrapper" style={{ position: 'relative' }}>
        {liveEcgValue === undefined && (
          <span className="badge" style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.75rem', zIndex: 10 }}>
            Dạng sóng mô phỏng (Demo Waveform)
          </span>
        )}
        <div className="ecg-grid-overlay"></div>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
};
