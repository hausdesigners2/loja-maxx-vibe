"use client";

import { useEffect, useState } from "react";

export function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const minDuration = 2000; // 2s minimum duration to appreciate the video
    const maxDuration = 5000; // 5s maximum safety timeout

    // Smooth progress bar simulation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = Math.max(1, (100 - prev) * 0.08);
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
        }, 500);
      }, remainingTime);
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
    }

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

      <div className="relative flex flex-col items-center gap-6 z-10 max-w-xs w-full px-4">
        {/* Video Container */}
        <div className="relative w-48 h-48 rounded-[2rem] overflow-hidden border border-primary/20 shadow-glow bg-black flex items-center justify-center">
          <video
            src="dyad-media://media/loja-maxx-vibe/.dyad/media/5532aa071f87e9522c3111977a4f04f0d2cc0af8cff39ba237d339b020d5754e.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        {/* Brand Name & Loading Text */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-foreground to-white/70 bg-clip-text text-transparent drop-shadow-sm">
            Lojas Maxx
          </h1>
          <p className="text-xs font-semibold text-primary tracking-wider animate-pulse">
            Carregando Ofertas!
          </p>
        </div>

        {/* Smooth Progress Bar */}
        <div className="w-full h-1.5 bg-secondary/40 rounded-full overflow-hidden border border-border/20">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-glow rounded-full transition-all duration-300 ease-out shadow-glow"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}