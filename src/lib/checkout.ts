import { supabase } from "@/integrations/supabase/client";
import { CartItem } from "@/contexts/CartContext";
import { finalPrice } from "./format";
import { CustomerInfo } from "./whatsapp";

export async function createOrder(
  items: CartItem[],
  customer: CustomerInfo,
  userId: string | null,
  extras?: { change_for?: number | null; notes?: string | null },
) {
  const total = items.reduce(
    (s, it) => s + finalPrice(it.price, it.discount_percent) * it.quantity,
    0,
  );

  const method = customer.payment_method || "Pix";
  // Cartão débito/crédito = "À receber na maquininha" => status awaiting_machine
  const initialStatus =
    method === "Débito" || method === "Crédito" ? "awaiting_machine" : "pending";

  // Se for um pedido de visitante (userId nulo), chama a Edge Function segura
  if (!userId) {
    const response = await fetch("https://tnpcrxconafliiuhszcx.supabase.co/functions/v1/guest-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items, customer, extras })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(errText);
      } catch {
        parsedError = { error: errText };
      }
      throw new Error(parsedError.error || "Falha ao criar pedido de visitante.");
    }

    const data = await response.json();
    if (data.guest_token && typeof window !== "undefined") {
      try {
        localStorage.setItem(`loja-maxx-guest-token-${data.order.id}`, data.guest_token);
      } catch (e) {
        console.error("[Checkout] Erro ao salvar token de visitante no localStorage:", e);
      }
    }
    return data.order;
  }

  // Fluxo de usuário autenticado (inserção direta)
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      customer_name: customer.full_name,
      customer_phone: customer.phone,
      customer_address: customer.address,
      customer_complement: customer.complement || null,
      customer_city: customer.city || null,
      customer_state: customer.state || null,
      customer_zip: customer.zip || null,
      total,
      payment_method: method,
      change_for: extras?.change_for ?? null,
      notes: extras?.notes ?? null,
      status: initialStatus,
    })
    .select()
    .single();

  if (error || !order) throw error ?? new Error("Falha ao criar pedido");

  const itemsPayload = items.map((it) => {
    const unit = finalPrice(it.price, it.discount_percent);
    return {
      order_id: order.id,
      product_id: it.id,
      product_name: it.name,
      unit_price: it.price,
      discount_percent: it.discount_percent,
      quantity: it.quantity,
      subtotal: unit * it.quantity,
    };
  });

  const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
  if (itemsErr) throw itemsErr;

  return order;
}

export async function logSearch(term: string, resultsCount: number, userId: string | null) {
  const t = term.trim();
  if (!t) return;
  await supabase.from("search_history").insert({
    term: t.slice(0, 200),
    results_count: resultsCount,
    user_id: userId,
  });
}