import { Heart, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { formatBRL, finalPrice } from "@/lib/format";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

type Product = Tables<"products">;

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { isFav, toggle } = useFavorites();
  const fav = isFav(product.id);
  const price = Number(product.price);
  const final = finalPrice(price, product.discount_percent);
  const hasDiscount = product.discount_percent > 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-card shadow-card transition-transform hover:-translate-y-0.5">
      <Link to={`/produto/${product.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-secondary">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className="grid h-full place-items-center text-4xl text-muted-foreground">📦</div>
          )}
          {hasDiscount && (
            <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow">
              -{product.discount_percent}%
            </span>
          )}
        </div>
      </Link>

      <button
        aria-label="Favoritar"
        onClick={(e) => { e.preventDefault(); toggle(product.id); }}
        className={cn(
          "absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80 backdrop-blur transition",
          fav && "animate-pulse-heart"
        )}>
        <Heart className={cn("h-4 w-4", fav ? "fill-primary text-primary" : "text-foreground")} />
      </button>

      <div className="space-y-1.5 p-3">
        <Link to={`/produto/${product.id}`}>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{product.name}</h3>
        </Link>
        <div className="flex items-baseline gap-1.5">
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">{formatBRL(price)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-extrabold text-primary">{formatBRL(final)}</span>
          <button
            aria-label="Adicionar ao carrinho"
            onClick={() => add({
              id: product.id, name: product.name,
              price, discount_percent: product.discount_percent,
              image_url: product.image_url,
            })}
            className="grid h-8 w-8 place-items-center rounded-full gradient-primary shadow-glow transition active:scale-95">
            <Plus className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
