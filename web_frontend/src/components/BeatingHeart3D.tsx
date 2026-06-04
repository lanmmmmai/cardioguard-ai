/**
 * @purpose Mô phỏng trái tim 3D hoạt hình được hiển thị trên Canvas HTML5.
 *          Tạo một đám mây điểm tham số của bề mặt trái tim, sau đó liên tục
 *          tạo hoạt hình với mô hình nhịp đập thực tế và xoay theo trục Y/X.
 * @workflow  1. Tạo đám mây điểm trái tim (phương trình tham số + điểm thể tích
 *            bên trong) khi mount → 2. Trên mỗi khung hình hoạt hình, tính toán
 *            vị trí chu kỳ tim (xung P-Q-R-S-T) dựa trên prop heartRate hiện tại →
 *            3. Áp dụng xoay 3D và chiếu phối cảnh → 4. Sắp xếp điểm từ sau ra
 *            trước và hiển thị dưới dạng chấm neon phát sáng.
 * @relationships
 *   - Được sử dụng bởi Dashboard.tsx (bảng giám sát thời gian thực)
 *   - Nhận prop heartRate từ currentMetrics của component cha
 */
import React, { useEffect, useRef } from 'react';

interface BeatingHeart3DProps {
  heartRate: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Trái tim đập 3D dựa trên Canvas. Hoạt hình nhịp đập đồng bộ với
 * heartRate đầu vào để tạo ra nhịp tim trực quan chân thực.
 */
export const BeatingHeart3D: React.FC<BeatingHeart3DProps> = ({ heartRate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const angleRef = useRef<number>(0);
  const pointsRef = useRef<Point3D[]>([]);
  const heartRateRef = useRef<number>(heartRate);

  useEffect(() => {
    heartRateRef.current = heartRate;
  }, [heartRate]);

  useEffect(() => {
    const points: Point3D[] = [];
    const numLatitudes = 35;
    const numLongitudes = 35;

    for (let i = 0; i < numLatitudes; i++) {
      const theta = (i / numLatitudes) * Math.PI;
      
      for (let j = 0; j < numLongitudes; j++) {
        const phi = (j / numLongitudes) * 2 * Math.PI;

        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const sin3Theta = Math.pow(sinTheta, 3);

        const x = 16 * sin3Theta * Math.sin(phi);
        const y = 13 * cosTheta - 5 * Math.cos(2 * theta) - 2 * Math.cos(3 * theta) - Math.cos(4 * theta);
        const z = 16 * sin3Theta * Math.cos(phi);

        points.push({ x, y: y * 0.9, z });
      }
    }
    
    for (let k = 0; k < 300; k++) {
      const theta = Math.random() * Math.PI;
      const phi = Math.random() * 2 * Math.PI;
      const r = Math.random();
      
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const sin3Theta = Math.pow(sinTheta, 3);

      const x = 16 * sin3Theta * Math.sin(phi) * r;
      const y = (13 * cosTheta - 5 * Math.cos(2 * theta) - 2 * Math.cos(3 * theta) - Math.cos(4 * theta)) * r;
      const z = 16 * sin3Theta * Math.cos(phi) * r;

      points.push({ x, y: y * 0.9, z });
    }

    pointsRef.current = points;
  }, []);

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
      const centerX = width / 2;
      const centerY = height / 2 - 10;

      ctx.clearRect(0, 0, width, height);

      const cycleDuration = (60 / Math.max(heartRateRef.current, 40)) * 1000;
      const t = (timestamp % cycleDuration) / cycleDuration;
      let pulse = 0;

      if (t < 0.1) {
        pulse = 0.04 * Math.sin(t * Math.PI / 0.1);
      } else if (t >= 0.15 && t < 0.22) {
        pulse = 0.22 * Math.sin((t - 0.15) * Math.PI / 0.07);
      } else if (t >= 0.22 && t < 0.38) {
        pulse = 0.06 * Math.sin((t - 0.22) * Math.PI / 0.16);
      }

      const pulseScale = 4.2 * (1 + pulse);
      
      angleRef.current += 0.015;
      const angleY = angleRef.current;
      const angleX = 0.2 * Math.sin(timestamp * 0.0005);

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      const points = pointsRef.current;
      const cameraDistance = 60;

      const projected = points.map(p => {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;

        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        const scale = cameraDistance / (cameraDistance + z2);
        const screenX = centerX + x1 * pulseScale * scale;
        const screenY = centerY - y2 * pulseScale * scale;

        return {
          x: screenX,
          y: screenY,
          z: z2,
          scale
        };
      });

      projected.sort((a, b) => b.z - a.z);

      projected.forEach(p => {
        const depthAlpha = Math.max(0.15, Math.min(1.0, 1 - (p.z + 18) / 36));
        
        ctx.fillStyle = `rgba(255, 51, 102, ${depthAlpha * 0.85})`;
        ctx.beginPath();
        const radius = Math.max(0.6, 1.4 * p.scale);
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        if (p.z < -10 && Math.random() < 0.05) {
          ctx.fillStyle = `rgba(255, 255, 255, ${depthAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 1.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

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
    <div className="heart-3d-container">
      <canvas ref={canvasRef} className="heart-3d-canvas" />
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', letterSpacing: '1px', marginTop: '-15px' }}>
        3D CARDIAC HEART BEAT ({heartRate} BPM)
      </span>
    </div>
  );
};
export default BeatingHeart3D;
