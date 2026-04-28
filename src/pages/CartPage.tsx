import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { formatBRL, finalPrice } from "@/lib/format";
import { buildWhatsAppOrder } from "@/lib/whatsapp";

export default function CartPage() {
  const { items, setQty, remove, clear } = useCart();
  const total = items.reduce((s, it) => s + finalPrice(it.price, it.discount_percent) * it.quantity, 0);

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
      <div className="space-y-4 animate-fade-in">
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

        <div className="sticky bottom-20 space-y-3 rounded-2xl bg-card p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-extrabold text-primary">{formatBRL(total)}</span>
          </div>
          <a href={buildWhatsAppOrder(items)} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="h-14 w-full gradient-primary text-base font-bold shadow-glow">
              Finalizar pelo WhatsApp
            </Button>
          </a>
          <p className="text-center text-[11px] text-muted-foreground">Você será redirecionado para o WhatsApp com o pedido pronto.</p>
        </div>
      </div>
    </AppShell>
  );
}
