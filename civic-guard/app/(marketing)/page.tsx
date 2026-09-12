"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ShieldCheck,
  Camera,
  WifiOff,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Zap,
  Award,
  Compass,
  HeartHandshake,
  BarChart3,
  ChevronDown,
  Globe,
  Radio,
  MapPin,
  Clock,
  Check,
} from "lucide-react";

import LaserFlow from "@/components/ui/LaserFlow";
import BorderGlow from "@/components/ui/BorderGlow";
import BlurText from "@/components/ui/BlurText";
import RotatingText from "@/components/ui/RotatingText";
import StarBorder from "@/components/ui/StarBorder";
import GradualBlur from "@/components/ui/GradualBlur";


if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ---------------------------------------------------------------------------
// Human-Centric Feature Data (Calm, Comforting & Clear)
// ---------------------------------------------------------------------------
interface BenefitItem {
  id: string;
  step: string;
  tag: string;
  badgeColor: string;
  starColor: string;
  glowColor: string;
  title: string;
  summary: string;
  icon: React.ElementType;
  keyBenefits: string[];
  visualType: "camera" | "verification" | "offline" | "map" | "rewards";
}

const BENEFITS: BenefitItem[] = [
  {
    id: "easy-reporting",
    step: "01",
    tag: "Instant Triage",
    badgeColor: "bg-teal-500/10 text-teal-300 border-teal-500/20",
    starColor: "#2dd4bf",
    glowColor: "173 80 50",
    title: "Snap & Report in 2 Seconds",
    summary:
      "No long municipal complaint forms. Simply take a photo on your phone, and our intelligent system automatically categorizes the issue and tags the exact GPS coordinates.",
    icon: Camera,
    keyBenefits: [
      "Instant recognition of potholes, waterlogging, debris & hazards",
      "Automatic severity assessment so urgent issues get prioritized",
      "Works directly from your mobile browser — no app download required",
    ],
    visualType: "camera",
  },
  {
    id: "verified-fixes",
    step: "02",
    tag: "Anti-Spoofing",
    badgeColor: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    starColor: "#f43f5e",
    glowColor: "350 89 60",
    title: "Verified Community Fixes",
    summary:
      "Keep civic progress genuine. Community members and workers verify repairs on-site, while smart computer vision cross-checks background landmarks to confirm real physical fixes.",
    icon: ShieldCheck,
    keyBenefits: [
      "On-site proximity check ensures real physical presence",
      "Smart landmark matching confirms the exact repair location",
      "Eliminates duplicate photos and false resolution claims",
    ],
    visualType: "verification",
  },
  {
    id: "offline-ready",
    step: "03",
    tag: "Offline Sync",
    badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    starColor: "#f59e0b",
    glowColor: "43 96 56",
    title: "Always Ready, Even Offline",
    summary:
      "Potholes and flooding often happen in remote areas, tunnels, or bad cellular reception. CivicPulse stores reports on your device and uploads them silently when you're back online.",
    icon: WifiOff,
    keyBenefits: [
      "Zero data loss in cellular dead zones or underground roads",
      "Photos and GPS coordinates are preserved safely on your phone",
      "Seamless automatic sync as soon as internet reconnects",
    ],
    visualType: "offline",
  },
  {
    id: "neighborhood-map",
    step: "04",
    tag: "Live Radar",
    badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    starColor: "#06b6d4",
    glowColor: "190 90 50",
    title: "Live Neighborhood Radar",
    summary:
      "Explore real-time hazard clusters across your city. Switch between dark mode and satellite views, or play time-lapse history to watch your streets get safer over time.",
    icon: Compass,
    keyBenefits: [
      "Interactive map with clean severity-colored pins",
      "Thermal heatmaps highlight areas needing city attention",
      "Historical time-lapse slider tracks community improvement",
    ],
    visualType: "map",
  },
  {
    id: "civic-rewards",
    step: "05",
    tag: "Citizen Rewards",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    starColor: "#10b981",
    glowColor: "140 70 45",
    title: "Earn Points for Caring for Your City",
    summary:
      "Get recognized for keeping your neighborhood clean and safe. Earn Civic Points every time you report an issue or verify a completed repair.",
    icon: Award,
    keyBenefits: [
      "+10 points for every authentic community report",
      "+50 points for every verified physical repair",
      "Climb community leaderboards and celebrate local heroes",
    ],
    visualType: "rewards",
  },
];

