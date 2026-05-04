import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL, finalPrice } from "@/lib/format";
import { buildWhatsAppOrder, CustomerInfo } from "@/lib/whatsapp";
import { createOrder } from "@/lib/checkout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const emptyCustomer: CustomerInfo = {
  full_name: "", phone: "", address: "", complement: "", city: "", state: "", zip: "",
};

export default function CartPage() {
  const { items, setQty, remove, clear } = useCart();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<CustomerInfo>(emptyCustomer);
  const [submitting, setSubmitting] = useState(false);
  const total = items.reduce((s, it) => s + finalPrice(it.price, it.discount_percent) * it.quantity, 0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("customer_profiles")
        .select("full_name, phone, address, complement, city, state, zip")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setCustomer({ ...emptyCustomer, ...data });
    })();
  }, [user]);

  const checkout = async () => {
    if (!customer.full_name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      toast.error("Preencha nome, telefone e endereço.");
      return;
    }
    setSubmitting(true);
    try {
      await createOrder(items, customer, user?.id ?? null);
      if (user) {
        await supabase.from("customer_profiles").upsert(
          { user_id: user.id, email: user.email, ...customer },
          { onConflict: "user_id" },
        );
      }
      const url = buildWhatsAppOrder(items, customer);
      clear();
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Pedido registrado! Abrindo WhatsApp...");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao registrar pedido";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-secondary">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Seu carrinho está vazio</h2>
            <p className="text-sm text-muted-foreground">Adicione produtos para continuar.</p>
          </div>
          <Button asChild className="gradient-primary"><Link to="/">Explorar produtos</Link></Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 animate-fade-in pb-8">
        <h1 className="text-2xl font-extrabold">Carrinho</h1>

        <div className="space-y-2">
          {items.map((it) => {
            const price = finalPrice(it.price, it.discount_percent);
            return (
              <div key={it.id} className="flex gap-3 rounded-2xl bg-card p-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                  ) : <div className="grid h-full place-items-center text-2xl">📦</div>}
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-medium">{it.name}</h3>
                    <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(it.id, it.quantity - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-secondary"><Minus className="h-3 w-3" /></button>
                      <span className="w-5 text-center text-sm font-bold">{it.quantity}</span>
                      <button onClick={() => setQty(it.id, it.quantity + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-secondary"><Plus className="h-3 w-3" /></button>
                    </div>
                    <span className="text-sm font-extrabold text-primary">{formatBRL(price * it.quantity)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={clear} className="text-xs text-muted-foreground underline">Esvaziar carrinho</button>

        <div className="rounded-2xl bg-card p-4 space-y-3">
          <h2 className="text-sm font-bold">Dados para entrega</h2>
          <F label="Nome completo *" v={customer.full_name} on={(v) => setCustomer({ ...customer, full_name: v })} />
          <F label="Telefone (WhatsApp) *" v={customer.phone} on={(v) => setCustomer({ ...customer, phone: v })} placeholder="(11) 99999-9999" />
          <div>
            <Label className="text-xs">Endereço *</Label>
            <Textarea rows={2} value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Rua, número, bairro" />
          </div>
          <F label="Complemento" v={customer.complement ?? ""} on={(v) => setCustomer({ ...customer, complement: v })} />
          <div className="grid grid-cols-2 gap-2">
            <F label="Cidade" v={customer.city ?? ""} on={(v) => setCustomer({ ...customer, city: v })} />
            <F label="UF" v={customer.state ?? ""} on={(v) => setCustomer({ ...customer, state: v })} />
          </div>
          <F label="CEP" v={customer.zip ?? ""} on={(v) => setCustomer({ ...customer, zip: v })} />
        </div>

        <div className="sticky bottom-20 space-y-3 rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-extrabold text-primary">{formatBRL(total)}</span>
          </div>
          <Button size="lg" onClick={checkout} disabled={submitting} className="h-14 w-full gradient-primary text-base font-bold shadow-glow">
            {submitting ? "Processando..." : "Finalizar pelo WhatsApp"}
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 w-full text-sm font-semibold">
            <Link to="/">Continuar comprando</Link>
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">Seu pedido será salvo e enviado via WhatsApp com seus dados.</p>
        </div>
      </div>
    </AppShell>
  );
}

function F({ label, v, on, placeholder }: { label: string; v: string; on: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} className="h-10" />
    </div>
  );
}
