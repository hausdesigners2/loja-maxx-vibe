import { supabase } from "@/integrations/supabase/client";
import { CartItem } from "@/contexts/CartContext";
import { finalPrice } from "./format";
import { CustomerInfo } from "./whatsapp";

export async function createOrder(
  items: CartItem[],
  customer: CustomerInfo,
  userId: string | null,
) {
  const total = items.reduce(
    (s, it) => s + finalPrice(it.price, it.discount_percent) * it.quantity,
    0,
  );

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
