import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Shield, User as UserIcon, Heart, ShoppingBag, Save, Package, Pencil, CreditCard } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL, finalPrice } from "@/lib/format";

interface OrderRow { id: string; created_at: string; total: number; status: string; order_number?: number | null }
interface OrderItem { id: string; product_name: string; quantity: number; unit_price: number; discount_percent: number; subtotal: number }
interface OrderFull extends OrderRow {
  customer_name: string | null; customer_phone: string | null;
  customer_address: string | null; customer_complement: string | null;
  customer_city: string | null; customer_state: string | null; customer_zip: string | null;
  payment_method: string | null; change_for: number | null;
}

const paymentLabel = (m: string | null) => {
  const map: Record<string, string> = {
    cash: "Dinheiro", pix: "Pix", debit: "Débito", credit: "Crédito",
    machine: "Maquininha", awaiting_machine: "Aguardando maquininha",
    machine_on_delivery: "À receber na maquininha",
  };
  return m ? (map[m] ?? m) : "—";
};

const customerStatusLabel = (s: string) => {
  if (s === "delivered" || s === "completed") return "Entregue";
  if (s === "paid") return "Pedido confirmado";
  if (s === "cancelled") return "Cancelado";
  if (s === "awaiting_machine") return "Aguardando maquininha";
  return "Pendente";
};

interface Profile {
  full_name: string;
  phone: string;
  address: string;
  complement: string;
  city: string;
  state: string;
  zip: string;
}

const empty: Profile = { full_name: "", phone: "", address: "", complement: "", city: "", state: "", zip: "" };

