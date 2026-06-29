"use client";

import React from "react";
import { motion, HTMLMotionProps } from "motion/react";

type AnimationVariant = "fade" | "slideUp" | "slideDown" | "scale" | "rotate";

interface AnimatedItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  variant?: AnimationVariant;
  delay?: number;
  duration?: number;
  whileHoverScale?: number;
  whileTapScale?: number;
  triggerOnce?: boolean;
}

export function AnimatedItem({
  children,
  variant = "fade",
  delay = 0,
  duration = 0.4,
  whileHoverScale,
  whileTapScale,
  triggerOnce = true,
  className = "",
  ...props
}: AnimatedItemProps) {
  const getVariants = () => {
    switch (variant) {
      case "slideUp":
        return {
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0 },
        };
      case "slideDown":
        return {
          hidden: { opacity: 0, y: -20 },
          visible: { opacity: 1, y: 0 },
        };
      case "scale":
        return {
          hidden: { opacity: 0, scale: 0.95 },
          visible: { opacity: 1, scale: 1 },
        };
      case "rotate":
        return {
          hidden: { opacity: 0, rotate: -5 },
          visible: { opacity: 1, rotate: 0 },
        };
      case "fade":
      default:
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: triggerOnce, margin: "-20px" }}
      variants={getVariants()}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1], // Custom elegant ease-out cubic
      }}
      whileHover={whileHoverScale ? { scale: whileHoverScale } : undefined}
      whileTap={whileTapScale ? { scale: whileTapScale } : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
