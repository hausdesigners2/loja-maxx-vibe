"use client";

import { useEffect, useState } from "react";

export function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const minDuration = 1500; // 1.5s minimum duration
    const maxDuration = 4000; // 4s maximum timeout

    // Smooth progress bar simulation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Slower progress as it gets closer to 100 to feel natural
        const increment = Math.max(1, (100 - prev) * 0.1);
        return Math.min(99, prev + increment);
      });
    }, 50);

    const handleLoad = () => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minDuration - elapsedTime);

      setTimeout(() => {
        setProgress(100);
        setFadeOut(true);
        setTimeout(() => {
          setVisible(false);
        }, 500); // Match transition duration (500ms)
      }, remainingTime);
    };

    // Check if document is already loaded
    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
    }

    // Safety timeout to prevent infinite loading screen
    const safetyTimeout = setTimeout(() => {
      setProgress(100);
      setFadeOut(true);
      setTimeout(() => {
        setVisible(false);
      }, 500);
    }, maxDuration);

    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimeout);
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#060606] transition-all duration-500 ease-in-out ${
        fadeOut ? "opacity-0 pointer-events-none scale-105" : "opacity-100"
      }`}
    >
      {/* Ambient Soft Glow Background */}
      <div className="absolute h-[350px] w-[350px] rounded-full bg-primary/10 blur-[100px] animate-pulse" />

      <div className="relative flex flex-col items-center gap-8 z-10">
        {/* 3D-Styled Shopping Bag Icon with Metallic Shine */}
        <div className="relative group">
          {/* Outer Glow Ring */}
          <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-r from-primary to-primary-glow opacity-30 blur-xl group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse" />
          
          {/* 3D Bag Container */}
          <div className="relative w-32 h-32 rounded-[2rem] bg-gradient-to-br from-primary via-primary to-primary-glow p-[2px] shadow-glow flex items-center justify-center overflow-hidden">
            {/* Metallic Shine Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] pointer-events-none" />
            
            {/* Inner Dark Glassmorphism Layer */}
            <div className="absolute inset-[2px] rounded-[1.9rem] bg-[#0c0c0c]/90 flex items-center justify-center">
              {/* Pure SVG 3D-Styled Shopping Bag */}
              <svg
                className="w-16 h-16 text-primary drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Bag Handle */}
                <path
                  d="M6 8a6 6 0 0 1 12 0"
                  className="animate-[bounce_2s_infinite_ease-in-out]"
                  style={{ transformOrigin: "center 8px" }}
                />
                {/* Bag Body */}
                <path
                  d="M4 9a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1l1.2 10a2 2 0 0 1-2 2.2H4.8a2 2 0 0 1-2-2.2L4 9z"
                  fill="url(#bag-gradient)"
                  stroke="url(#stroke-gradient)"
                  strokeWidth="1.8"
                />
                {/* Inner Accent Line */}
                <path
                  d="M9 13h6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.8"
                />
                
                {/* Gradients Definitions */}
                <defs>
                  <linearGradient id="bag-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary) / 0.15)" />
                    <stop offset="100%" stopColor="hsl(var(--primary-glow) / 0.05)" />
                  </linearGradient>
                  <linearGradient id="stroke-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--primary-glow))" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        {/* Brand Name & Loading Text */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-foreground to-white/70 bg-clip-text text-transparent drop-shadow-sm">
            Lojas Maxx
          </h1>
          <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase animate-pulse">
            Carregando ofertas...
          </p>
        </div>

        {/* Smooth Progress Bar */}
        <div className="w-48 h-1.5 bg-secondary/40 rounded-full overflow-hidden border border-border/20">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-glow rounded-full transition-all duration-300 ease-out shadow-glow"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Custom Shimmer Animation Style */}
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}