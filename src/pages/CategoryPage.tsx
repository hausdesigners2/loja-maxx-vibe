import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { CategoryStrip } from "@/components/CategoryStrip";
import { ProductCard } from "@/components/ProductCard";
import { finalPrice } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Product = Tables<"products">;
type Category = Tables<"categories">;

type SortKey = "recent" | "price_asc" | "price_desc" | "discount" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Mais recentes",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  discount: "Maior desconto",
  name: "Nome (A-Z)",
};

const DEFAULT_CATEGORIES = [
  { id: "1", name: "Cereais e Grãos", slug: "cereais-e-graos", icon: "🌾", sort_order: 1, created_at: "" },
  { id: "2", name: "Massas", slug: "massas", icon: "🍝", sort_order: 2, created_at: "" },
  { id: "3", name: "Bebidas", slug: "bebidas", icon: "🥤", sort_order: 3, created_at: "" },
  { id: "4", name: "Laticínios", slug: "laticinios", icon: "🧀", sort_order: 4, created_at: "" },
  { id: "5", name: "Limpeza", slug: "limpeza", icon: "🧹", sort_order: 5, created_at: "" },
  { id: "6", name: "Biscoitos", slug: "biscoitos", icon: "🍪", sort_order: 6, created_at: "" },
  { id: "7", name: "Bazar", slug: "bazar", icon: "🛍️", sort_order: 7, created_at: "" }
];

function mergeCategories(fetched: Category[]): Category[] {
  const map = new Map<string, Category>();
  DEFAULT_CATEGORIES.forEach(c => map.set(c.slug, c as Category));
  fetched.forEach(c => map.set(c.slug, c));
  return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
}

export default function CategoryPage() {
  const { slug } = useParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [current, setCurrent] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");
      
      const merged = mergeCategories(cats ?? []);
      setCategories(merged);
      
      const cat = merged.find((c) => c.slug === slug) ?? null;
      setCurrent(cat);
      
      if (cat) {
        const { data } = await supabase
          .from("products")
          .select("*")
          .eq("active", true)
          .eq("category_id", cat.id);
        setProducts(data ?? []);
      } else {
        setProducts([]);
      }
      setLoading(false);
    })();
  }, [slug]);

  const sorted = useMemo(() => {
    const list = [...products];
    switch (sort) {
      case "price_asc":
        return list.sort(
          (a, b) =>
            finalPrice(Number(a.price), a.discount_percent) -
            finalPrice(Number(b.price), b.discount_percent),
        );
      case "price_desc":
        return list.sort(
          (a, b) =>
            finalPrice(Number(b.price), b.discount_percent) -
            finalPrice(Number(a.price), a.discount_percent),
        );
      case "discount":
        return list.sort((a, b) => b.discount_percent - a.discount_percent);
      case "name":
        return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      case "recent":
      default:
        return list.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
    }
  }, [products, sort]);

  return (
    <AppShell>
      <div className="space-y-5 animate-fade-in">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>

        <CategoryStrip categories={categories} activeSlug={slug} />

        {current && (
          <header className="relative overflow-hidden rounded-2xl bg-card p-4 shadow-card">
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-3xl shadow-glow">
                {current.icon || "🏷️"}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold tracking-tight">
                  {current.name}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {products.length} produto(s) disponíveis
                </p>
              </div>
            </div>
          </header>
        )}

        {!current && !loading && (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
            Categoria não encontrada.
          </div>
        )}

        {current && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Produtos
            </span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-[170px] rounded-full border-border bg-card text-xs">
                <ArrowUpDown className="mr-1 h-3.5 w-3.5 text-primary" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] animate-pulse rounded-2xl bg-card"
              />
            ))}
          </div>
        ) : current && sorted.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum produto cadastrado nesta categoria ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sorted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}