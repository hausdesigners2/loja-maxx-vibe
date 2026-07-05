import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft, Users, Package, TrendingUp, Search, Printer, Check, X, Truck, CreditCard, Trash2, Eye, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { printOrder } from "@/lib/printOrder";
import { OrderCard } from "@/components/OrderCard";
import { Admin2FAGuard } from "@/components/Admin2FAGuard";

interface Customer {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string;
  complement: string;
  city: string;
  state: string;
  zip: string;
  created_at: string;
  updated_at: string;
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

  // Clientes Tab States
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<"all" | "with_orders" | "without_orders" | "recent">("all");
  const [customerPage, setCustomerPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const itemsPerPage = 10;

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

  const deleteCustomer = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir este cliente? Esta ação não poderá ser desfeita.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("customer_profiles").delete().eq("id", id);
      if (error) throw error;

      toast.success(`Cliente ${name} excluído com sucesso!`);
      fetchAll();
    } catch (err) {
      console.error("Erro ao excluir cliente:", err);
      toast.error("Erro ao excluir cliente. Verifique as permissões.");
    }
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

  // Clientes Tab Filtering & Searching
  const filteredCustomers = useMemo(() => {
    let list = [...customers];

    // 1. Search Filter (Name, Email, Phone)
    const q = customerSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          (c.full_name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.city || "").toLowerCase().includes(q)
      );
    }

    // 2. Tab Filters
    if (customerFilter === "with_orders") {
      list = list.filter((c) => {
        const hasOrders = orders.some(
          (o) => o.customer_phone === c.phone || (c.user_id && (o as any).user_id === c.user_id)
        );
        return hasOrders;
      });
    } else if (customerFilter === "without_orders") {
      list = list.filter((c) => {
        const hasOrders = orders.some(
          (o) => o.customer_phone === c.phone || (c.user_id && (o as any).user_id === c.user_id)
        );
        return !hasOrders;
      });
    } else if (customerFilter === "recent") {
      // Sort by created_at descending
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return list;
  }, [customers, orders, customerSearch, customerFilter]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch, customerFilter]);

  // Paginated Customers
  const paginatedCustomers = useMemo(() => {
    const start = (customerPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, customerPage]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const handleOpenDetails = (c: Customer) => {
    setSelectedCustomer(c);
    setIsDetailsOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">Acesso negado</h1>
      <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
    </div>
  );

  return (
    <Admin2FAGuard>
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

            <TabsContent value="customers" className="space-y-4 pt-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente por nome, e-mail, telefone ou cidade..."
                  className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {(["all", "with_orders", "without_orders", "recent"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setCustomerFilter(f)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      customerFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "all" && "Todos"}
                    {f === "with_orders" && "Com pedidos"}
                    {f === "without_orders" && "Sem pedidos"}
                    {f === "recent" && "Mais recentes"}
                  </button>
                ))}
              </div>

              {filteredCustomers.length === 0 && <Empty msg="Nenhum cliente encontrado." />}

              {/* Customers List */}
              <div className="space-y-2">
                {paginatedCustomers.map((c) => {
                  const co = orders.filter((o) => o.customer_phone === c.phone || (c.user_id && (o as OrderRow & { user_id?: string }).user_id === c.user_id));
                  const totalSpent = co.reduce((s, o) => s + Number(o.total), 0);
                  return (
                    <div key={c.id} className="rounded-2xl bg-card p-4 text-sm space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-base">{c.full_name || "(sem nome)"}</div>
                          <div className="text-xs text-muted-foreground">{c.email}</div>
                          <div className="text-xs mt-0.5">{c.phone} {c.city && `· ${c.city}/${c.state}`}</div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5">
                            <Calendar className="h-3 w-3" />
                            <span>Cadastrado em: {new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                          {c.updated_at && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                              <Clock className="h-3 w-3" />
                              <span>Último acesso/atualização: {new Date(c.updated_at).toLocaleDateString("pt-BR")}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs shrink-0">
                          <div className="font-bold text-primary text-sm">{co.length} pedido(s)</div>
                          <div className="text-muted-foreground font-medium mt-0.5">{formatBRL(totalSpent)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetails(c)}
                          className="h-8 text-xs gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver detalhes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteCustomer(c.id, c.full_name)}
                          className="h-8 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={customerPage === 1}
                    onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {customerPage} de {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={customerPage === totalPages}
                    onClick={() => setCustomerPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              )}
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

        {/* Customer Details Modal */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Cliente</DialogTitle>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-4 text-sm">
                <div className="space-y-2 rounded-xl bg-secondary/40 p-4">
                  <div className="font-bold text-lg text-primary">{selectedCustomer.full_name || "(sem nome)"}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block">E-mail</span>
                      <span className="font-medium">{selectedCustomer.email || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Telefone</span>
                      <span className="font-medium">{selectedCustomer.phone || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Data de Cadastro</span>
                      <span className="font-medium">{new Date(selectedCustomer.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Última Atualização</span>
                      <span className="font-medium">{new Date(selectedCustomer.updated_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border p-4">
                  <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Endereço de Entrega</div>
                  <div className="space-y-1 text-xs">
                    <p><span className="text-muted-foreground">Logradouro:</span> <span className="font-medium">{selectedCustomer.address || "—"}</span></p>
                    <p><span className="text-muted-foreground">Complemento:</span> <span className="font-medium">{selectedCustomer.complement || "—"}</span></p>
                    <p><span className="text-muted-foreground">Cidade/Estado:</span> <span className="font-medium">{[selectedCustomer.city, selectedCustomer.state].filter(Boolean).join("/") || "—"}</span></p>
                    <p><span className="text-muted-foreground">CEP:</span> <span className="font-medium">{selectedCustomer.zip || "—"}</span></p>
                  </div>
                </div>

                {/* Customer Orders Summary */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Histórico de Pedidos</div>
                  {(() => {
                    const customerOrders = orders.filter(
                      (o) =>
                        o.customer_phone === selectedCustomer.phone ||
                        (selectedCustomer.user_id && (o as any).user_id === selectedCustomer.user_id)
                    );

                    if (customerOrders.length === 0) {
                      return <p className="text-xs text-muted-foreground italic">Nenhum pedido realizado por este cliente.</p>;
                    }

                    return (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {customerOrders.map((o) => (
                          <div key={o.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-2.5 text-xs">
                            <div>
                              <div className="font-semibold">Pedido #{o.order_number ?? o.id.slice(0, 8)}</div>
                              <div className="text-muted-foreground text-[10px]">
                                {new Date(o.created_at).toLocaleDateString("pt-BR")} · {STATUS_LABELS[o.status] ?? o.status}
                              </div>
                            </div>
                            <div className="font-bold text-primary">{formatBRL(Number(o.total))}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Admin2FAGuard>
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