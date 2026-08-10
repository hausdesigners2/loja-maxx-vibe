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

  // Se for um pedido de visitante (userId nulo), gera um token seguro e não adivinhável
  let guestToken = "";
  let finalNotes = extras?.notes ?? null;

  if (!userId) {
    if (typeof window !== "undefined" && window.crypto) {
      const array = new Uint32Array(4);
      window.crypto.getRandomValues(array);
      guestToken = Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('');
    } else {
      guestToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    
    // Anexa o token de visitante de forma segura nas notas do pedido para validação posterior
    const tokenMarker = `[GuestToken: ${guestToken}]`;
    finalNotes = finalNotes ? `${finalNotes} ${tokenMarker}` : tokenMarker;
  }

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
      notes: finalNotes,
      status: initialStatus,
    })
    .select()
    .single();

  if (error || !order) throw error ?? new Error("Falha ao criar pedido");

  // Se gerou um token de visitante, salva no localStorage associado ao ID do pedido
  if (!userId && guestToken && typeof window !== "undefined") {
    try {
      localStorage.setItem(`loja-maxx-guest-token-${order.id}`, guestToken);
    } catch (e) {
      console.error("[Checkout] Erro ao salvar token de visitante no localStorage:", e);
    }
  }

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