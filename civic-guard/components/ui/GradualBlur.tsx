"use client";

import React, { useRef } from "react";
import { motion, useInView } from "motion/react";

interface GradualBlurProps {
  children?: React.ReactNode;
  text?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
  className?: string;
}

export function GradualBlur({
  children,
  text,
  delay = 0.1,
  duration = 0.8,
  stagger = 0.08,
  className = "",
}: GradualBlurProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-20px" });

  if (text) {
    const words = text.split(" ");
    return (
      <div ref={containerRef} className={`flex flex-wrap gap-x-2 ${className}`}>
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ filter: "blur(12px)", opacity: 0, y: 5 }}
            animate={isInView ? { filter: "blur(0px)", opacity: 1, y: 0 } : {}}
            transition={{
              duration: duration,
              delay: delay + i * stagger,
              ease: "easeOut",
            }}
            className="inline-block"
          >
            {word}
          </motion.span>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ filter: "blur(12px)", opacity: 0 }}
      animate={isInView ? { filter: "blur(0px)", opacity: 1 } : {}}
      transition={{
        duration: duration,
        delay: delay,
        ease: "easeOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
