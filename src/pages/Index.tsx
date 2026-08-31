import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { HeroBanner } from "@/components/HeroBanner";
import { CategoryStrip } from "@/components/CategoryStrip";
import { ProductCard } from "@/components/ProductCard";
import { SectionHeader } from "@/components/SectionHeader";

type Product = Tables<"products">;
type Category = Tables<"categories">;

const VISIBLE = 8;

const DEFAULT_CATEGORIES = [
  { id: "1", name: "Cereais e Grãos", slug: "cereais-e-graos", icon: "🌾", sort_order: 1, created_at: "" },
  { id: "2", name: "Massas", slug: "massas", icon: "🍝", sort_order: 2, created_at: "" },
  { id: "3", name: "Bebidas", slug: "bebidas", icon: "🥤", sort_order: 3, created_at: "" },
  { id: "4", name: "Laticínios", slug: "laticinios", icon: "🧀", sort_order: 4, created_at: "" },
  { id: "5", name: "Limpeza", slug: "limpeza", icon: "🧹", sort_order: 5, created_at: "" },
  { id: "6", name: "Biscoitos", slug: "biscoitos", icon: "🍪", sort_order: 6, created_at: "" },
  { id: "7", name: "Bazar", slug: "bazar", icon: "🛍️", sort_order: 7, created_at: "" },
  { id: "8", name: "Padaria", slug: "padaria", icon: "🥖", sort_order: 8, created_at: "" }
];

function mergeCategories(fetched: Category[]): Category[] {
  const map = new Map<string, Category>();
  DEFAULT_CATEGORIES.forEach(c => map.set(c.slug, c as Category));
  fetched.forEach(c => map.set(c.slug, c));
  return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Index = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestSellersPool, setBestSellersPool] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1. Buscar categorias existentes (apenas leitura)
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });

      const [best, feat] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).eq("is_best_seller", true).limit(40),
        supabase.from("products").select("*").eq("active", true).eq("is_featured", true).limit(8),
      ]);

      // Mescla com a lista padrão em memória para garantir exibição imediata sem precisar gravar no banco
      setCategories(mergeCategories(cats ?? []));
      
      const fetchedBest = best.data ?? [];
      let orderedBest: Product[] = [];

      try {
        const sessionOrderRaw = sessionStorage.getItem("loja-maxx-session-bestsellers");
        if (sessionOrderRaw) {
          const sessionIds: string[] = JSON.parse(sessionOrderRaw);
          const idMap = new Map(fetchedBest.map(p => [p.id, p]));
          
          // Reconstruct the list in the saved session order
          const ordered: Product[] = [];
          sessionIds.forEach(id => {
            const p = idMap.get(id);
            if (p) {
              ordered.push(p);
              idMap.delete(id);
            }
          });
          
          // If there are any new best sellers not in the session storage, shuffle and append them
          const remaining = Array.from(idMap.values());
          if (remaining.length > 0) {
            const shuffledRemaining = shuffle(remaining);
            ordered.push(...shuffledRemaining);
            // Update session storage with the new complete list of IDs
            sessionStorage.setItem("loja-maxx-session-bestsellers", JSON.stringify(ordered.map(p => p.id)));
          }
          orderedBest = ordered;
        } else {
          orderedBest = shuffle(fetchedBest);
          sessionStorage.setItem("loja-maxx-session-bestsellers", JSON.stringify(orderedBest.map(p => p.id)));
        }
      } catch (e) {
        console.error("Error restoring session best sellers:", e);
        orderedBest = shuffle(fetchedBest);
      }

      setBestSellersPool(orderedBest);
      setFeatured(feat.data ?? []);
      setLoading(false);
    })();
  }, []);

  const visibleBestSellers = useMemo(() => {
    return bestSellersPool.slice(0, VISIBLE);
  }, [bestSellersPool]);

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <HeroBanner />

        <section>
          <SectionHeader title="Categorias">Encontre o que precisa</SectionHeader>
          <CategoryStrip categories={categories} />
        </section>

        <section>
          <SectionHeader title="🔥 Mais vendidos" to="/buscar">Os queridinhos da Lojas Maxx</SectionHeader>
          {loading ? <SkeletonGrid /> : visibleBestSellers.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {visibleBestSellers.map((p, i) => <ProductCard key={`${p.id}-${i}`} product={p} />)}
            </div>
          ) : <Empty msg="Nenhum mais vendido por enquanto." />}
        </section>

        <section>
          <SectionHeader title="✨ Em destaque" to="/buscar">Selecionados para você</SectionHeader>
          {loading ? <SkeletonGrid /> : featured.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : <Empty msg="Nenhum produto em destaque." />}
        </section>
      </div>
    </AppShell>
  );
};

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-card" />
      ))}
    </div>
  );
}
function Empty({ msg }: { msg: string }) {
  return <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">{msg}</div>;
}

export default Index;