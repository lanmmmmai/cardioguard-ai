import React, { useEffect, useRef } from 'react';
import { Radio, AlertCircle } from 'lucide-react';

export const ICUCamera: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

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

    const render = (timestamp: number) => {
      ctx.clearRect(0, 0, width, height);

      // Night vision thermal green wash background
      ctx.fillStyle = '#030a03';
      ctx.fillRect(0, 0, width, height);

      // Draw thermal grid lines
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw camera brackets (viewfinder corners)
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.6)';
      ctx.lineWidth = 1.5;
      const margin = 25;
      const bracketLen = 20;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(margin + bracketLen, margin);
      ctx.lineTo(margin, margin);
      ctx.lineTo(margin, margin + bracketLen);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(width - margin - bracketLen, margin);
      ctx.lineTo(width - margin, margin);
      ctx.lineTo(width - margin, margin + bracketLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(margin + bracketLen, height - margin);
      ctx.lineTo(margin, height - margin);
      ctx.lineTo(margin, height - margin - bracketLen);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(width - margin - bracketLen, height - margin);
      ctx.lineTo(width - margin, height - margin);
      ctx.lineTo(width - margin, height - margin - bracketLen);
      ctx.stroke();

      // Draw center crosshair
      ctx.beginPath();
      ctx.moveTo(width / 2 - 10, height / 2);
      ctx.lineTo(width / 2 + 10, height / 2);
      ctx.moveTo(width / 2, height / 2 - 10);
      ctx.lineTo(width / 2, height / 2 + 10);
      ctx.stroke();

      // Draw ICU Patient Bed & Silhouette (Vector graphics)
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.3)';
      ctx.lineWidth = 2;
      
      const bedY = height * 0.68;
      const bedX1 = width * 0.15;
      const bedX2 = width * 0.85;

      // Bed base frame
      ctx.beginPath();
      ctx.moveTo(bedX1, bedY);
      ctx.lineTo(bedX2, bedY);
      // Bed legs
      ctx.moveTo(bedX1 + 40, bedY);
      ctx.lineTo(bedX1 + 40, bedY + 60);
      ctx.moveTo(bedX2 - 40, bedY);
      ctx.lineTo(bedX2 - 40, bedY + 60);
      // Headrest incline
      ctx.moveTo(bedX1, bedY);
      ctx.lineTo(bedX1 - 15, bedY - 40);
      ctx.stroke();

      // Simulated breathing cycle (chest rise/fall)
      // 15 breaths per minute -> 4 seconds per breath cycle
      const breathTime = timestamp / 4000;
      const chestExpansion = 6 * Math.sin(breathTime * 2 * Math.PI); // -6px to +6px expansion

      // Draw patient silhouette resting on bed
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.55)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(57, 255, 20, 0.4)';
      ctx.lineWidth = 2.5;

      const pHeadX = bedX1 + 70;
      const pHeadY = bedY - 35;
      const pChestX = pHeadX + 50;
      const pChestY = bedY - 20;

      ctx.beginPath();
      // 1. Pillow
      ctx.arc(pHeadX - 10, bedY - 10, 15, 0, Math.PI, true);
      ctx.stroke();

      ctx.beginPath();
      // 2. Patient Head
      ctx.arc(pHeadX, pHeadY, 12, 0, 2 * Math.PI);
      
      // 3. Neck & Shoulder
      ctx.moveTo(pHeadX + 10, pHeadY + 5);
      ctx.lineTo(pHeadX + 18, bedY - 10);
      
      // 4. Chest & Body (with breathing expansion)
      ctx.quadraticCurveTo(
        pChestX, 
        pChestY - 12 - Math.max(0, chestExpansion), // chest rises up
        pHeadX + 100, 
        bedY - 15
      );
      
      // 5. Blanket covering legs
      ctx.lineTo(bedX2 - 30, bedY - 5);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Draw IV Stand and wires
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.25)';
      ctx.lineWidth = 1.5;
      const ivX = pHeadX - 35;
      ctx.beginPath();
      ctx.moveTo(ivX, bedY + 40);
      ctx.lineTo(ivX, bedY - 120);
      ctx.moveTo(ivX - 15, bedY - 120);
      ctx.lineTo(ivX + 15, bedY - 120);
      ctx.stroke();

      // Fluid bag
      ctx.strokeRect(ivX - 10, bedY - 110, 8, 18);
      // Drip wire going to patient arm
      ctx.beginPath();
      ctx.moveTo(ivX - 6, bedY - 92);
      ctx.bezierCurveTo(ivX - 6, bedY - 40, pChestX - 10, bedY - 5, pChestX + 10, bedY - 10);
      ctx.stroke();

      // Bedside Vital Monitor Outline
      const monX = bedX2 - 100;
      const monY = bedY - 120;
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
      ctx.strokeRect(monX, monY, 70, 50);
      // Small neon lines on screen
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(monX + 5, monY + 15);
      for (let mx = 5; mx < 65; mx += 10) {
        ctx.lineTo(monX + mx, monY + 15 + Math.sin(timestamp / 100 + mx) * 5);
      }
      ctx.stroke();

      // Draw Camera HUD Labels (Blinking details)
      ctx.fillStyle = 'rgba(57, 255, 20, 0.85)';
      ctx.font = '500 11px var(--font-sans)';
      
      // ICU Room tag
      ctx.fillText('CAM 04 - KHU VỰC ICU', margin + 15, margin + 40);
      ctx.fillText('CHẾ ĐỘ: HỒNG NGOẠI / THÂN NHIỆT', margin + 15, margin + 56);

      // System details
      ctx.fillText('KẾT NỐI: ỔN ĐỊNH', width - margin - 110, margin + 40);
      ctx.fillText('ĐỘ PHÂN GIẢI: 1080P', width - margin - 110, margin + 56);

      // Running timecode
      const now = new Date();
      const timeStr = now.toLocaleTimeString() + '.' + String(Math.floor(timestamp % 1000)).padStart(3, '0');
      ctx.fillText(timeStr, margin + 15, height - margin - 15);
      
      // Blinking battery icon outline
      const isBatFlash = Math.floor(timestamp / 500) % 2 === 0;
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.7)';
      ctx.strokeRect(width - margin - 50, height - margin - 22, 28, 12);
      ctx.fillStyle = isBatFlash ? 'rgba(57, 255, 20, 0.7)' : 'rgba(57, 255, 20, 0.2)';
      ctx.fillRect(width - margin - 46, height - margin - 19, 20, 6);

      // Blinking REC indicators
      const isRecFlash = Math.floor(timestamp / 600) % 2 === 0;
      if (isRecFlash) {
        ctx.fillStyle = '#ff073a';
        ctx.beginPath();
        ctx.arc(margin + 20, margin + 15, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 51, 102, 0.8)';
        ctx.fillText('REC', margin + 32, margin + 18);
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Camera Giả Lập ICU</h1>
          <p className="page-subtitle">Theo dõi luồng video hồng ngoại trực tiếp từ giường bệnh hồi sức tích cực</p>
        </div>
        <div className="badge" style={{ background: 'rgba(57, 255, 20, 0.1)', color: 'var(--color-bp)', border: '1px solid rgba(57, 255, 20, 0.2)' }}>
          <Radio className="beat-animated" size={12} style={{ marginRight: '6px' }} /> LIVE STREAM
        </div>
      </div>

      <div className="panel" style={{ padding: '1rem' }}>
        <div className="camera-monitor-wrapper">
          <div className="camera-scanline"></div>
          <div className="camera-noise"></div>
          <canvas ref={canvasRef} className="camera-canvas" />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <AlertCircle size={16} style={{ color: 'var(--color-bp)' }} />
          <span>
            Hệ thống đang hiển thị tín hiệu từ <strong>Giường 04</strong>. Cảm biến chuyển động sinh học và nhịp thở (Chest rise expansion) đang đồng bộ ở chế độ Night-Vision.
          </span>
        </div>
      </div>
    </div>
  );
};
export default ICUCamera;
