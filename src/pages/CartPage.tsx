import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, UserIcon, Pencil, CheckCircle2, ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatBRL, finalPrice } from "@/lib/format";
import { CustomerInfo } from "@/lib/whatsapp";
import { createOrder } from "@/lib/checkout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PAYMENT_METHODS = ["Pix", "Débito", "Crédito", "Dinheiro"] as const;

export default function CartPage() {
  const { items, setQty, remove, clear } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerInfo | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("Pix");
  const [changeFor, setChangeFor] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const total = items.reduce((s, it) => s + finalPrice(it.price, it.discount_percent) * it.quantity, 0);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    setLoadingProfile(true);
    (async () => {
      const { data } = await supabase
        .from("customer_profiles")
        .select("full_name, phone, address, complement, city, state, zip")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data ?? null);
      setLoadingProfile(false);
    })();
  }, [user]);

  const profileComplete = !!(profile?.full_name?.trim() && profile?.phone?.trim() && profile?.address?.trim());

  const checkout = async () => {
    if (!user || !profile || !profileComplete || items.length === 0) return;
    setSubmitting(true);
    try {
      const customer: CustomerInfo = { ...profile, payment_method: paymentMethod };
      const changeNum = paymentMethod === "Dinheiro" && changeFor.trim()
        ? Number(changeFor.replace(",", "."))
        : null;
      await createOrder(items, customer, user.id, {
        change_for: changeNum && !Number.isNaN(changeNum) ? changeNum : null,
        notes: notes.trim() || null,
      });
      
      // Exibe a notificação de sucesso na tela
      toast.success("Pedido Enviado!");
      
      setSubmitted(true);
      clear(); // Limpa o carrinho no estado e localStorage
      
      // Aguarda 5 segundos antes de retornar para a página inicial
      window.setTimeout(() => navigate("/"), 5000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao registrar pedido";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  // 1. Exibe a tela de sucesso personalizada APENAS quando o pedido for enviado com sucesso nesta sessão
  if (submitted) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Pedido Enviado com Sucesso</h2>
            <p className="text-sm text-muted-foreground mt-1">Agradecimento por sua preferência!</p>
          </div>
          <Button asChild className="gradient-primary shadow-glow mt-2">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  // 2. Exibe a tela de carrinho vazio se não houver itens e não tiver acabado de enviar um pedido
  if (items.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-secondary text-muted-foreground">
            <ShoppingCart className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Seu carrinho está vazio</h2>
            <p className="text-sm text-muted-foreground mt-1">Adicione produtos para continuar sua compra.</p>
          </div>
          <Button asChild className="gradient-primary shadow-glow mt-2">
            <Link to="/">Continuar comprando</Link>
          </Button>
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
                    <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive" disabled={submitted}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(it.id, it.quantity - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-secondary" disabled={submitted}><Minus className="h-3 w-3" /></button>
                      <span className="w-5 text-center text-sm font-bold">{it.quantity}</span>
                      <button onClick={() => setQty(it.id, it.quantity + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-secondary" disabled={submitted}><Plus className="h-3 w-3" /></button>
                    </div>
                    <span className="text-sm font-extrabold text-primary">{formatBRL(price * it.quantity)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!submitted && (
          <button onClick={clear} className="text-xs text-muted-foreground underline">Esvaziar carrinho</button>
        )}

        {/* Auth gate */}
        {!authLoading && !user && (
          <div className="rounded-2xl bg-card p-5 text-center space-y-3">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary">
              <UserIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-base font-bold">Entre para finalizar o pedido</h2>
              <p className="text-xs text-muted-foreground">Você precisa estar cadastrado para finalizar a compra.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild className="gradient-primary"><Link to="/auth">Entrar / Criar conta</Link></Button>
            </div>
          </div>
        )}

        {/* Profile summary */}
        {user && !loadingProfile && (
          <div className="rounded-2xl bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Dados de entrega</h2>
              <Button asChild size="sm" variant="outline" disabled={submitted}>
                <Link to="/conta"><Pencil className="mr-1 h-3 w-3" /> Editar</Link>
              </Button>
            </div>
            {profileComplete ? (
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{profile!.full_name}</span></p>
                <p><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{profile!.phone}</span></p>
                <p><span className="text-muted-foreground">Endereço:</span> <span className="font-medium">{profile!.address}{profile!.complement ? ` — ${profile!.complement}` : ""}</span></p>
                {(profile!.city || profile!.state) && (
                  <p><span className="text-muted-foreground">Cidade:</span> <span className="font-medium">{[profile!.city, profile!.state].filter(Boolean).join(" / ")}</span></p>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-secondary p-3 text-xs">
                <p className="font-semibold">Complete seus dados para finalizar.</p>
                <p className="text-muted-foreground mt-1">Precisamos de nome, telefone e endereço.</p>
                <Button asChild size="sm" className="mt-2 gradient-primary">
                  <Link to="/conta">Completar cadastro</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Payment method */}
        {user && profileComplete && (
          <div className="rounded-2xl bg-card p-4 space-y-2">
            <Label className="text-sm font-bold">Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={submitted}
                  onClick={() => setPaymentMethod(m)}
                  className={`h-10 rounded-lg border text-sm font-semibold transition ${
                    paymentMethod === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {paymentMethod === "Dinheiro" && (
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">Troco para (opcional)</Label>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={submitted}
                  value={changeFor}
                  onChange={(e) => setChangeFor(e.target.value)}
                  placeholder="Ex: 50,00"
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>
            )}
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground">Observações (opcional)</Label>
              <textarea
                value={notes}
                disabled={submitted}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex: entregar à tarde"
                className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
              />
            </div>
          </div>
        )}

        <div className="sticky bottom-20 space-y-3 rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-extrabold text-primary">{formatBRL(total)}</span>
          </div>
          {user ? (
            <Button
              size="lg"
              onClick={checkout}
              disabled={submitting || submitted || !profileComplete}
              className="h-14 w-full gradient-primary text-base font-bold shadow-glow"
            >
              {submitted ? "Pedido Enviado" : submitting ? "Processando..." : "Finalizar e Enviar"}
            </Button>
          ) : (
            <Button asChild size="lg" className="h-14 w-full gradient-primary text-base font-bold shadow-glow">
              <Link to="/auth">Entrar para finalizar</Link>
            </Button>
          )}
          <Button asChild size="lg" variant="outline" className="h-12 w-full text-sm font-semibold" disabled={submitting}>
            <Link to="/">Continuar comprando</Link>
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">Seu pedido será enviado para o lojista e ficará disponível em Meus pedidos.</p>
        </div>
      </div>
    </AppShell>
  );
}