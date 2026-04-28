import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { CategoryStrip } from "@/components/CategoryStrip";
import { ProductCard } from "@/components/ProductCard";

type Product = Tables<"products">;
type Category = Tables<"categories">;

export default function CategoryPage() {
  const { slug } = useParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [current, setCurrent] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cats } = await supabase.from("categories").select("*").order("sort_order");
      setCategories(cats ?? []);
      const cat = cats?.find((c) => c.slug === slug) ?? null;
      setCurrent(cat);
      if (cat) {
        const { data } = await supabase.from("products").select("*")
          .eq("active", true).eq("category_id", cat.id).order("created_at", { ascending: false });
        setProducts(data ?? []);
      }
      setLoading(false);
    })();
  }, [slug]);

  return (
    <AppShell>
      <div className="space-y-5 animate-fade-in">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>

        <CategoryStrip categories={categories} activeSlug={slug} />

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {current?.icon} {current?.name ?? "Categoria"}
          </h1>
          <p className="text-xs text-muted-foreground">{products.length} produto(s)</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-card" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum produto cadastrado nesta categoria ainda.
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
