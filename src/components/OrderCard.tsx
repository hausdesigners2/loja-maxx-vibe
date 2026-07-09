import { useState } from "react";
import { Printer, Check, X, Truck, CreditCard, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { OrderRow } from "@/pages/AdminDashboardPage";
import { formatBRL } from "@/lib/format";
import { printOrder } from "@/lib/printOrder";
import { Button } from "@/components/ui/button";

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

interface OrderCardProps {
  order: OrderRow;
  onStatus: (id: string, status: string) => Promise<void>;
}

export function OrderCard({ order, onStatus }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl bg-card p-4 text-sm space-y-3 border border-border/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-base">Pedido #{order.order_number ?? order.id.slice(0, 8)}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleString("pt-BR")}
          </div>
          <div className="text-xs mt-1">
            <span className="font-semibold">{order.customer_name}</span> · {order.customer_phone}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-extrabold text-primary text-base">{formatBRL(Number(order.total))}</div>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold mt-1 ${STATUS_COLORS[order.status] ?? "bg-muted"}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
        <div className="flex flex-wrap gap-1.5">
          {order.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatus(order.id, "paid")}
                className="h-8 text-xs gap-1 border-green-500/30 text-green-500 hover:bg-green-500/10"
              >
                <Check className="h-3.5 w-3.5" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatus(order.id, "cancelled")}
                className="h-8 text-xs gap-1 border-red-500/30 text-red-500 hover:bg-red-500/10"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </>
          )}
          {order.status === "awaiting_machine" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatus(order.id, "paid")}
              className="h-8 text-xs gap-1 border-green-500/30 text-green-500 hover:bg-green-500/10"
            >
              <CreditCard className="h-3.5 w-3.5" /> Confirmar Pagamento
            </Button>
          )}
          {order.status === "paid" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatus(order.id, "delivered")}
              className="h-8 text-xs gap-1 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                >
              <Truck className="h-3.5 w-3.5" /> Entregar
            </Button>
          )}
        </div>

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => printOrder(order)}
            className="h-8 text-xs gap-1"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded(!expanded)}
            className="h-8 text-xs gap-1"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Detalhes
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="pt-3 border-t border-border/50 space-y-3 text-xs animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-secondary/30 p-3 rounded-xl">
            <div>
              <span className="text-muted-foreground block">Endereço de Entrega</span>
              <span className="font-medium">
                {order.customer_address}
                {order.customer_complement ? ` — ${order.customer_complement}` : ""}
                {order.customer_city ? ` · ${order.customer_city}/${order.customer_state}` : ""}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Forma de Pagamento</span>
              <span className="font-medium">
                {order.payment_method}
                {order.change_for ? ` (Troco para ${formatBRL(Number(order.change_for))})` : ""}
              </span>
            </div>
            {order.notes && (
              <div className="col-span-1 sm:col-span-2">
                <span className="text-muted-foreground block">Observações</span>
                <span className="font-medium italic">"{order.notes}"</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-muted-foreground font-semibold block">Itens do Pedido</span>
            {order.order_items?.map((it, idx) => (
              <div key={idx} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
                <span>{it.quantity}x {it.product_name}</span>
                <span className="font-semibold">{formatBRL(Number(it.subtotal))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}