export default function AccountPage() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(empty);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderFull | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchOrdersAndProfile = async () => {
      const { data } = await supabase
        .from("customer_profiles")
        .select("full_name, phone, address, complement, city, state, zip")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile({ ...empty, ...data });

      const { data: ord } = await supabase
        .from("orders")
        .select("id, created_at, total, status, order_number")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Filtra os pedidos para exibir apenas os criados nos últimos 10 dias
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      
      const filteredOrders = (ord ?? []).filter((o) => {
        const orderDate = new Date(o.created_at);
        return orderDate >= tenDaysAgo;
      });

      setOrders(filteredOrders as OrderRow[]);
    };

    fetchOrdersAndProfile();

    // Sincronização em tempo real com Supabase Realtime
    const channel = supabase
      .channel(`user-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchOrdersAndProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Mantém o modal de detalhes do pedido atualizado em tempo real
  useEffect(() => {
    if (selectedOrder && orders.length > 0) {
      const updated = orders.find((o) => o.id === selectedOrder.id);
      if (updated && updated.status !== selectedOrder.status) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: updated.status } : null));
      }
    }
  }, [orders, selectedOrder]);

  const openOrder = async (id: string) => {
    if (!user) return;
    setLoadingOrder(true);
    setSelectedOrder({ id, created_at: "", total: 0, status: "" } as OrderFull);
    const [{ data: ord }, { data: items }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("order_items").select("id, product_name, quantity, unit_price, discount_percent, subtotal").eq("order_id", id),
    ]);
    setLoadingOrder(false);
    if (!ord) { setSelectedOrder(null); toast.error("Pedido não encontrado"); return; }
    setSelectedOrder(ord as OrderFull);
    setSelectedItems((items ?? []) as OrderItem[]);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("customer_profiles")
      .upsert({ user_id: user.id, email: user.email, ...profile }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dados salvos com sucesso!");
    setEditing(false);
  };

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-secondary">
            <UserIcon className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">Entrar na Lojas Maxx</h1>
          <p className="max-w-xs text-sm text-muted-foreground">Faça login ou crie sua conta para aproveitar todas as vantagens!</p>
          <Button asChild className="gradient-primary shadow-glow"><Link to="/auth">Entrar / Criar conta</Link></Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5 animate-fade-in pb-8">
        <div className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full gradient-primary text-lg font-bold text-primary-foreground">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold">{user.email}</p>
              {isAdmin && <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Shield className="h-3 w-3" /> Administrador</span>}
            </div>
          </div>
        </div>

        {!editing ? (
          <div className="rounded-2xl bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Meus dados</h2>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3 w-3" /> Editar dados
              </Button>
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{profile.full_name || "—"}</span></p>
              <p><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{profile.phone || "—"}</span></p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-4 space-y-3">
            <h2 className="text-sm font-bold">Meus dados</h2>
            <Field label="Nome completo" v={profile.full_name} on={(v) => setProfile({ ...profile, full_name: v })} />
            <Field label="Telefone (WhatsApp)" v={profile.phone} on={(v) => setProfile({ ...profile, phone: v })} placeholder="(11) 99999-9999" />
            <Field label="Endereço" v={profile.address} on={(v) => setProfile({ ...profile, address: v })} placeholder="Rua, número, bairro" />
            <Field label="Complemento" v={profile.complement} on={(v) => setProfile({ ...profile, complement: v })} placeholder="Apto, casa..." />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cidade" v={profile.city} on={(v) => setProfile({ ...profile, city: v })} />
              <Field label="UF" v={profile.state} on={(v) => setProfile({ ...profile, state: v })} />
            </div>
            <Field label="CEP" v={profile.zip} on={(v) => setProfile({ ...profile, zip: v })} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">Cancelar</Button>
              <Button onClick={save} disabled={saving} className="flex-1 gradient-primary">
                <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}

        {orders.length > 0 && (
          <div className="rounded-2xl bg-card p-4 space-y-2">
            <h2 className="text-sm font-bold flex items-center gap-2"><Package className="h-4 w-4" /> Meus pedidos (últimos 10 dias)</h2>
            {orders.map((o) => (
              <button
                type="button"
                key={o.id}
                onClick={() => openOrder(o.id)}
                className="flex w-full items-center justify-between border-t border-border pt-2 text-left text-xs transition-colors hover:bg-secondary/30 rounded-md px-1"
              >
                <div>
                  <div className="font-semibold">#{o.order_number ?? o.id.slice(0, 8)}</div>
                  <div className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")} · {customerStatusLabel(o.status)}</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="font-bold text-primary">{formatBRL(Number(o.total))}</div>
                  <span className="text-[11px] text-primary underline underline-offset-2">Ver detalhes</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Link to="/favoritos" className="flex items-center gap-3 rounded-2xl bg-card p-4">
            <Heart className="h-5 w-5 text-primary" /> <span className="text-sm font-medium">Meus favoritos</span>
          </Link>
          <Link to="/carrinho" className="flex items-center gap-3 rounded-2xl bg-card p-4">
            <ShoppingBag className="h-5 w-5 text-primary" /> <span className="text-sm font-medium">Meu carrinho</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/30">
              <Shield className="h-5 w-5 text-primary" /> <span className="text-sm font-bold text-primary">Painel administrativo</span>
            </Link>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(o) => { if (!o) { setSelectedOrder(null); setSelectedItems([]); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{selectedOrder?.order_number ?? selectedOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {loadingOrder || !selectedOrder?.status ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : selectedOrder && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-secondary/40 p-3">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-bold text-primary">{customerStatusLabel(selectedOrder.status)}</div>
              </div>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Data:</span> <span className="font-medium">{new Date(selectedOrder.created_at).toLocaleString("pt-BR")}</span></p>
                <p><span className="text-muted-foreground">Pagamento:</span> <span className="font-medium">{paymentLabel(selectedOrder.payment_method)}{selectedOrder.payment_method === "cash" && selectedOrder.change_for ? ` (troco p/ ${formatBRL(Number(selectedOrder.change_for))})` : ""}</span></p>
              </div>

              {/* Botão de Pagamento Pix se o pedido estiver pendente e for Pix */}
              {selectedOrder.status === "pending" && (selectedOrder.payment_method === "Pix" || selectedOrder.payment_method === "pix") && (
                <Button
                  onClick={() => {
                    setSelectedOrder(null);
                    navigate(`/pagamento/pix/${selectedOrder.id}`);
                  }}
                  className="w-full h-12 gradient-primary font-bold shadow-glow flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-5 w-5" /> Pagar com Pix
                </Button>
              )}

              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Cliente</div>
                <p className="font-medium">{selectedOrder.customer_name || "—"}</p>
                <p className="text-muted-foreground">{selectedOrder.customer_phone || "—"}</p>
                <p className="text-muted-foreground">
                  {[selectedOrder.customer_address, selectedOrder.customer_complement].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-muted-foreground">
                  {[selectedOrder.customer_city, selectedOrder.customer_state].filter(Boolean).join("/")} {selectedOrder.customer_zip || ""}
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Produtos</div>
                {selectedItems.map((it) => {
                  const unit = finalPrice(Number(it.unit_price), it.discount_percent || 0);
                  return (
                    <div key={it.id} className="flex justify-between gap-2 border-t border-border pt-2 text-xs">
                      <div className="flex-1">
                        <div className="font-medium">{it.product_name}</div>
                        <div className="text-muted-foreground">{it.quantity} × {formatBRL(unit)}</div>
                      </div>
                      <div className="font-semibold">{formatBRL(Number(it.subtotal))}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
                <span>Total</span>
                <span className="text-primary">{formatBRL(Number(selectedOrder.total))}</span>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Pedido somente para consulta. Não é possível editar.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, v, on, placeholder }: { label: string; v: string; on: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} className="h-10" />
    </div>
  );
}