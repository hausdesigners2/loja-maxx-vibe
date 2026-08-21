import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  delivered: "Entregue",
  cancelled: "Cancelado",
  awaiting_machine: "À receber na Maquininha",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[telegram-notification] Received notification request");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!telegramBotToken || !telegramChatId) {
      console.error("[telegram-notification] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables.");
      return new Response(JSON.stringify({ error: "Telegram configuration missing on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, status } = await req.json();

    if (!order_id) {
      console.error("[telegram-notification] Missing order_id");
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch order details with items
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("[telegram-notification] Error fetching order:", orderError);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const orderNumber = order.order_number || order.id.slice(0, 8);
    const customerName = order.customer_name || "Cliente";
    const customerPhone = order.customer_phone || "Não informado";
    const paymentMethod = order.payment_method || "Não informado";
    const statusLabel = STATUS_LABELS[status || order.status] || status || order.status;
    const totalFormatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(order.total));

    // Format items list
    const itemsList = (order.order_items || [])
      .map((it: any) => `• ${it.quantity}x ${it.product_name} - ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(it.subtotal))}`)
      .join("\n");

    // Build HTML message for Telegram
    const message = `<b>🛒 Atualização de Pedido - Lojas Maxx</b>\n\n` +
      `<b>Pedido:</b> #${orderNumber}\n` +
      `<b>Cliente:</b> ${customerName}\n` +
      `<b>Telefone:</b> ${customerPhone}\n` +
      `<b>Forma de Pagamento:</b> ${paymentMethod}\n` +
      `<b>Status:</b> ${statusLabel}\n\n` +
      `<b>Itens:</b>\n${itemsList}\n\n` +
      `<b>Total:</b> ${totalFormatted}`;

    console.log(`[telegram-notification] Sending message to Telegram chat ${telegramChatId}`);

    const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: "HTML"
      })
    });

    const resData = await response.json();
    console.log("[telegram-notification] Telegram API response:", JSON.stringify(resData));

    if (!response.ok) {
      throw new Error(`Telegram API returned error: ${JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[telegram-notification] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});