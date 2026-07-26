"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SplashScreenProps {
  isFadingOut: boolean;
}

export default function SplashScreen({ isFadingOut }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);

  // Smoothly animate the progress bar to reach ~95% over 3 seconds
  useEffect(() => {
    if (isFadingOut) {
      setProgress(100);
      return;
    }

    const duration = 3000; // 3 seconds
    const intervalTime = 50; // Update every 50ms
    const totalSteps = duration / intervalTime;
    const increment = 95 / totalSteps;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isFadingOut]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0a0a0a] p-8 transition-all duration-700 ease-in-out",
        isFadingOut ? "pointer-events-none opacity-0 scale-105" : "opacity-100 scale-100"
      )}
    >
      {/* Top spacer to push content to center */}
      <div className="h-12" />

      {/* Centered Metallic Gold App Icon Video */}
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative h-48 w-48 overflow-hidden rounded-3xl bg-transparent">
          <video
            src="/lojasmaxx.webm"
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-contain"
          />
        </div>
        
        {/* Loading Text */}
        <p className="animate-pulse text-sm font-medium tracking-widest text-white/90 uppercase">
          Carregando ofertas!
        </p>
      </div>

      {/* Bottom Loading Bar Container */}
      <div className="w-full max-w-xs space-y-4 pb-12">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}