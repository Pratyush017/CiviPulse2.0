"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from "motion/react";

interface DockProps {
  children?: React.ReactNode;
  className?: string;
}

export function Dock({ children, className = "" }: DockProps) {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={`flex h-16 items-end gap-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 px-4 pb-3 backdrop-blur-md shadow-2xl ${className}`}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ mouseX: MotionValue<number> }>, { mouseX });
        }
        return child;
      })}
    </motion.div>
  );
}

interface DockIconProps {
  children: React.ReactNode;
  mouseX?: MotionValue<number>;
  onClick?: () => void;
  tooltip?: string;
  className?: string;
}

export function DockIcon({
  children,
  mouseX,
  onClick,
  tooltip,
  className = "",
}: DockIconProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Default motion value if parent Dock did not inject it (or if used alone)
  const fallbackMouseX = useMotionValue(Infinity);
  const activeMouseX = mouseX || fallbackMouseX;

  const distance = useTransform(activeMouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [40, 64, 40]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [40, 64, 40]);

  const width = useSpring(widthTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  const height = useSpring(heightTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <div className="relative group">
      <motion.div
        ref={ref}
        style={{ width, height }}
        onClick={onClick}
        className={`flex aspect-square items-center justify-center rounded-xl bg-slate-800/80 hover:bg-slate-700/90 text-white transition-colors duration-200 cursor-pointer shadow-md ${className}`}
      >
        {children}
      </motion.div>

      {/* Tooltip */}
      {tooltip && (
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all duration-200 bg-slate-950 text-slate-100 text-xs px-2 py-1 rounded border border-slate-800 pointer-events-none whitespace-nowrap shadow-md">
          {tooltip}
        </span>
      )}
    </div>
  );
}
