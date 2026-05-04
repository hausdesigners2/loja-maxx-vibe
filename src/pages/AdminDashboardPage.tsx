import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft, Users, Package, TrendingUp, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/format";

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  city: string;
  state: string;
  created_at: string;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total: number;
  status: string;
  created_at: string;
  order_items: { product_name: string; quantity: number; subtotal: number }[];
}

interface SearchRow {
  term: string;
  count: number;
  last: string;
}

export default function AdminDashboardPage() {
  const { user, isAdmin, loading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ranking, setRanking] = useState<SearchRow[]>([]);
  const [recentSearches, setRecentSearches] = useState<{ term: string; created_at: string; results_count: number }[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: cust }, { data: ord }, { data: searches }] = await Promise.all([
        supabase.from("customer_profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("orders").select("*, order_items(product_name, quantity, subtotal)").order("created_at", { ascending: false }).limit(100),
        supabase.from("search_history").select("term, created_at, results_count").order("created_at", { ascending: false }).limit(500),
      ]);
      setCustomers((cust ?? []) as Customer[]);
      setOrders((ord ?? []) as Order[]);
      const all = searches ?? [];
      setRecentSearches(all.slice(0, 50));
      const map = new Map<string, { count: number; last: string }>();
      for (const s of all) {
        const key = s.term.toLowerCase();
        const cur = map.get(key);
        if (cur) { cur.count++; if (s.created_at > cur.last) cur.last = s.created_at; }
        else map.set(key, { count: 1, last: s.created_at });
      }
      const rank = Array.from(map.entries())
        .map(([term, v]) => ({ term, count: v.count, last: v.last }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30);
      setRanking(rank);
    })();
  }, [isAdmin]);

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">Acesso negado</h1>
      <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Painel
          </Link>
          <h1 className="text-base font-bold">Clientes & Pedidos</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat icon={<Users className="h-4 w-4" />} label="Clientes" v={customers.length} />
          <Stat icon={<Package className="h-4 w-4" />} label="Pedidos" v={orders.length} />
          <Stat icon={<Search className="h-4 w-4" />} label="Buscas" v={recentSearches.length} />
        </div>

        <Tabs defaultValue="orders">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="searches">Buscas</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-2 pt-4">
            {orders.length === 0 && <Empty msg="Nenhum pedido ainda." />}
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl bg-card p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_phone} · {new Date(o.created_at).toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_address}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-primary">{formatBRL(Number(o.total))}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{o.status}</div>
                  </div>
                </div>
                <ul className="mt-2 border-t border-border pt-2 text-xs">
                  {o.order_items?.map((it, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{it.quantity}x {it.product_name}</span>
                      <span>{formatBRL(Number(it.subtotal))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="customers" className="space-y-2 pt-4">
            {customers.length === 0 && <Empty msg="Nenhum cliente cadastrado." />}
            {customers.map((c) => (
              <div key={c.id} className="rounded-2xl bg-card p-3 text-sm">
                <div className="font-bold">{c.full_name || "(sem nome)"}</div>
                <div className="text-xs text-muted-foreground">{c.email}</div>
                <div className="text-xs">{c.phone} {c.city && `· ${c.city}/${c.state}`}</div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="ranking" className="space-y-2 pt-4">
            {ranking.length === 0 && <Empty msg="Nenhuma busca registrada." />}
            {ranking.map((r, i) => (
              <div key={r.term} className="flex items-center justify-between rounded-xl bg-card p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">{i + 1}</span>
                  <span className="font-medium">{r.term}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-primary">
                  <TrendingUp className="h-3 w-3" /> {r.count}x
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="searches" className="space-y-1 pt-4">
            {recentSearches.length === 0 && <Empty msg="Nenhuma busca registrada." />}
            {recentSearches.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-card p-2 text-xs">
                <span>{s.term}</span>
                <span className="text-muted-foreground">{s.results_count} res. · {new Date(s.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Stat({ icon, label, v }: { icon: React.ReactNode; label: string; v: number }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center">
      <div className="mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-primary">{icon}</div>
      <div className="text-lg font-extrabold">{v}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}
