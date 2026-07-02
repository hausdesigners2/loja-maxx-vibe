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
    const mpAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");

    if (!mpAccessToken) {
      console.error("[mercadopago-webhook] Erro: MERCADO_PAGO_ACCESS_TOKEN não configurado.");
      return new Response(JSON.stringify({ error: "MERCADO_PAGO_ACCESS_TOKEN não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Recebe o payload do webhook do Mercado Pago
    const payload = await req.json();
    console.log("[mercadopago-webhook] Recebido payload do webhook:", JSON.stringify(payload));

    // O Mercado Pago envia notificações de diferentes tipos. O tipo que nos interessa é "payment"
    const resourceId = payload.data?.id || payload.resource;
    const topic = payload.type || payload.topic;

    if (topic !== "payment" || !resourceId) {
      console.log(`[mercadopago-webhook] Ignorando notificação do tipo: ${topic}`);
      return new Response(JSON.stringify({ success: true, message: "Ignorado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Consulta os detalhes do pagamento diretamente na API do Mercado Pago para garantir segurança e integridade
    console.log(`[mercadopago-webhook] Consultando pagamento ${resourceId} no Mercado Pago...`);
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`
      }
    });

    if (!mpResponse.ok) {
      console.error(`[mercadopago-webhook] Erro ao consultar pagamento no Mercado Pago: ${mpResponse.status}`);
      return new Response(JSON.stringify({ error: "Erro ao consultar pagamento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const paymentData = await mpResponse.json();
    const orderId = paymentData.external_reference;
    const status = paymentData.status; // "approved", "pending", "cancelled", "rejected", etc.

    if (!orderId) {
      console.warn("[mercadopago-webhook] external_reference (orderId) não encontrado no pagamento.");
      return new Response(JSON.stringify({ error: "external_reference não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Busca o pedido correspondente no Supabase
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.warn("[mercadopago-webhook] Pedido não encontrado no Supabase para o ID:", orderId);
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Mapeia o status do Mercado Pago para o status do nosso sistema
    let orderStatus = order.status;
    let paymentStatus = status;

    if (status === "approved") {
      orderStatus = "paid"; // Pago / Confirmado
      paymentStatus = "approved";
    } else if (status === "cancelled" || status === "rejected") {
      orderStatus = "cancelled"; // Cancelado
      paymentStatus = status;
    }

    // Se o status mudou para pago (approved) e o pedido ainda não estava marcado como pago, reduzimos o estoque
    const isNewlyPaid = orderStatus === "paid" && order.status !== "paid";

    // Atualiza o pedido no Supabase de forma resiliente
    try {
      const { error: updateError } = await supabaseClient
        .from("orders")
        .update({
          status: orderStatus,
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        } as any)
        .eq("id", order.id);

      if (updateError) {
        if (updateError.code === "PGRST204") {
          console.log("[mercadopago-webhook] Coluna payment_status não existe no banco. Atualizando apenas status.");
          const { error: fallbackError } = await supabaseClient
            .from("orders")
            .update({
              status: orderStatus,
              updated_at: new Date().toISOString()
            } as any)
            .eq("id", order.id);
          
          if (fallbackError) {
            console.error("[mercadopago-webhook] Erro no update de fallback:", fallbackError);
            throw fallbackError;
          }
        } else {
          console.error("[mercadopago-webhook] Erro ao atualizar pedido no Supabase:", updateError);
          throw updateError;
        }
      }
    } catch (dbErr) {
      console.error("[mercadopago-webhook] Exceção ao atualizar banco de dados:", dbErr);
      return new Response(JSON.stringify({ error: "Erro ao atualizar pedido" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[mercadopago-webhook] Pedido ${order.id} atualizado com sucesso para status: ${orderStatus}`);

    // Se o pagamento foi aprovado agora, reduz o estoque de cada item do pedido
    if (isNewlyPaid && order.order_items) {
      console.log(`[mercadopago-webhook] Reduzindo estoque para os itens do pedido ${order.id}...`);
      for (const item of order.order_items) {
        if (item.product_id) {
          // Busca o estoque atual do produto
          const { data: product } = await supabaseClient
            .from("products")
            .select("stock")
            .eq("id", item.product_id)
            .maybeSingle();

          if (product) {
            const newStock = Math.max(0, (product.stock || 0) - (item.quantity || 0));
            await supabaseClient
              .from("products")
              .update({ stock: newStock })
              .eq("id", item.product_id);
            console.log(`[mercadopago-webhook] Estoque do produto ${item.product_id} atualizado de ${product.stock} para ${newStock}`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[mercadopago-webhook] Erro geral no processamento do webhook:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})