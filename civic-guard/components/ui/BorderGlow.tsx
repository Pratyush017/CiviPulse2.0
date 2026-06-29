"use client";

import React from "react";
import { motion } from "motion/react";

interface BorderGlowProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string; // gradient color definition, e.g., "from-teal-500 via-indigo-500 to-pink-500"
  duration?: number; // rotating animation speed in seconds
  borderRadius?: string; // Tailwind class name, e.g., "rounded-2xl"
  glowWidth?: number; // thickness of the glowing border
}

export function BorderGlow({
  children,
  className = "",
  glowColor = "from-emerald-500 via-sky-500 to-violet-600",
  duration = 6,
  borderRadius = "rounded-xl",
  glowWidth = 1,
}: BorderGlowProps) {
  return (
    <div 
      style={{ padding: `${glowWidth}px` }}
      className={`relative inline-block w-full ${borderRadius} ${className}`}
    >
      {/* Glow effect in the background */}
      <motion.div
        className={`absolute inset-0 -z-10 opacity-75 blur-md bg-gradient-to-r ${glowColor} ${borderRadius}`}
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          repeat: Infinity,
          duration: duration,
          ease: "linear",
        }}
        style={{
          transformOrigin: "center center",
        }}
      />

      {/* Border gradient tracker */}
      <div className={`absolute inset-0 -z-10 bg-gradient-to-r ${glowColor} ${borderRadius}`} />

      {/* Internal Content Container */}
      <div className={`h-full w-full bg-slate-900/90 text-white ${borderRadius}`}>
        {children}
      </div>
    </div>
  );
}
