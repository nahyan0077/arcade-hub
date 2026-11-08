import React, { useRef, useEffect, useState } from 'react';
import type { RushStimulus } from '../../engine/direction-rush';
import { directionToRotate } from '../../engine/direction-rush';
import { Leaf } from './Leaf';

interface LeafFieldProps {
  stimulus: RushStimulus | null;
  leafCount?: number;
}

interface LeafParticle {
  x: number;
  y: number;
  speed: number;
  size: number;
  swayOffset: number;
}

export const LeafField: React.FC<LeafFieldProps> = ({
  stimulus,
  leafCount = 7,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const leavesRef = useRef<(HTMLDivElement | null)[]>([]);
  const particlesRef = useRef<LeafParticle[]>([]);
  const [dimensions, setDimensions] = useState({ width: 440, height: 280 });

  // Measure container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize leaf positions nicely spread throughout the container
  useEffect(() => {
    const { width, height } = dimensions;
    const particles: LeafParticle[] = [];
    for (let i = 0; i < leafCount; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const baseX = ((col + 0.5) / 3) * width;
      const baseY = ((row + 0.5) / Math.ceil(leafCount / 3)) * height;
      particles.push({
        x: Math.max(30, Math.min(width - 30, baseX + (Math.random() - 0.5) * 40)),
        y: Math.max(30, Math.min(height - 30, baseY + (Math.random() - 0.5) * 40)),
        speed: 1.8 + Math.random() * 1.2,
        size: 42 + Math.floor(Math.random() * 10),
        swayOffset: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, [dimensions, leafCount]);

  // rAF drift loop in stimulus.moving direction
  useEffect(() => {
    if (!stimulus) return;
    let animId: number;
    let frame = 0;

    const tick = () => {
      frame++;
      const { width, height } = dimensions;
      const moveDir = stimulus.moving;

      let dx = 0;
      let dy = 0;
      if (moveDir === 'up') dy = -1;
      else if (moveDir === 'down') dy = 1;
      else if (moveDir === 'left') dx = -1;
      else if (moveDir === 'right') dx = 1;

      particlesRef.current.forEach((p, i) => {
        p.x += dx * p.speed;
        p.y += dy * p.speed;

        // Subtle organic sway
        const sway = Math.sin(frame * 0.04 + p.swayOffset) * 0.5;
        if (moveDir === 'up' || moveDir === 'down') {
          p.x += sway;
        } else {
          p.y += sway;
        }

        // Boundary wrapping
        const pad = 40;
        if (p.x < -pad) p.x = width + pad;
        if (p.x > width + pad) p.x = -pad;
        if (p.y < -pad) p.y = height + pad;
        if (p.y > height + pad) p.y = -pad;

        const el = leavesRef.current[i];
        if (el) {
          el.style.transform = `translate3d(${p.x - p.size / 2}px, ${p.y - p.size / 2}px, 0)`;
        }
      });

      animId = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(animId);
  }, [stimulus?.moving, dimensions]);

  const pointingAngle = stimulus ? directionToRotate(stimulus.pointing) : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none pointer-events-none"
    >
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <svg width="100%" height="100%" className="w-full h-full">
          <defs>
            <pattern
              id="gridLines"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridLines)" />
        </svg>
      </div>

      {/* Floating leaves */}
      {particlesRef.current.map((p, i) => (
        <div
          key={i}
          ref={(el) => {
            leavesRef.current[i] = el;
          }}
          className="absolute top-0 left-0 transition-none will-change-transform"
          style={{
            transform: `translate3d(${p.x - p.size / 2}px, ${p.y - p.size / 2}px, 0)`,
          }}
        >
          <Leaf rotate={pointingAngle} size={p.size} />
        </div>
      ))}
    </div>
  );
};