const NAV_ITEMS = [
  { label: "Overview", href: "#hero" },
  { label: "How It Works", href: "#features" },
  { label: "Community Impact", href: "#impact" },
  { label: "Live Radar", href: "/dashboard", isSpecial: true },
];

export default function MarketingPage() {
  const pinContainerRef = useRef<HTMLDivElement>(null);
  const pinSectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeNavIndex, setActiveNavIndex] = useState(0);

  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleLaunchDashboard = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsTransitioning(true);
    
    // Zoom-out transition effect on the landing page wrapper
    const landingRoot = document.getElementById("landing-root");
    if (landingRoot) {
      landingRoot.style.transition = "transform 0.8s cubic-bezier(0.76, 0, 0.24, 1), opacity 0.8s cubic-bezier(0.76, 0, 0.24, 1), filter 0.8s ease";
      landingRoot.style.transform = "scale(0.85)";
      landingRoot.style.opacity = "0";
      landingRoot.style.filter = "blur(12px)";
    }

    // Wait for zoom out before routing
    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  };

  // ---------------------------------------------------------------------------
  // Smooth, Lightweight GSAP Pinning
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const ctx = gsap.context(() => {
      if (!prefersReducedMotion) {
        // Hero Parallax
        gsap.to(".hero-bg", {
          yPercent: 30,
          ease: "none",
          scrollTrigger: {
            trigger: "#hero",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        // --- INTRO SEQUENCE: Pin #hero, lift curtain, fade in content ---
        gsap.set("#hero-content", { opacity: 0, scale: 0.96 });
        gsap.set(".site-header", { opacity: 0, y: -20 });
        gsap.set("#floating-logo", { top: "50%", left: "50%", xPercent: -50, yPercent: -50, scale: 1 });

        const introTl = gsap.timeline({
          scrollTrigger: {
            trigger: "#hero",
            start: "top top",
            end: "+=800",
            scrub: true,
            pin: true,
            pinSpacing: true,
            invalidateOnRefresh: true,
          }
        });

        // 0-60%: Curtain lifts up
        introTl.to("#intro-curtain", {
          yPercent: -100,
          opacity: 0,
          ease: "power2.inOut",
        }, 0);

        // 15-80%: Hero content fades in (slightly delayed behind curtain)
        introTl.to("#hero-content", {
          opacity: 1,
          scale: 1,
          ease: "power2.out",
        }, 0.15);

        // 30-80%: Header slides in
        introTl.to(".site-header", {
          opacity: 1,
          y: 0,
          ease: "power2.out",
        }, 0.3);

        // 0-100%: Logo shrinks into header corner
        introTl.to("#floating-logo", {
          top: () => {
            const target = document.querySelector("#header-brand-target");
            return target ? target.getBoundingClientRect().top + 2 : 18;
          },
          left: () => {
            const target = document.querySelector("#header-brand-target");
            return target ? target.getBoundingClientRect().left : 16;
          },
          xPercent: 0,
          yPercent: 0,
          scale: 0.333,
          ease: "power2.inOut",
        }, 0);



        // CTA Card Pop
        gsap.fromTo(
          ".cta-card",
          { opacity: 0, scale: 0.9, y: 60, filter: "blur(10px)" },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 1.5,
            ease: "expo.out",
            scrollTrigger: {
              trigger: ".cta-section",
              start: "top 80%",
            },
          }
        );
      }

      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        if (!pinContainerRef.current || !pinSectionRef.current) return;

        const totalCards = BENEFITS.length;
        const cardElements = cardsRef.current.filter(Boolean) as HTMLDivElement[];
        if (cardElements.length === 0) return;

        cardElements.forEach((card, idx) => {
          if (idx === 0) {
            gsap.set(card, { autoAlpha: 1, yPercent: 0, scale: 1, filter: "blur(0px)", transformOrigin: "top center" });
          } else {
            gsap.set(card, {
              autoAlpha: 0,
              yPercent: prefersReducedMotion ? 0 : 50,
              scale: 0.9,
              filter: "blur(10px)",
              transformOrigin: "top center"
            });
          }
        });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pinContainerRef.current,
            start: "top top",
            end: `+=${totalCards * 200}%`,
            pin: pinSectionRef.current,
            pinSpacing: true,
            scrub: 1.5,
            anticipatePin: 1,
            onUpdate: (self) => {
              const idx = Math.min(
                totalCards - 1,
                Math.max(0, Math.floor(self.progress * totalCards))
              );
              setActiveStepIndex(idx);
            },
          },
        });

        // ═══════════════════════ IMPACT HORIZONTAL SCROLL (DESKTOP) ═══════════════════════
        const impactSection = document.querySelector("#impact");
        const impactContainer = document.querySelector("#impact-cards-container");
        
        if (impactSection && impactContainer) {
          gsap.to(impactContainer, {
            x: () => -(impactContainer.scrollWidth - window.innerWidth + window.innerWidth * 0.15),
            ease: "none",
            scrollTrigger: {
              trigger: impactSection,
              start: "center center", // Perfectly center the section vertically on the screen before pinning
              end: () => `+=${impactContainer.scrollWidth}`,
              pin: true,
              scrub: 1,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            }
          });
        }

        for (let i = 0; i < totalCards - 1; i++) {
          const current = cardElements[i];
          const next = cardElements[i + 1];

          tl.to(
            current,
            {
              autoAlpha: 0,
              yPercent: prefersReducedMotion ? 0 : -20,
              scale: 0.9,
              filter: "blur(10px)",
              duration: 1,
              ease: "power3.inOut",
            },
            `step-${i}`
          );

          tl.to(
            next,
            {
              autoAlpha: 1,
              yPercent: 0,
              scale: 1,
              filter: "blur(0px)",
              duration: 1,
              ease: "power3.inOut",
            },
            `step-${i}`
          );
        }
      });

      mm.add("(max-width: 767px)", () => {
        const cardElements = cardsRef.current.filter(Boolean) as HTMLDivElement[];
        gsap.set(cardElements, { clearProps: "all", visibility: "visible", opacity: 1 });
      });
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div id="landing-root" className="min-h-screen bg-[#050505] text-slate-100 font-sans selection:bg-teal-500/30 selection:text-teal-200 overflow-x-hidden">
      {/* ═══════════════════════ HEADER ═══════════════════════ */}
      <header className="site-header fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-black/85 backdrop-blur-xl transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo Placeholder (preserves space for floating logo) */}
          <div id="header-brand-target" className="flex items-center w-[140px] opacity-0 pointer-events-none">
            <span className="font-display font-bold text-xl">CivicPulse</span>
          </div>

          {/* Calming Pill Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-[#111111] border border-white/[0.08] rounded-full p-1 shadow-md">
            {NAV_ITEMS.map((item, idx) => {
              const isActive = activeNavIndex === idx;

              return item.href.startsWith("/") ? (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setActiveNavIndex(idx)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200"
                >
                  <Radio className="size-3 text-teal-400 animate-pulse" />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setActiveNavIndex(idx)}
                  className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors ${
                    isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="calm-nav-pill"
                      className="absolute inset-0 bg-white/10 rounded-full border border-white/10"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Launch Dashboard CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              onClick={handleLaunchDashboard}
              className="bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(45,212,191,0.15)]"
            >
              <span>Launch Radar</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════════════════ 1. HERO SECTION ═══════════════════════ */}
      <section
        id="hero"
        className="relative min-h-[85vh] sm:min-h-[92vh] pt-28 pb-16 sm:pt-36 sm:pb-24 flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Soft, Soothing Ambient Glow Background */}
        <div className="hero-bg absolute inset-0 z-0 pointer-events-none opacity-40">
          <LaserFlow
            color="#a78bfa"
            horizontalBeamOffset={0}
            verticalBeamOffset={-0.4}
            horizontalSizing={1.5}
            verticalSizing={3.2}
            wispDensity={1.2}
            wispSpeed={18}
            wispIntensity={14}
            flowSpeed={0.25}
            flowStrength={0.5}
            fogIntensity={0.8}
            fogScale={0.1}
            decay={3}
          />
        </div>

        {/* Hero Content */}
        <div id="hero-content" className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center">
          {/* Calming Welcome Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs sm:text-sm font-medium"
          >
            <span className="size-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Community-Powered Civic Care</span>
          </motion.div>

          {/* Friendly Headline */}
          <h1 className="font-display font-bold text-3xl sm:text-5xl md:text-6xl text-white tracking-tight leading-[1.15] max-w-3xl">
            <BlurText
              text="Fix Neighborhood Issues"
              delay={100}
              animateBy="words"
              direction="top"
              className="text-white block sm:inline"
            />{" "}
            <span className="inline-block align-middle my-1 sm:my-0">
              <RotatingText
                texts={["Faster", "Together", "Easily", "Transparently"]}
                mainClassName="bg-cyan-400 text-black px-3.5 sm:px-4 py-0.5 rounded-xl inline-flex items-center justify-center font-bold"
                staggerFrom="last"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-120%" }}
                staggerDuration={0.02}
                splitLevelClassName="overflow-hidden"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
                rotationInterval={3200}
              />
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="mt-5 sm:mt-6 text-sm sm:text-base md:text-lg text-slate-400 max-w-xl leading-relaxed"
          >
            Report potholes, trash, and hazards in seconds. AI organizes and verifies community repairs so your city can fix them faster.
          </motion.p>

          {/* Calming Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
            className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto"
          >
            <Link
              href="/dashboard"
              onClick={handleLaunchDashboard}
              className="w-full sm:w-auto bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold px-7 py-3.5 rounded-full text-sm sm:text-base flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(45,212,191,0.25)] cursor-pointer"
            >
              <span>Explore Live Map</span>
              <ArrowRight className="size-4" />
            </Link>

            <a
              href="#features"
              className="w-full sm:w-auto px-5 py-3.5 rounded-full bg-[#111111] hover:bg-[#1a1a1a] border border-white/10 text-slate-300 hover:text-white text-sm sm:text-base font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <span>How It Works</span>
              <ChevronDown className="size-4 text-slate-400" />
            </a>
          </motion.div>

          {/* Key Quick Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
            className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl"
          >
            {[
              { label: "Fast Capture", value: "2 Seconds", sub: "Photo & GPS", icon: Zap, color: "text-teal-400" },
              { label: "Verification", value: "Anti-Fraud", sub: "Landmark Check", icon: ShieldCheck, color: "text-rose-400" },
              { label: "Connection", value: "Offline Ready", sub: "Auto Sync", icon: WifiOff, color: "text-amber-400" },
              { label: "Rewards", value: "Civic Points", sub: "Community Pride", icon: Award, color: "text-emerald-400" },
            ].map((stat, idx) => {
              const IconComp = stat.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#0a0a0a]/90 border border-slate-800/80 rounded-2xl p-3.5 text-center shadow-sm"
                >
                  <div className="flex justify-center mb-1.5">
                    <IconComp className={`size-4 ${stat.color}`} />
                  </div>
                  <p className="font-display font-bold text-base sm:text-lg text-white">
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              );
            })}
          </motion.div>
        </div>

        <GradualBlur preset="bottom" height="4rem" zIndex={20} className="pointer-events-none" />
      </section>

      {/* ═══════════════════════ 2. HOW IT WORKS (CLEAN PINNED SEQUENCE) ═══════════════════════ */}
      <section
        id="features"
        ref={pinContainerRef}
        className="relative bg-black w-full"
      >
        <div
          ref={pinSectionRef}
          className="relative min-h-screen w-full flex flex-col justify-center px-4 sm:px-6 lg:px-8 pt-20 pb-16 md:pt-24 md:pb-12 overflow-hidden"
        >
          {/* Section Heading */}
          <div className="max-w-4xl mx-auto w-full mb-8 flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-widest mb-1">
                <Sparkles className="size-3.5" />
                <span>Simple & Transparent Workflow</span>
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
                How CivicPulse Works
              </h2>
            </div>

            {/* Step Indicator */}
            <div className="hidden md:flex items-center gap-2">
              {BENEFITS.map((b, i) => (
                <div
                  key={b.id}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                    activeStepIndex === i
                      ? "bg-teal-500/20 text-teal-300 border border-teal-400/40"
                      : "bg-white/5 text-slate-500 border border-white/5"
                  }`}
                >
                  Step {b.step}
                </div>
              ))}
            </div>
          </div>

          {/* Benefit Cards Container */}
          <div className="relative max-w-4xl mx-auto w-full min-h-[400px] flex items-center justify-center">
            {BENEFITS.map((benefit, index) => {
              const IconComponent = benefit.icon;

              return (
                <div
                  key={benefit.id}
                  ref={(el) => {
                    cardsRef.current[index] = el;
                  }}
                  className={`w-full ${
                    index === 0 ? "relative" : "md:absolute md:inset-0"
                  } mb-6 md:mb-0`}
                  style={{ willChange: "transform, opacity" }}
                >
                  <div className="bg-[#0a0a0a] border border-slate-800/90 rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl relative overflow-hidden">
                    {/* Subtle Ambient Background Light */}
                    <div
                      className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
                      style={{ backgroundColor: benefit.starColor }}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
                      {/* Left: Narrative & Key Benefits */}
                      <div className="md:col-span-7 flex flex-col gap-4 text-left">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${benefit.badgeColor}`}>
                            Step {benefit.step} · {benefit.tag}
                          </span>
                        </div>

                        <h3 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
                          {benefit.title}
                        </h3>

                        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                          {benefit.summary}
                        </p>

                        <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
                          {benefit.keyBenefits.map((point, pIdx) => (
                            <div key={pIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                              <div className="size-4 rounded-full bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="size-3" />
                              </div>
                              <span className="leading-snug">{point}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Friendly Visual Spotlight */}
                      <div className="md:col-span-5 flex flex-col items-center justify-center">
                        <div className="w-full bg-[#121212] border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center shadow-md">
                          <div className="size-16 rounded-2xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(45,212,191,0.15)]">
                            <IconComponent className="size-8 text-teal-300" />
                          </div>
                          <p className="font-display font-semibold text-white text-base mb-1">
                            {benefit.tag}
                          </p>
                          <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                            {benefit.visualType === "camera" && "Instant AI visual scan assigns priority and coordinates."}
                            {benefit.visualType === "verification" && "GPS radius + landmark forensics confirm real physical fixes."}
                            {benefit.visualType === "offline" && "Captures locally and syncs silently when connected."}
                            {benefit.visualType === "map" && "Real-time pins and thermal heatmaps for local neighborhoods."}
                            {benefit.visualType === "rewards" && "Civic Points celebrate your neighborhood stewardship."}
                          </p>

                          <div className="mt-4 pt-3 border-t border-white/[0.06] w-full flex items-center justify-between text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1 text-teal-400">
                              <CheckCircle2 className="size-3.5" />
                              Active
                            </span>
                            <span>Community Protected</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 3. COMMUNITY IMPACT SECTION ═══════════════════════ */}
      <section id="impact" className="relative flex flex-col justify-center min-h-[85vh] py-16 bg-[#050505] border-t border-white/[0.06] overflow-x-hidden">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold mb-3">
              <HeartHandshake className="size-3.5" />
              <span>Community First</span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight">
              Safer Streets, Cleaner Neighborhoods
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Built to empower citizens and support municipal teams with transparent, reliable data.
            </p>
          </div>
        </div>

        {/* Horizontal Track (Scrubbed on Desktop, Swipe Carousel on Mobile) */}
        <div className="w-full overflow-x-auto md:overflow-x-visible snap-x snap-mandatory hide-scrollbar">
          <div id="impact-cards-container" className="flex gap-4 sm:gap-6 px-4 sm:px-6 md:px-[15vw] w-max pb-4">
            {[
              {
                icon: Zap,
                title: "Zero Delay",
                desc: "Issues are categorized and mapped instantly, cutting through municipal paperwork backlogs.",
                color: "text-teal-400",
                bg: "bg-teal-500/10 border-teal-500/20",
              },
              {
                icon: ShieldCheck,
                title: "Genuine Fixes",
                desc: "Repairs are proven with landmark photo verification before cases are marked resolved.",
                color: "text-rose-400",
                bg: "bg-rose-500/10 border-rose-500/20",
              },
              {
                icon: Globe,
                title: "Every Neighborhood",
                desc: "Works everywhere across the city, even in cellular dead zones and remote underpasses.",
                color: "text-amber-400",
                bg: "bg-amber-500/10 border-amber-500/20",
              },
              {
                icon: BarChart3,
                title: "Data-Driven Decisions",
                desc: "Municipalities use our thermal hazard maps to allocate repair budgets where they matter most.",
                color: "text-cyan-400",
                bg: "bg-cyan-500/10 border-cyan-500/20",
              },
              {
                icon: HeartHandshake,
                title: "Civic Pride",
                desc: "Communities come together to take ownership of their local environment and build trust.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10 border-emerald-500/20",
              },
              {
                icon: Camera,
                title: "Absolute Transparency",
                desc: "Track the lifecycle of an issue from the initial citizen report to the verified physical repair.",
                color: "text-indigo-400",
                bg: "bg-indigo-500/10 border-indigo-500/20",
              },
            ].map((card, i) => {
              const IconComp = card.icon;
              return (
                <div
                  key={i}
                  className="impact-card w-[80vw] sm:w-[45vw] md:w-[35vw] lg:w-[22vw] max-w-[320px] flex-shrink-0 snap-center p-6 rounded-[1.5rem] bg-[#0d0d0d] border border-slate-800/80 flex flex-col justify-between shadow-xl hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className={`size-10 rounded-xl ${card.bg} border flex items-center justify-center mb-4`}>
                      <IconComp className={`size-4 ${card.color}`} />
                    </div>
                    <h3 className="font-display font-bold text-lg sm:text-xl text-white mb-2">{card.title}</h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{card.desc}</p>
                  </div>
                  <div className="mt-6 pt-3 border-t border-white/[0.06] text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-4 text-teal-400" />
                    <span>Always accessible</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 4. GET STARTED CTA SECTION ═══════════════════════ */}
      <section className="cta-section relative py-20 bg-black overflow-hidden border-t border-white/[0.06]">
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="cta-card bg-[#0a0a0a] border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-xl flex flex-col items-center" style={{ willChange: "transform, opacity, filter" }}>
            <div className="size-12 rounded-2xl bg-teal-400/15 border border-teal-400/30 flex items-center justify-center mb-5 text-teal-300">
              <Sparkles className="size-6" />
            </div>

            <h2 className="font-display font-bold text-2xl sm:text-4xl text-white tracking-tight leading-tight">
              Ready to Help Protect Your Neighborhood?
            </h2>

            <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-md leading-relaxed">
              Open the live neighborhood radar to view active reports or snap a photo of an issue near you.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                href="/dashboard"
              onClick={handleLaunchDashboard}
                className="w-full sm:w-auto bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold px-8 py-3.5 rounded-full text-sm sm:text-base flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(45,212,191,0.25)]"
              >
                <span>Open Live Radar & Report</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-teal-400" />
                No app installation required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-teal-400" />
                Works on all mobile devices
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-teal-400" />
                100% Free for citizens
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ 5. FOOTER ═══════════════════════ */}
      <footer className="border-t border-white/[0.06] bg-black text-slate-500 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="size-6 bg-teal-400 rounded-md flex items-center justify-center">
              <Activity className="size-3 text-slate-950" strokeWidth={2.5} />
            </div>
            <span className="font-display font-semibold text-white">CivicPulse</span>
            <span className="text-slate-600">· Community Issue Tracker</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Radar & AI Verification Online</span>
          </div>

          <p className="text-slate-500">
            Developed by <span className="text-slate-300 font-medium">Pratyush Raj</span> · VIT Vellore
          </p>
        </div>
      </footer>

      {/* ═══════════════════════ INTRO SEQUENCE (LASER FLOW) ═══════════════════════ */}
      <div 
        id="intro-curtain"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505] pointer-events-none"
      >
        <div className="absolute inset-0 opacity-40">
          <LaserFlow 
            color="#a78bfa" 
            horizontalBeamOffset={0}
            verticalBeamOffset={-0.4}
            horizontalSizing={1.5}
            verticalSizing={3.2}
            wispDensity={1.2}
            wispSpeed={18}
            wispIntensity={14}
            flowSpeed={0.25}
            flowStrength={0.5}
            fogIntensity={0.8}
            fogScale={0.1}
            decay={3}
          />
        </div>
      </div>

      {/* ═══════════════════════ FLOATING LOGO (SCROLL TRIGGERED) ═══════════════════════ */}
      <div 
        id="floating-logo" 
        className="fixed z-[200] flex items-center origin-top-left pointer-events-none whitespace-nowrap"
      >
        <div className="flex items-center font-display font-bold tracking-tight leading-none text-5xl sm:text-6xl">
          <BlurText text="Civic" delay={250} animateBy="letters" direction="top" className="text-white mt-1.5" />
          
          <RotatingText
              texts={['Pulse', 'Radar']}
              mainClassName="ml-3 bg-cyan-400 text-black px-4 pt-2 pb-1 rounded-2xl overflow-hidden flex items-center justify-center leading-none"
              staggerFrom={"last"}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-120%" }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={4000}
          />
        </div>
      </div>
    </div>
  );
}
