import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Recebe o payload do webhook da InfinitePay
    const payload = await req.json();
    console.log("[infinitepay-webhook] Recebido payload oficial:", JSON.stringify(payload));

    // Extrai informações do pagamento conforme a API oficial de Checkout
    const orderNsu = payload.order_nsu || payload.metadata?.order_id || payload.reference_id;
    const status = payload.status; // "approved", "paid", "expired", "cancelled", etc.
    const paymentId = payload.id || payload.payment_id;

    if (!orderNsu) {
      console.error("[infinitepay-webhook] Erro: order_nsu não identificado no payload.");
      return new Response(JSON.stringify({ error: "order_nsu não identificado no payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Busca o pedido correspondente pelo order_nsu (que é o ID do pedido) ou pelo payment_id
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*")
      .or(`id.eq.${orderNsu},payment_id.eq.${paymentId || 'none'}`)
      .maybeSingle();

    if (orderError || !order) {
      console.warn("[infinitepay-webhook] Pedido não encontrado para o order_nsu:", orderNsu);
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Mapeia o status da InfinitePay para o Supabase
    let paymentStatus = "pending";
    let orderStatus = order.status;

    if (status === "approved" || status === "paid" || status === "confirmed") {
      paymentStatus = "Pago";
      orderStatus = "paid"; // "paid" é o status de aprovado/pago no sistema
    } else if (status === "expired") {
      paymentStatus = "Expirado";
      orderStatus = "cancelled";
    } else if (status === "cancelled") {
      paymentStatus = "Cancelado";
      orderStatus = "cancelled";
    }

    // Atualiza o pedido no Supabase
    const updatePayload: any = {
      payment_status: paymentStatus,
      status: orderStatus,
      updated_at: new Date().toISOString()
    };

    if (paymentStatus === "Pago") {
      updatePayload.paid_at = new Date().toISOString();
      updatePayload.transaction_id = paymentId || orderNsu;
    }

    const { error: updateError } = await supabaseClient
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);

    if (updateError) {
      console.error("[infinitepay-webhook] Erro ao atualizar pedido no Supabase:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar pedido" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[infinitepay-webhook] Pedido ${order.id} atualizado com sucesso para status: ${orderStatus}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[infinitepay-webhook] Erro geral no processamento do webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})