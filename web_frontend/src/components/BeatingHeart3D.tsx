import React, { useEffect, useRef } from 'react';

interface BeatingHeart3DProps {
  heartRate: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export const BeatingHeart3D: React.FC<BeatingHeart3DProps> = ({ heartRate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const angleRef = useRef<number>(0);
  const pointsRef = useRef<Point3D[]>([]);

  // Generate 3D point cloud for the heart shape
  useEffect(() => {
    const points: Point3D[] = [];
    const numLatitudes = 35;
    const numLongitudes = 35;

    for (let i = 0; i < numLatitudes; i++) {
      // theta ranges from 0 to PI
      const theta = (i / numLatitudes) * Math.PI;
      
      for (let j = 0; j < numLongitudes; j++) {
        // phi ranges from 0 to 2PI
        const phi = (j / numLongitudes) * 2 * Math.PI;

        // Parametric 3D Heart surface equations
        // x = 16 * sin^3(theta) * sin(phi)
        // y = 13 * cos(theta) - 5 * cos(2theta) - 2 * cos(3theta) - cos(4theta)
        // z = 16 * sin^3(theta) * cos(phi)

        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const sin3Theta = Math.pow(sinTheta, 3);

        const x = 16 * sin3Theta * Math.sin(phi);
        const y = 13 * cosTheta - 5 * Math.cos(2 * theta) - 2 * Math.cos(3 * theta) - Math.cos(4 * theta);
        const z = 16 * sin3Theta * Math.cos(phi);

        points.push({ x, y: y * 0.9, z }); // y scaled slightly down to make it look nicer
      }
    }
    
    // Add some random inner volume points for holographic depth
    for (let k = 0; k < 300; k++) {
      const theta = Math.random() * Math.PI;
      const phi = Math.random() * 2 * Math.PI;
      const r = Math.random(); // volume scaling factor
      
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

  // Animation rendering sweep
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
    const centerX = width / 2;
    const centerY = height / 2 - 10; // offset slightly up

    const render = (timestamp: number) => {
      ctx.clearRect(0, 0, width, height);

      // Heart contraction pulse simulation based on current heartRate
      const cycleDuration = (60 / Math.max(heartRate, 40)) * 1000; // ms per cycle
      const t = (timestamp % cycleDuration) / cycleDuration; // 0 to 1
      let pulse = 0;

      // Mathematical heartbeat cycle model
      if (t < 0.1) {
        // P-wave slight contraction
        pulse = 0.04 * Math.sin(t * Math.PI / 0.1);
      } else if (t >= 0.15 && t < 0.22) {
        // Q-R-S contraction (main pump)
        pulse = 0.22 * Math.sin((t - 0.15) * Math.PI / 0.07);
      } else if (t >= 0.22 && t < 0.38) {
        // T-wave relaxation
        pulse = 0.06 * Math.sin((t - 0.22) * Math.PI / 0.16);
      }

      const pulseScale = 4.2 * (1 + pulse);
      
      // Update rotation angles
      angleRef.current += 0.015; // rotate y-axis
      const angleY = angleRef.current;
      const angleX = 0.2 * Math.sin(timestamp * 0.0005); // slight pitch swing

      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      // Project, sort, and draw points
      const points = pointsRef.current;
      const cameraDistance = 60;

      // Project 3D to 2D
      const projected = points.map(p => {
        // Y-axis rotation
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;

        // X-axis rotation
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        // Perspective projection
        const scale = cameraDistance / (cameraDistance + z2);
        const screenX = centerX + x1 * pulseScale * scale;
        // Invert Y because canvas Y grows downwards
        const screenY = centerY - y2 * pulseScale * scale;

        return {
          x: screenX,
          y: screenY,
          z: z2, // keep depth for sorting
          scale
        };
      });

      // Sort points back-to-front for proper painters algorithm depth perception
      projected.sort((a, b) => b.z - a.z);

      // Draw points as glowing neon nodes
      projected.forEach(p => {
        // Normalize depth (z values range roughly from -20 to 20)
        const depthAlpha = Math.max(0.15, Math.min(1.0, 1 - (p.z + 18) / 36));
        
        ctx.fillStyle = `rgba(255, 51, 102, ${depthAlpha * 0.85})`;
        ctx.beginPath();
        // Dot size depends on depth projection
        const radius = Math.max(0.6, 1.4 * p.scale);
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Highlight top glowing spots
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
  }, [heartRate]);

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
