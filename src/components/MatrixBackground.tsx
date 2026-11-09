import React, { useEffect, useRef } from 'react';

interface MatrixBackgroundProps {
  className?: string;
  opacity?: number;
}

export const MatrixBackground: React.FC<MatrixBackgroundProps> = ({
  className = '',
  opacity = 0.45,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect user motion preference
    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.getAttribute('data-reduced-motion') === 'true';
    if (prefersReducedMotion) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Characters: arcade symbols + cyber matrix runes
    const chars = '✕●▲🍃■✦★01ARCADE789XY#$&';
    const fontSize = 15;
    let columns = Math.floor(width / fontSize);
    let drops: number[] = [];
    let speeds: number[] = [];
    let columnColors: string[] = [];

    const trailColors = [
      '#10b981', // emerald
      '#059669', // green
      '#06b6d4', // cyan
      '#3b82f6', // blue
      '#8b5cf6', // violet
      '#34d399', // mint
    ];

    const initColumns = () => {
      columns = Math.floor(width / fontSize);
      drops = [];
      speeds = [];
      columnColors = [];
      for (let i = 0; i < columns; i++) {
        // Spread drops across the screen vertically right from start
        drops[i] = Math.floor(Math.random() * (height / fontSize));
        speeds[i] = 0.6 + Math.random() * 0.8;
        columnColors[i] = trailColors[Math.floor(Math.random() * trailColors.length)];
      }
    };

    initColumns();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initColumns();
    };

    window.addEventListener('resize', handleResize);

    let lastDraw = 0;
    const fpsInterval = 1000 / 30; // 30 fps

    const render = (time: number) => {
      animId = requestAnimationFrame(render);

      const elapsed = time - lastDraw;
      if (elapsed < fpsInterval) return;
      lastDraw = time - (elapsed % fpsInterval);

      // Fading dark wash for organic trails
      ctx.fillStyle = 'rgba(9, 9, 11, 0.1)';
      ctx.fillRect(0, 0, width, height);

      ctx.font = `bold ${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        // Skip some columns randomly for natural spacing
        if (i % 2 === 1 && Math.random() > 0.85) continue;

        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Head glyph: glowing bright white / mint
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = columnColors[i];
        ctx.shadowBlur = 8;
        ctx.fillText(char, x, y);

        // Trail glyph: colored arcade tint
        ctx.shadowBlur = 0;
        ctx.fillStyle = columnColors[i];
        ctx.fillText(char, x, y - fontSize);

        // Reset to top when off screen
        if (y > height && Math.random() > 0.98) {
          drops[i] = 0;
        }

        drops[i] += speeds[i];
      }
    };

    animId = requestAnimationFrame(render);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        lastDraw = performance.now();
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none select-none z-0 ${className}`}
      style={{ opacity }}
    />
  );
};
