"use client";

import React, { useEffect, useState, useRef } from "react";

interface DecryptedTextProps {
  text: string;
  speed?: number; // interval between letter changes in ms
  scrambleChars?: string;
  triggerOn?: "view" | "hover" | "always";
  className?: string;
}

export function DecryptedText({
  text,
  speed = 40,
  scrambleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+",
  triggerOn = "view",
  className = "",
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isInView = false;
    let observer: IntersectionObserver | null = null;

    const startAnimation = () => {
      let iteration = 0;
      if (animationRef.current) clearInterval(animationRef.current);

      animationRef.current = setInterval(() => {
        const scrambled = text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration) {
              return text[index];
            }
            return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
          })
          .join("");

        setDisplayText(scrambled);

        if (iteration >= text.length) {
          if (animationRef.current) clearInterval(animationRef.current);
        }

        iteration += 1 / 3;
      }, speed);
    };

    if (triggerOn === "view") {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isInView) {
              isInView = true;
              startAnimation();
            }
          });
        },
        { threshold: 0.1 }
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }
    } else if (triggerOn === "always") {
      startAnimation();
    } else if (triggerOn === "hover" && isHovered) {
      startAnimation();
    }

    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
      if (observer) observer.disconnect();
    };
  }, [text, speed, scrambleChars, triggerOn, isHovered]);

  return (
    <span
      ref={containerRef}
      onMouseEnter={() => triggerOn === "hover" && setIsHovered(true)}
      onMouseLeave={() => triggerOn === "hover" && setIsHovered(false)}
      className={`font-mono inline-block ${className}`}
    >
      {displayText}
    </span>
  );
}
