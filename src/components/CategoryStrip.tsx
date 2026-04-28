import { Link } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Category = Tables<"categories">;

export function CategoryStrip({ categories, activeSlug }: { categories: Category[]; activeSlug?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto scrollbar-hide">
      <div className="flex w-max gap-3 px-4">
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
  );
}
