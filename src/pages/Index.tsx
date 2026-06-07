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
const STEP = 4;
const INTERVAL_MS = 10000;

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
  const [offset, setOffset] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    (async () => {
      const [cats, best, feat] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("products").select("*").eq("active", true).eq("is_best_seller", true).limit(40),
        supabase.from("products").select("*").eq("active", true).eq("is_featured", true).limit(8),
      ]);
      setCategories(cats.data ?? []);
      setBestSellersPool(shuffle(best.data ?? []));
      setFeatured(feat.data ?? []);
      setLoading(false);
    })();
  }, []);

  const visibleBestSellers = useMemo(() => {
    const pool = bestSellersPool;
    if (pool.length === 0) return [];
    const out: Product[] = [];
    for (let i = 0; i < Math.min(VISIBLE, pool.length); i++) {
      out.push(pool[(offset + i) % pool.length]);
    }
    return out;
  }, [bestSellersPool, offset]);

  useEffect(() => {
    if (bestSellersPool.length <= VISIBLE) return;
    const id = setInterval(() => {
      setOffset((o) => (o + STEP) % bestSellersPool.length);
      setFadeKey((k) => k + 1);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [bestSellersPool.length]);

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
            <div key={fadeKey} className="grid grid-cols-2 gap-3 animate-fade-in">
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
