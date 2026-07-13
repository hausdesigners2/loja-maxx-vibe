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

type Product = Tables<"products">;

export default function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(60);
        
      const rawTerm = q.trim();
      // Sanitização rígida do input de busca contra qualquer tentativa de evasão ou injeção
      const term = sanitizeText(rawTerm, 100);
      
      if (term) {
        query = query.ilike("name", `%${term}%`);
      }
      
      const { data } = await query;
      const list = data ?? [];
      setProducts(list);
      
      if (term.length >= 2) {
        void logSearch(term, list.length, user?.id ?? null);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [q, user]);

  return (
    <AppShell>
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-extrabold">Buscar</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você procura?"
            className="h-12 rounded-2xl border-0 bg-card pl-10 text-base" />
        </div>
        {products.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}