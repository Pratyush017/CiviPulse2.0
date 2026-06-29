"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useInView, Variants } from "motion/react";

interface BlurTextProps {
  text: string;
  delay?: number;
  speed?: number;
  direction?: "top" | "bottom" | "none";
  blurAmount?: string; // e.g. "10px"
  animateBy?: "words" | "chars";
  className?: string;
  onComplete?: () => void;
}

export function BlurText({
  text,
  delay = 0,
  speed = 0.05,
  direction = "bottom",
  blurAmount = "8px",
  animateBy = "chars",
  className = "",
  onComplete,
}: BlurTextProps) {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-10px" });
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => {
        setShouldAnimate(true);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [isInView, delay]);

  const yOffset = direction === "top" ? -15 : direction === "bottom" ? 15 : 0;

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: speed,
        onComplete: onComplete,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: {
      filter: `blur(${blurAmount})`,
      opacity: 0,
      y: yOffset,
    },
    visible: {
      filter: "blur(0px)",
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 120,
      },
    },
  };

  return (
    <motion.div
      ref={containerRef}
      initial="hidden"
      animate={shouldAnimate ? "visible" : "hidden"}
      variants={containerVariants}
      className={`inline-flex flex-wrap ${className}`}
    >
      {elements.map((el, i) => (
        <motion.span
          key={i}
          variants={itemVariants}
          style={{ display: "inline-block", whiteSpace: "pre" }}
          className={animateBy === "words" ? "mr-2" : ""}
        >
          {el === " " && animateBy === "chars" ? "\u00A0" : el}
        </motion.span>
      ))}
    </motion.div>
  );
}
