"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Folder as FolderIcon, FolderOpen, ChevronRight, ChevronDown, FileText } from "lucide-react";

interface FolderItem {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: FolderItem[];
  content?: string;
}

interface FolderProps {
  items?: FolderItem[];
  title?: string;
  className?: string;
  onFileSelect?: (item: FolderItem) => void;
}

export function Folder({
  items = [],
  title = "Explorer",
  className = "",
  onFileSelect,
}: FolderProps) {
  return (
    <div className={`flex flex-col bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl ${className}`}>
      {/* Folder Header / Tab */}
      <div className="flex items-center gap-2 bg-slate-950/60 px-4 py-3 border-b border-slate-800/80">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <span className="text-xs font-mono text-slate-400 ml-4">{title}</span>
      </div>

      {/* Explorer Content */}
      <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
        {items.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 italic p-2">Empty folder</div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <FolderNode key={item.id} item={item} onFileSelect={onFileSelect} depth={0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface FolderNodeProps {
  item: FolderItem;
  onFileSelect?: (item: FolderItem) => void;
  depth: number;
}

function FolderNode({ item, onFileSelect, depth }: FolderNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isFolder = item.type === "folder";

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    } else if (onFileSelect) {
      onFileSelect(item);
    }
  };

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12}px` }}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-150 text-sm font-mono ${
          isFolder
            ? "hover:bg-slate-800/40 text-slate-200"
            : "hover:bg-indigo-950/30 text-indigo-200 hover:text-indigo-100"
        }`}
      >
        {isFolder && (
          <span className="text-slate-500">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        )}

        {isFolder ? (
          isOpen ? (
            <FolderOpen className="w-4 h-4 text-amber-400 fill-amber-400/10" />
          ) : (
            <FolderIcon className="w-4 h-4 text-amber-500 fill-amber-500/10" />
          )
        ) : (
          <FileText className="w-4 h-4 text-indigo-400" />
        )}

        <span className="truncate">{item.name}</span>
      </div>

      <AnimatePresence initial={false}>
        {isFolder && isOpen && item.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 border-l border-slate-800/60 ml-3.5 pl-1.5">
              {item.children.map((child) => (
                <FolderNode key={child.id} item={child} onFileSelect={onFileSelect} depth={depth + 1} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
