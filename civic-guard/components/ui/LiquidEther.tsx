"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export interface LiquidEtherProps {
  colors?: string[];
  mouseForce?: number;
  cursorSize?: number;
  isViscous?: boolean;
  viscous?: number;
  iterationsViscous?: number;
  iterationsPoisson?: number;
  resolution?: number;
  isBounce?: boolean;
  autoDemo?: boolean;
  autoSpeed?: number;
  autoIntensity?: number;
  takeoverDuration?: number;
  autoResumeDelay?: number;
  autoRampDuration?: number;
  color0?: string;
  color1?: string;
  color2?: string;
  className?: string;
  style?: React.CSSProperties;
}

function hexToVec3(hex: string): THREE.Vector3 {
  const cleanHex = hex.replace("#", "");
  const num = parseInt(cleanHex, 16);
  return new THREE.Vector3(
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255
  );
}

export const LiquidEther: React.FC<LiquidEtherProps> = ({
  colors = ["#5227FF", "#FF9FFC", "#B497CF"],
  mouseForce = 20,
  cursorSize = 100,
  isViscous = true,
  viscous = 30,
  iterationsViscous = 32,
  iterationsPoisson = 32,
  resolution = 0.5,
  isBounce = false,
  autoDemo = true,
  autoSpeed = 0.5,
  autoIntensity = 2.2,
  takeoverDuration = 0.25,
  autoResumeDelay = 3000,
  autoRampDuration = 0.6,
  color0,
  color1,
  color2,
  className = "",
  style = {},
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const c0 = hexToVec3(color0 || colors[0] || "#5227FF");
    const c1 = hexToVec3(color1 || colors[1] || "#FF9FFC");
    const c2 = hexToVec3(color2 || colors[2] || "#B497CF");

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(width, height) },
      iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
      uColor0: { value: c0 },
      uColor1: { value: c1 },
      uColor2: { value: c2 },
      uAutoIntensity: { value: autoIntensity },
      uAutoSpeed: { value: autoSpeed },
      uMouseForce: { value: mouseForce },
      uViscous: { value: viscous },
      uCursorSize: { value: cursorSize },
    };

    const fragmentShader = `
      precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec4 iMouse;
      uniform vec3 uColor0;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uAutoIntensity;
      uniform float uAutoSpeed;
      uniform float uMouseForce;
      uniform float uViscous;
      uniform float uCursorSize;

      // Simplex-style 2D curl noise
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      vec2 curl(vec2 p) {
        float eps = 0.01;
        float n1 = snoise(p + vec2(0.0, eps));
        float n2 = snoise(p - vec2(0.0, eps));
        float n3 = snoise(p + vec2(eps, 0.0));
        float n4 = snoise(p - vec2(eps, 0.0));
        return vec2((n1 - n2)/(2.0*eps), -(n3 - n4)/(2.0*eps));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        vec2 p = (gl_FragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);

        float t = iTime * uAutoSpeed * 0.4;

        // Auto demo vortex path
        vec2 autoPos = vec2(sin(t * 1.5) * 0.45, cos(t * 1.1) * 0.35);
        float dAuto = length(p - autoPos);
        vec2 autoVort = curl(p * 2.5 + t * 0.3) * exp(-dAuto * 3.5) * uAutoIntensity;

        // Interactive mouse impulse
        vec2 mouseP = (iMouse.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
        float dMouse = length(p - mouseP);
        float mouseActive = step(1.0, iMouse.z);
        float mouseRadius = max(0.01, uCursorSize / min(iResolution.x, iResolution.y));
        vec2 mouseVort = curl(p * 3.0) * exp(-dMouse / mouseRadius) * (uMouseForce * 0.1) * mouseActive;

        // Multilayer liquid ether fluid advection
        vec2 flow = autoVort + mouseVort;
        vec2 q = p + flow * 0.2;
        
        float f1 = snoise(q * 2.2 + vec2(t * 0.5, -t * 0.3));
        float f2 = snoise(q * 3.8 - vec2(t * 0.4, t * 0.6) + f1 * 0.5);
        float f3 = snoise(q * 5.0 + vec2(f2 * 0.6, f1 * 0.4));

        float fluidPattern = (f1 + f2 * 0.6 + f3 * 0.3) / 1.9;
        fluidPattern = clamp(fluidPattern * 0.5 + 0.5, 0.0, 1.0);

        // Color blending
        vec3 col = mix(uColor0, uColor1, smoothstep(0.1, 0.6, fluidPattern));
        col = mix(col, uColor2, smoothstep(0.5, 0.95, fluidPattern));

        // Liquid specular edge sheen
        float edge = length(flow) * 1.5;
        col += vec3(edge * 0.4);

        // Soft vignette to seamlessly blend into dark backdrop
        float vignette = 1.0 - smoothstep(0.4, 0.85, length(p));
        float alpha = clamp((fluidPattern * 0.85 + edge * 0.3) * vignette, 0.0, 1.0);

        gl_FragColor = vec4(col, alpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader,
      uniforms,
      transparent: true,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let mouse = new THREE.Vector4(0, 0, 0, 0);
    let lastMouseMove = 0;
    let isMouseActive = false;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = rect.height - (e.clientY - rect.top);
      mouse.set(x, y, 1.0, 0.0);
      lastMouseMove = performance.now();
      isMouseActive = true;
    };

    const handlePointerLeave = () => {
      mouse.z = 0;
      isMouseActive = false;
    };

    canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerdown", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    let raf = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      uniforms.iTime.value = elapsed;

      // Handle auto-resume delay
      if (isMouseActive && performance.now() - lastMouseMove > autoResumeDelay) {
        mouse.z = THREE.MathUtils.lerp(mouse.z, 0, 0.05);
      }
      uniforms.iMouse.value.copy(mouse);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 800;
      height = container.clientHeight || 600;
      renderer.setSize(width, height);
      uniforms.iResolution.value.set(width, height);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, [
    colors,
    color0,
    color1,
    color2,
    autoIntensity,
    autoSpeed,
    mouseForce,
    viscous,
    cursorSize,
    autoResumeDelay,
  ]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full overflow-hidden pointer-events-auto ${className}`}
      style={style}
    />
  );
};

export default LiquidEther;
