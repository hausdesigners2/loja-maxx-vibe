import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/hooks/useFavorites";
import { formatBRL, finalPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Product = Tables<"products">;

export default function ProductPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const { add } = useCart();
  const { isFav, toggle } = useFavorites();

  useEffect(() => {
    if (!id) return;
    supabase.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => setProduct(data));
  }, [id]);

  if (!product) {
    return <AppShell><div className="aspect-square animate-pulse rounded-2xl bg-card" /></AppShell>;
  }

  const price = Number(product.price);
  const final = finalPrice(price, product.discount_percent);
  const fav = isFav(product.id);

  return (
    <AppShell>
      <div className="space-y-4 animate-fade-in">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="relative overflow-hidden rounded-2xl bg-card">
          <div className="aspect-square">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-6xl text-muted-foreground">📦</div>
            )}
          </div>
          {product.discount_percent > 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground shadow-glow">
              -{product.discount_percent}% OFF
            </span>
          )}
          <button onClick={() => toggle(product.id)} aria-label="Favoritar"
            className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-background/80 backdrop-blur">
            <Heart className={cn("h-5 w-5", fav ? "fill-primary text-primary" : "")} />
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold leading-tight">{product.name}</h1>
          <div className="mt-2 flex items-baseline gap-2">
            {product.discount_percent > 0 && (
              <span className="text-sm text-muted-foreground line-through">{formatBRL(price)}</span>
            )}
            <span className="text-3xl font-extrabold text-primary">{formatBRL(final)}</span>
          </div>
          {product.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3">
          <span className="text-sm font-medium">Quantidade</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><Minus className="h-4 w-4" /></button>
            <span className="w-6 text-center font-bold">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><Plus className="h-4 w-4" /></button>
          </div>
        </div>

        <Button size="lg" className="h-14 w-full gradient-primary text-base font-bold shadow-glow"
          onClick={() => {
            add({ id: product.id, name: product.name, price, discount_percent: product.discount_percent, image_url: product.image_url }, qty);
            nav("/carrinho");
          }}>
          Adicionar ao carrinho • {formatBRL(final * qty)}
        </Button>
      </div>
    </AppShell>
  );
}
