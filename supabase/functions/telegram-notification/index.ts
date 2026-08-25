import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  delivered: "Entregue",
  cancelled: "Cancelado",
  awaiting_machine: "À receber na Maquininha",
};

// Função auxiliar para escapar caracteres HTML exigidos pelo parse_mode do Telegram
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[telegram-notification] Received notification request");

  const authHeader = req.headers.get('Authorization') || "";
  const webhookSecretHeader = req.headers.get('X-Webhook-Secret') || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET") || "secure_webhook_token_loja_maxx_2026";

  let isAuthorized = false;

  // 1. Validação via Service Role Key
  if (serviceKey && authHeader.includes(serviceKey)) {
    isAuthorized = true;
  }
  // 2. Validação via Webhook Secret
  else if (webhookSecretHeader === webhookSecret) {
    isAuthorized = true;
  }
  // 3. Validação via JWT de Administrador autenticado
  else if (authHeader) {
    try {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (!userError && user) {
        const adminClient = createClient(supabaseUrl, serviceKey);
        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        
        if (roleData?.role === "admin") {
          isAuthorized = true;
        }
      }
    } catch (err) {
      console.error("[telegram-notification] Error verifying user session:", err);
    }
  }

  if (!isAuthorized) {
    console.error("[telegram-notification] Unauthorized access attempt blocked.");
    return new Response(JSON.stringify({ error: "Unauthorized access" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!telegramBotToken || !telegramChatId) {
      console.error("[telegram-notification] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables.");
      return new Response(JSON.stringify({ error: "Telegram configuration missing on server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseClient = createClient(supabaseUrl, serviceKey);

    const { order_id, status } = await req.json();

    if (!order_id) {
      console.error("[telegram-notification] Missing order_id");
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[telegram-notification] Fetching order details for ID: ${order_id}`);

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

    const orderNumber = escapeHtml(String(order.order_number || order.id.slice(0, 8)));
    const customerName = escapeHtml(order.customer_name || "Cliente");
    const customerPhone = escapeHtml(order.customer_phone || "Não informado");
    const paymentMethod = escapeHtml(order.payment_method || "Não informado");
    const statusLabel = escapeHtml(STATUS_LABELS[status || order.status] || status || order.status);
    const totalFormatted = escapeHtml(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(order.total)));

    // Format items list safely
    const itemsList = (order.order_items || [])
      .map((it: any) => {
        const name = escapeHtml(it.product_name);
        const subtotal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(it.subtotal));
        return `• ${it.quantity}x ${name} - ${escapeHtml(subtotal)}`;
      })
      .join("\n");

    // Build HTML message for Telegram
    const message = `<b>🛒 Novo Pedido Recebido - Lojas Maxx</b>\n\n` +
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
    
    console.log(`[telegram-notification] Telegram API response status: ${response.status}`);
    console.log(`[telegram-notification] Telegram API response body:`, JSON.stringify(resData));

    if (!response.ok) {
      console.error(`[telegram-notification] Telegram API error details:`, JSON.stringify(resData));
      throw new Error(`Telegram API returned error: ${JSON.stringify(resData)}`);
    }

    console.log("[telegram-notification] Notification sent successfully to Telegram!");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[telegram-notification] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});