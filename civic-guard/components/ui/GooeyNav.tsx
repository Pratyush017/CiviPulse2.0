"use client";

import React, { useState } from "react";
import { motion } from "motion/react";

interface GooeyNavTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface GooeyNavProps {
  tabs: GooeyNavTab[];
  activeId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function GooeyNav({
  tabs,
  activeId,
  onChange,
  className = "",
}: GooeyNavProps) {
  const [localActive, setLocalActive] = useState(activeId || tabs[0]?.id);
  const currentActive = activeId !== undefined ? activeId : localActive;

  const handleSelect = (id: string) => {
    setLocalActive(id);
    if (onChange) {
      onChange(id);
    }
  };

  return (
    <div className={`relative flex items-center justify-center bg-slate-950 p-2 rounded-2xl border border-slate-900 shadow-xl ${className}`}>
      {/* Liquid Gooey SVG Filter */}
      <svg className="absolute w-0 h-0 pointer-events-none" xmlns="http://www.w3.org/2000/svg" version="1.1">
        <defs>
          <filter id="gooey-nav-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Main Bar with filter applied */}
      <div className="relative flex items-center gap-6" style={{ filter: "url(#gooey-nav-filter)" }}>
        {tabs.map((tab) => {
          const isActive = currentActive === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              className="relative p-3 rounded-full text-slate-400 hover:text-slate-200 cursor-pointer outline-none transition-colors duration-200 z-10"
            >
              {/* Slidable background liquid blob */}
              {isActive && (
                <motion.div
                  layoutId="gooeyBlob"
                  className="absolute inset-0 bg-violet-600 rounded-full -z-10 shadow-lg shadow-violet-500/20"
                  transition={{
                    type: "spring",
                    stiffness: 140,
                    damping: 18,
                  }}
                />
              )}
              
              <div className={`relative flex items-center justify-center transition-transform duration-200 ${isActive ? "scale-110 text-white" : ""}`}>
                {tab.icon ? tab.icon : <span className="text-xs font-mono">{tab.label}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
