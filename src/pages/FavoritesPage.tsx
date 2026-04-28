import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { useFavorites } from "@/hooks/useFavorites";
import { Heart } from "lucide-react";

type Product = Tables<"products">;

export default function FavoritesPage() {
  const { favs } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const ids = [...favs];
    if (ids.length === 0) { setProducts([]); return; }
    supabase.from("products").select("*").in("id", ids).eq("active", true)
      .then(({ data }) => setProducts(data ?? []));
  }, [favs]);

  return (
    <AppShell>
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-extrabold">Favoritos</h1>
        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Heart className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum favorito ainda. Toque no coração de um produto.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
