import React, { useEffect, useRef } from 'react';

interface ECGChartProps {
  liveEcgValue?: number;
  heartRate: number;
}

export const ECGChart: React.FC<ECGChartProps> = ({ liveEcgValue, heartRate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataPointsRef = useRef<number[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Initialize buffer size
  useEffect(() => {
    // Fill buffer with baseline values
    dataPointsRef.current = Array(300).fill(0);
  }, []);

  // Handle incoming live value
  useEffect(() => {
    if (liveEcgValue !== undefined) {
      // Shift left and append new value
      dataPointsRef.current.shift();
      dataPointsRef.current.push(liveEcgValue);
    }
  }, [liveEcgValue]);

  // Animation sweep loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    const render = (timestamp: number) => {
      // If we don't have live incoming data, simulate a realistic ECG signal
      if (liveEcgValue === undefined) {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const elapsed = timestamp - lastTimeRef.current;

        // Determine cardiac cycle duration based on heartRate (in ms)
        // e.g. 70 bpm -> 857ms per cycle
        const cycleDuration = (60 / Math.max(heartRate, 40)) * 1000;
        
        // Render points in sync with timestamp
        if (elapsed > 16) { // ~60fps updates
          lastTimeRef.current = timestamp;
          
          // Generate a normal ECG complex (P-Q-R-S-T)
          const t = (timestamp % cycleDuration) / cycleDuration; // 0 to 1
          let simVal = 0;

          // Simple mathematical model of ECG
          if (t > 0.1 && t < 0.15) {
            // P wave
            simVal = 0.15 * Math.sin((t - 0.1) * Math.PI / 0.05);
          } else if (t >= 0.18 && t < 0.2) {
            // Q wave
            simVal = -0.2 * (t - 0.18) / 0.02;
          } else if (t >= 0.2 && t < 0.23) {
            // R wave (high peak)
            simVal = -0.2 + 1.2 * (t - 0.2) / 0.03;
          } else if (t >= 0.23 && t < 0.26) {
            // S wave (deep drop)
            simVal = 1.0 - 1.4 * (t - 0.23) / 0.03;
          } else if (t >= 0.26 && t < 0.29) {
            // S recovery to baseline
            simVal = -0.4 + 0.4 * (t - 0.26) / 0.03;
          } else if (t >= 0.35 && t < 0.45) {
            // T wave
            simVal = 0.25 * Math.sin((t - 0.35) * Math.PI / 0.1);
          } else {
            // Baseline noise (tiny random fluctuations for realism)
            simVal = (Math.random() - 0.5) * 0.02;
          }

          dataPointsRef.current.shift();
          dataPointsRef.current.push(simVal);
        }
      }

      // Draw Grid System
      ctx.clearRect(0, 0, width, height);
      
      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.06)';
      ctx.lineWidth = 0.5;

      // Small grids (every 10px)
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

      // Large grid squares (every 50px)
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

      // Draw ECG Curve with Neon Glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'var(--color-spo2)';
      ctx.strokeStyle = 'var(--color-spo2)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      const points = dataPointsRef.current;
      const step = width / (points.length - 1);

      for (let i = 0; i < points.length; i++) {
        const x = i * step;
        // ECG scale: value multiplied by amp, inverted because canvas Y coordinates start from top
        const y = centerY - points[i] * (height * 0.35);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Reset shadows for next drawings
      ctx.shadowBlur = 0;

      // Pulse indicator (sweep glowing lead dot)
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
  }, [liveEcgValue, heartRate]);

  return (
    <div className="ecg-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TÍN HIỆU ĐIỆN TÂM ĐỒ (ECG)</span>
        <span className="badge" style={{ background: 'var(--color-spo2-glow)', color: 'var(--color-spo2)' }}>LIVE MONITOR</span>
      </div>
      <div className="ecg-canvas-wrapper">
        <div className="ecg-grid-overlay"></div>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  );
};
