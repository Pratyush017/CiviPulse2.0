"use client";

import React, { useRef, useEffect } from "react";

interface Spark {
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface ClickSparkProps {
  children?: React.ReactNode;
  sparkColors?: string[];
  sparkCount?: number;
  className?: string;
}

export function ClickSpark({
  children,
  sparkColors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
  sparkCount = 12,
  className = "",
}: ClickSparkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const resizeCanvas = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sparks = sparksRef.current;

      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [sparkColors]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !canvasRef.current) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const newSparks: Spark[] = [];

    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      const size = 1.5 + Math.random() * 2.5;
      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
      const decay = 0.015 + Math.random() * 0.02;

      newSparks.push({
        x: clickX,
        y: clickY,
        angle,
        speed,
        size,
        color,
        alpha: 1,
        decay,
      });
    }

    sparksRef.current = [...sparksRef.current, ...newSparks];
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`relative inline-block w-full h-full cursor-pointer overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-20"
      />
      {children}
    </div>
  );
}
