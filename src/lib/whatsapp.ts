// 🔧 TROQUE este número pelo seu WhatsApp (formato internacional, só dígitos)
export const WHATSAPP_NUMBER = "5511999999999";

import { CartItem } from "@/contexts/CartContext";
import { formatBRL, finalPrice } from "./format";

export interface CustomerInfo {
  full_name: string;
  phone: string;
  address: string;
  complement?: string;
  city?: string;
  state?: string;
  zip?: string;
  payment_method?: string;
}

export function buildWhatsAppOrder(items: CartItem[], customer?: CustomerInfo): string {
  const lines = items.map((it) => {
    const price = finalPrice(it.price, it.discount_percent);
    return `• ${it.quantity}x ${it.name} — ${formatBRL(price * it.quantity)}`;
  });
  const total = items.reduce(
    (sum, it) => sum + finalPrice(it.price, it.discount_percent) * it.quantity,
    0
  );

  const customerBlock = customer
    ? `\n*👤 Cliente:* ${customer.full_name}` +
      `\n*📞 Telefone:* ${customer.phone}` +
      `\n*📍 Endereço:* ${customer.address}` +
      (customer.complement ? ` — ${customer.complement}` : "") +
      (customer.city || customer.state
        ? `\n*🏙️ Cidade:* ${[customer.city, customer.state].filter(Boolean).join(" / ")}`
        : "") +
      (customer.zip ? `\n*CEP:* ${customer.zip}` : "") +
      (customer.payment_method ? `\n*💳 Pagamento:* ${customer.payment_method}` : "") +
      `\n`
    : "";

  const msg =
    `*🛒 Novo pedido — Lojas Maxx*\n` +
    customerBlock +
    `\n*Itens:*\n` +
    lines.join("\n") +
    `\n\n*Total: ${formatBRL(total)}*\n\nPor favor, confirmar disponibilidade e forma de entrega. Obrigado!`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}
