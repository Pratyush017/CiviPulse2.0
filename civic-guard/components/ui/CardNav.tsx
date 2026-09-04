import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Flame, PlaneTakeoff, Clock, Layers, Moon, Zap, Globe } from 'lucide-react';

interface LinkItem {
  label: string;
  ariaLabel?: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface NavItem {
  label: string;
  bgColor: string;
  textColor: string;
  links: LinkItem[];
}

interface CardNavProps {
  logo?: string;
  logoAlt?: string;
  items: NavItem[];
  baseColor?: string;
  menuColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  ease?: string;
  theme?: string;
}

export default function CardNav({
  items,
  buttonBgColor = "#111",
  buttonTextColor = "#fff",
}: CardNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Helper to render cool icons based on labels
  const renderIcon = (label: string, isActive?: boolean) => {
    const className = `w-4 h-4 ${isActive ? 'animate-pulse' : ''}`;
    if (label.includes('Heatmap')) return <Flame className={className} />;
    if (label.includes('Tour')) return <PlaneTakeoff className={className} />;
    if (label.includes('Time-Lapse')) return <Clock className={className} />;
    if (label.includes('Dark')) return <Moon className={className} />;
    if (label.includes('Cyberpunk')) return <Zap className={className} />;
    if (label.includes('Satellite')) return <Globe className={className} />;
    return <Layers className={className} />;
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-transform hover:scale-105 z-[500] relative border-2 border-white/10 backdrop-blur-xl"
        style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
      >
        <Map className="w-6 h-6" />
        
        {/* If any item is active, show a little green indicator dot on the main FAB */}
        {items.some(item => item.links.some(l => l.isActive)) && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute bottom-20 right-0 md:bottom-auto md:top-20 md:right-0 w-64 rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-800 z-[400]"
          >
            {items.map((item, i) => (
              <div key={i} style={{ backgroundColor: item.bgColor, color: item.textColor }} className="p-4 border-b border-white/5 last:border-0">
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-50 px-2">{item.label}</h3>
                <div className="flex flex-col gap-1">
                  {item.links.map((link, j) => (
                    <button
                      key={j}
                      onClick={(e) => {
                         if (link.onClick) link.onClick();
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        link.isActive 
                          ? 'bg-emerald-500/20 text-emerald-400 shadow-[inset_0_0_12px_rgba(16,185,129,0.2)]' 
                          : 'hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      {renderIcon(link.label, link.isActive)}
                      {link.label}
                      
                      {/* Status dot indicator */}
                      <span className="ml-auto flex h-2 w-2 relative">
                        {link.isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${link.isActive ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
