"use client";

import React, { useId } from "react";

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
  style?: React.CSSProperties;
  displace?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  mixBlendMode?: string;
  backgroundColor?: string;
  borderColor?: string;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  width,
  height,
  borderRadius = 24,
  className = "",
  style = {},
  displace = 0.5,
  distortionScale = -180,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  brightness = 50,
  opacity = 0.85,
  blur = 20,
  mixBlendMode = "normal",
  backgroundColor = "rgba(10, 10, 10, 0.65)",
  borderColor = "rgba(255, 255, 255, 0.12)",
}) => {
  const filterId = useId().replace(/:/g, "_");

  const radiusValue = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;
  const widthValue = typeof width === "number" ? `${width}px` : width;
  const heightValue = typeof height === "number" ? `${height}px` : height;

  const scaleValue = (distortionScale * displace) / 10;
  const baseFreq = 0.015 + displace * 0.02;

  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      style={{
        width: widthValue,
        height: heightValue,
        borderRadius: radiusValue,
        ...style,
      }}
    >
      {/* SVG Chromatic Glass Displacement Filter */}
      <svg className="absolute w-0 h-0 pointer-events-none -z-10" aria-hidden="true">
        <defs>
          <filter id={`glass-filter-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${baseFreq} ${baseFreq * 1.5}`}
              numOctaves="2"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={scaleValue}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix
              in="displaced"
              type="matrix"
              values={`
                1 0 0 0 ${redOffset / 100}
                0 1 0 0 ${greenOffset / 100}
                0 0 1 0 ${blueOffset / 100}
                0 0 0 1 0
              `}
              result="chromatic"
            />
            <feComponentTransfer in="chromatic" result="bright">
              <feFuncR type="linear" slope={1 + brightness / 200} />
              <feFuncG type="linear" slope={1 + brightness / 200} />
              <feFuncB type="linear" slope={1 + brightness / 200} />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="bright" mode="normal" />
          </filter>
        </defs>
      </svg>

      {/* Glass Backdrop Layer */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none transition-all duration-300"
        style={{
          borderRadius: radiusValue,
          backgroundColor,
          backdropFilter: `blur(${blur}px) saturate(160%)`,
          WebkitBackdropFilter: `blur(${blur}px) saturate(160%)`,
          opacity,
          border: `1px solid ${borderColor}`,
          boxShadow: `
            inset 0 1px 1px 0 rgba(255, 255, 255, 0.15),
            inset 0 -1px 1px 0 rgba(0, 0, 0, 0.4),
            0 8px 32px 0 rgba(0, 0, 0, 0.37)
          `,
          mixBlendMode: mixBlendMode as any,
        }}
      />

      {/* Specular Highlight Sheen */}
      <div
        className="absolute inset-x-0 top-0 h-[1px] -z-10 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
        }}
      />

      {/* Children Content */}
      <div className="relative z-10 w-full h-full flex items-center justify-between">
        {children}
      </div>
    </div>
  );
};

export default GlassSurface;
