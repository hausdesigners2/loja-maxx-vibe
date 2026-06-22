import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Category = Tables<"categories">;

export function CategoryStrip({ categories, activeSlug }: { categories: Category[]; activeSlug?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 240;
      const offset = direction === "left" ? -scrollAmount : scrollAmount;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="relative group -mx-4 px-4">
      {/* Seta Esquerda (Apenas Desktop + Hover) */}
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute left-6 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/90 shadow-md backdrop-blur transition-all duration-200 hover:bg-background active:scale-95 hidden md:grid opacity-0 group-hover:opacity-100"
        aria-label="Rolar categorias para esquerda"
      >
        <ChevronLeft className="h-4 w-4 text-foreground" />
      </button>

      {/* Container de Categorias */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide scroll-smooth"
      >
        <div className="flex w-max gap-3 py-1">
          <Link to="/" className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl px-3 py-2 transition",
            !activeSlug ? "bg-primary/10" : "hover:bg-secondary"
          )}>
            <div className={cn(
              "grid h-14 w-14 place-items-center rounded-2xl text-2xl",
              !activeSlug ? "gradient-primary shadow-glow" : "bg-secondary"
            )}>🛒</div>
            <span className="text-[11px] font-medium">Tudo</span>
          </Link>
          {categories.map((c) => {
            const active = activeSlug === c.slug;
            return (
              <Link key={c.id} to={`/categoria/${c.slug}`} className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl px-3 py-2 transition",
                active ? "bg-primary/10" : "hover:bg-secondary"
              )}>
                <div className={cn(
                  "grid h-14 w-14 place-items-center rounded-2xl text-2xl transition",
                  active ? "gradient-primary shadow-glow" : "bg-secondary"
                )}>{c.icon || "🏷️"}</div>
                <span className="text-[11px] font-medium">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Seta Direita (Apenas Desktop + Hover) */}
      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute right-6 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/90 shadow-md backdrop-blur transition-all duration-200 hover:bg-background active:scale-95 hidden md:grid opacity-0 group-hover:opacity-100"
        aria-label="Rolar categorias para direita"
      >
        <ChevronRight className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}