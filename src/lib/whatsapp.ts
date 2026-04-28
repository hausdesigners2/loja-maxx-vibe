// 🔧 TROQUE este número pelo seu WhatsApp (formato internacional, só dígitos)
export const WHATSAPP_NUMBER = "5511999999999";

import { CartItem } from "@/contexts/CartContext";
import { formatBRL, finalPrice } from "./format";

export function buildWhatsAppOrder(items: CartItem[]): string {
  const lines = items.map((it) => {
    const price = finalPrice(it.price, it.discount_percent);
    return `• ${it.quantity}x ${it.name} — ${formatBRL(price * it.quantity)}`;
  });
  const total = items.reduce(
    (sum, it) => sum + finalPrice(it.price, it.discount_percent) * it.quantity,
    0
  );
  const msg =
    `*🛒 Novo pedido — Loja Maxx*\n\n` +
    lines.join("\n") +
    `\n\n*Total: ${formatBRL(total)}*\n\nPor favor, confirmar disponibilidade e forma de entrega. Obrigado!`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}
