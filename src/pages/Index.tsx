import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { HeroBanner } from "@/components/HeroBanner";
import { CategoryStrip } from "@/components/CategoryStrip";
import { ProductCard } from "@/components/ProductCard";
import { SectionHeader } from "@/components/SectionHeader";

type Product = Tables<"products">;
type Category = Tables<"categories">;

const Index = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cats, best, feat] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("products").select("*").eq("active", true).eq("is_best_seller", true).limit(8),
        supabase.from("products").select("*").eq("active", true).eq("is_featured", true).limit(8),
      ]);
      setCategories(cats.data ?? []);
      setBestSellers(best.data ?? []);
      setFeatured(feat.data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <HeroBanner />

        <section>
          <SectionHeader title="Categorias">Encontre o que precisa</SectionHeader>
          <CategoryStrip categories={categories} />
        </section>

        <section>
          <SectionHeader title="🔥 Mais vendidos" to="/buscar">Os queridinhos da Loja Maxx</SectionHeader>
          {loading ? <SkeletonGrid /> : bestSellers.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {bestSellers.map((p) => <ProductCard key={p.id} product={p} />)}
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
