"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface BubbleMenuProps {
  items: MenuItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function BubbleMenu({
  items,
  activeId,
  onChange,
  className = "",
}: BubbleMenuProps) {
  const [localActive, setLocalActive] = useState(activeId || items[0]?.id);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const currentActive = activeId !== undefined ? activeId : localActive;

  const handleSelect = (id: string) => {
    setLocalActive(id);
    if (onChange) {
      onChange(id);
    }
  };

  return (
    <nav
      className={`relative flex items-center gap-1 bg-slate-900/60 p-1.5 rounded-full border border-slate-800/80 backdrop-blur-md ${className}`}
      onMouseLeave={() => setHoveredId(null)}
    >
      {items.map((item) => {
        const isActive = currentActive === item.id;
        const isHovered = hoveredId === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleSelect(item.id)}
            onMouseEnter={() => setHoveredId(item.id)}
            className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer outline-none z-10 ${
              isActive
                ? "text-slate-100"
                : isHovered
                ? "text-slate-300"
                : "text-slate-400"
            }`}
          >
            {/* Hover Bubble background */}
            <AnimatePresence>
              {isHovered && !isActive && (
                <motion.span
                  layoutId="hoverBubble"
                  className="absolute inset-0 bg-slate-800/40 rounded-full -z-10"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </AnimatePresence>

            {/* Active Bubble background */}
            {isActive && (
              <motion.span
                layoutId="activeBubble"
                className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full -z-10 shadow-lg shadow-indigo-500/25"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}

            {item.icon && <span className="relative">{item.icon}</span>}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
