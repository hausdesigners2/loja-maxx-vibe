import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft, Users, Package, TrendingUp, Search, Printer, Check, X, Truck, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { printOrder } from "@/lib/printOrder";

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

export interface OrderItemRow { product_name: string; quantity: number; subtotal: number; unit_price?: number }

export interface OrderRow {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_complement: string | null;
  customer_city: string | null;
  customer_state: string | null;
  total: number;
  status: string;
  payment_method: string;
  change_for: number | null;
  notes: string | null;
  created_at: string;
  order_items: OrderItemRow[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  delivered: "Entregue",
  cancelled: "Cancelado",
  awaiting_machine: "À receber na Maquininha",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-500",
  paid: "bg-green-500/20 text-green-500",
  delivered: "bg-blue-500/20 text-blue-500",
  cancelled: "bg-red-500/20 text-red-500",
  awaiting_machine: "bg-orange-500/20 text-orange-500",
};

export default function AdminDashboardPage() {
  const { user, isAdmin, loading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [recentSearches, setRecentSearches] = useState<{ term: string; created_at: string; results_count: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchAll = async () => {
    const [{ data: cust }, { data: ord }, { data: searches }] = await Promise.all([
      supabase.from("customer_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*, order_items(product_name, quantity, subtotal, unit_price)").order("created_at", { ascending: false }).limit(200),
      supabase.from("search_history").select("term, created_at, results_count").order("created_at", { ascending: false }).limit(500),
    ]);
    setCustomers((cust ?? []) as Customer[]);
    setOrders((ord ?? []) as OrderRow[]);
    setRecentSearches((searches ?? []).slice(0, 50));
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchAll();
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("Falha ao atualizar status");
    else toast.success(`Status: ${STATUS_LABELS[status] ?? status}`);
  };

  // Ranking by purchase volume
  const ranking = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; count: number; total: number }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const key = o.customer_phone || o.customer_name;
      const cur = map.get(key);
      if (cur) { cur.count++; cur.total += Number(o.total); }
      else map.set(key, { name: o.customer_name, phone: o.customer_phone, count: 1, total: Number(o.total) });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 30);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_phone.toLowerCase().includes(q) ||
      String(o.order_number ?? "").includes(q)
    );
  }, [orders, searchTerm]);

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
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, telefone ou nº pedido"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            />
            {filteredOrders.length === 0 && <Empty msg="Nenhum pedido encontrado." />}
            {filteredOrders.map((o) => (
              <OrderCard key={o.id} order={o} onStatus={updateStatus} />
            ))}
          </TabsContent>

          <TabsContent value="customers" className="space-y-2 pt-4">
            {customers.length === 0 && <Empty msg="Nenhum cliente cadastrado." />}
            {customers.map((c) => {
              const co = orders.filter((o) => o.customer_phone === c.phone || (c.user_id && (o as OrderRow & { user_id?: string }).user_id === c.user_id));
              const totalSpent = co.reduce((s, o) => s + Number(o.total), 0);
              return (
                <div key={c.id} className="rounded-2xl bg-card p-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{c.full_name || "(sem nome)"}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                      <div className="text-xs">{c.phone} {c.city && `· ${c.city}/${c.state}`}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-primary">{co.length} pedido(s)</div>
                      <div className="text-muted-foreground">{formatBRL(totalSpent)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="ranking" className="space-y-2 pt-4">
            {ranking.length === 0 && <Empty msg="Sem pedidos para ranquear." />}
            {ranking.map((r, i) => (
              <div key={r.phone + i} className="flex items-center justify-between rounded-xl bg-card p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">{i + 1}</span>
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.phone} · {r.count} pedido(s)</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-primary">
                  <TrendingUp className="h-3 w-3" /> {formatBRL(r.total)}
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

function OrderCard({ order: o, onStatus }: { order: OrderRow; onStatus: (id: string, s: string) => void }) {
  const canPrint = o.status === "paid" || o.status === "delivered";
  return (
    <div className="rounded-2xl bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold">{o.customer_name}</span>
            {o.order_number != null && <span className="text-[10px] text-muted-foreground">#{o.order_number}</span>}
          </div>
          <div className="text-xs text-muted-foreground">{o.customer_phone} · {new Date(o.created_at).toLocaleString("pt-BR")}</div>
          <div className="text-xs text-muted-foreground">{o.customer_address}</div>
        </div>
        <div className="text-right">
          <div className="font-extrabold text-primary">{formatBRL(Number(o.total))}</div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[o.status] ?? "bg-secondary text-muted-foreground"}`}>
            {STATUS_LABELS[o.status] ?? o.status}
          </span>
        </div>
      </div>

      <div className="mt-2 text-xs">
        <span className="text-muted-foreground">Pagamento:</span> <span className="font-semibold">{o.payment_method}</span>
        {o.payment_method === "Dinheiro" && o.change_for != null && (
          <span className="ml-2 text-muted-foreground">Troco para {formatBRL(Number(o.change_for))}</span>
        )}
      </div>

      <ul className="mt-2 border-t border-border pt-2 text-xs">
        {o.order_items?.map((it, i) => (
          <li key={i} className="flex justify-between">
            <span>{it.quantity}x {it.product_name}</span>
            <span>{formatBRL(Number(it.subtotal))}</span>
          </li>
        ))}
      </ul>

      {o.notes && (
        <div className="mt-2 rounded-md bg-secondary p-2 text-xs"><span className="font-semibold">Obs:</span> {o.notes}</div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {o.status !== "paid" && o.status !== "delivered" && o.status !== "cancelled" && (
          <button onClick={() => onStatus(o.id, "paid")} className="inline-flex items-center gap-1 rounded-lg bg-green-500/20 px-2.5 py-1.5 text-xs font-semibold text-green-500">
            <Check className="h-3 w-3" /> Marcar Pago
          </button>
        )}
        {o.status === "paid" && (
          <button onClick={() => onStatus(o.id, "delivered")} className="inline-flex items-center gap-1 rounded-lg bg-blue-500/20 px-2.5 py-1.5 text-xs font-semibold text-blue-500">
            <Truck className="h-3 w-3" /> Marcar Entregue
          </button>
        )}
        {o.status === "awaiting_machine" && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-500/20 px-2.5 py-1.5 text-xs font-semibold text-orange-500">
            <CreditCard className="h-3 w-3" /> Aguardando maquininha
          </span>
        )}
        {o.status !== "cancelled" && (
          <button onClick={() => onStatus(o.id, "cancelled")} className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-red-500">
            <X className="h-3 w-3" /> Cancelar
          </button>
        )}
        <button
          onClick={() => printOrder(o, "80mm")}
          disabled={!canPrint}
          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          title={canPrint ? "Imprimir pedido" : "Disponível após marcar como Pago"}
        >
          <Printer className="h-3 w-3" /> 80mm
        </button>
        <button
          onClick={() => printOrder(o, "58mm")}
          disabled={!canPrint}
          className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary disabled:opacity-40"
        >
          <Printer className="h-3 w-3" /> 58mm
        </button>
      </div>
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
