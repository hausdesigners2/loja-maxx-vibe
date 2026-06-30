import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Recebe o payload do webhook da InfinitePay
    const payload = await req.json();
    console.log("[infinitepay-webhook] Recebido payload:", JSON.stringify(payload));

    // Extrai informações do pagamento
    // Estrutura típica da InfinitePay: { id, status, amount, metadata: { order_id } } ou similar
    const paymentId = payload.id || payload.payment_id;
    const status = payload.status; // "approved", "paid", "expired", "cancelled", etc.
    const orderId = payload.metadata?.order_id || payload.reference_id;

    if (!paymentId) {
      return new Response(JSON.stringify({ error: "payment_id não identificado no payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Busca o pedido correspondente pelo payment_id ou orderId
    let query = supabaseClient.from("orders").select("*");
    if (orderId) {
      query = query.eq("id", orderId);
    } else {
      query = query.eq("payment_id", paymentId);
    }

    const { data: order, error: orderError } = await query.maybeSingle();

    if (orderError || !order) {
      console.warn("[infinitepay-webhook] Pedido não encontrado para o pagamento:", paymentId);
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
      updatePayload.transaction_id = payload.transaction_id || paymentId;
    }

    const { error: updateError } = await supabaseClient
      .from("orders")
      .update(updatePayload)
      .eq("id", order.id);

    if (updateError) {
      console.error("[infinitepay-webhook] Erro ao atualizar pedido:", updateError);
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
    console.error("[infinitepay-webhook] Erro geral:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})