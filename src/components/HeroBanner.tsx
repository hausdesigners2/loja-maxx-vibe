import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Banner = Tables<"banners">;

const AUTOPLAY_MS = 4000;

export function HeroBanner() {
  const [slides, setSlides] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    supabase
      .from("banners")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setSlides(data ?? []));
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    timer.current = window.setInterval(
      () => setIdx((i) => (i + 1) % slides.length),
      AUTOPLAY_MS,
    );
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [paused, slides.length]);

  if (slides.length === 0) {
    return (
      <div className="relative aspect-[16/6] w-full animate-pulse overflow-hidden rounded-2xl bg-card shadow-card md:aspect-[8/3]" />
    );
  }

  const go = (n: number) => setIdx((n + slides.length) % slides.length);
  const current = slides[idx];

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    current.link_url ? (
      <a href={current.link_url} className="absolute inset-0" aria-label={current.title || "Banner"}>
        {children}
      </a>
    ) : (
      <div className="absolute inset-0">{children}</div>
    );

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="relative aspect-[16/9] w-full md:aspect-[8/3]">
        {slides.map((s, i) => (
          <img
            key={s.id}
            src={s.image_url}
            alt={s.title || "Banner"}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700",
              i === idx ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/85 via-background/30 to-transparent" />

        <Wrapper>
          <div className="flex h-full flex-col justify-center gap-2 p-5">
            {current.title && (
              <h2 className="text-2xl font-extrabold leading-tight drop-shadow md:text-4xl">
                {current.title}
              </h2>
            )}
            {current.subtitle && (
              <p className="max-w-[60%] text-xs text-muted-foreground md:text-sm">
                {current.subtitle}
              </p>
            )}
            {current.button_text && (
              <span className="mt-2 inline-flex w-fit items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow md:text-sm">
                {current.button_text}
              </span>
            )}
          </div>
        </Wrapper>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); go(idx - 1); }}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-background/70 backdrop-blur transition hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); go(idx + 1); }}
              aria-label="Próximo"
              className="absolute right-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-background/70 backdrop-blur transition hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); setIdx(i); }}
                  aria-label={`Slide ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === idx ? "w-6 bg-primary" : "w-1.5 bg-foreground/40",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
