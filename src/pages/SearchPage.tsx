import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { AppShell } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { logSearch } from "@/lib/checkout";
import { sanitizeText } from "@/lib/security";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";

type Product = Tables<"products">;

const PAGE_SIZE = 20;

export default function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce search query to avoid excessive database requests
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const loadBatch = async (searchQuery: string, pageNum: number, isInitial = false) => {
    if (isLoading) return;
    setIsLoading(true);
    console.log(`[InfiniteScroll] Iniciando pré-carregamento para página ${pageNum}, busca: "${searchQuery}"`);

    try {
      const rawTerm = searchQuery.trim();
      const term = sanitizeText(rawTerm, 100);

      let query = supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (term) {
        query = query.ilike("name", `%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const newProducts = data ?? [];
      console.log(`[InfiniteScroll] Produtos recebidos: ${newProducts.length}`);

      setProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const filteredNew = newProducts.filter((p) => !existingIds.has(p.id));
        const combined = isInitial ? newProducts : [...prev, ...filteredNew];
        console.log(`[InfiniteScroll] Produtos totais: ${combined.length}`);
        return combined;
      });

      setHasMore(newProducts.length === PAGE_SIZE);
      setPage(pageNum);

      if (isInitial && term.length >= 2) {
        void logSearch(term, newProducts.length, user?.id ?? null);
      }
    } catch (err) {
      console.error("[InfiniteScroll] Erro ao buscar lote:", err);
    } finally {
      setIsLoading(false);
      console.log("[InfiniteScroll] Carregamento concluído");
    }
  };

  // Reset and load initial batch when search query changes
  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    loadBatch(debouncedQ, 0, true);
  }, [debouncedQ, user]);

  const handleLoadMore = () => {
    if (isLoading || !hasMore) return;
    console.log("[InfiniteScroll] Trigger detectado - carregando próxima página");
    loadBatch(debouncedQ, page + 1);
  };

  return (
    <AppShell>
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-extrabold">Buscar</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="O que você procura?"
            className="h-12 rounded-2xl border-0 bg-card pl-10 text-base" 
          />
        </div>
        
        {products.length === 0 && !isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            <InfiniteScrollTrigger 
              onTrigger={handleLoadMore} 
              hasMore={hasMore} 
              isLoading={isLoading} 
            />
          </>
        )}
      </div>
    </AppShell>
  );
}