"use client";

import React, { useEffect, useRef } from "react";

interface InfiniteScrollTriggerProps {
  onTrigger: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export function InfiniteScrollTrigger({ onTrigger, hasMore, isLoading }: InfiniteScrollTriggerProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onTrigger();
        }
      },
      { rootMargin: "300px" } // Trigger 300px before reaching the bottom for a seamless experience
    );

    const currentTarget = observerRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [onTrigger, hasMore, isLoading]);

  return (
    <div ref={observerRef} className="py-6 text-center text-xs text-muted-foreground">
      {isLoading && (
        <div className="flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Carregando mais produtos...</span>
        </div>
      )}
      {!hasMore && (
        <span className="opacity-70">Você chegou ao fim dos produtos.</span>
      )}
    </div>
  );
}