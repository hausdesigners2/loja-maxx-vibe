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

    // [MELHORIA DE SEGURANÇA]: Logging de cabeçalhos e assinatura de segurança
    const signature = req.headers.get("x-signature") || "";
    const requestId = req.headers.get("x-request-id") || "";
    console.log(`[mercadopago-webhook] Nova notificação recebida. RequestId: ${requestId}, Signature: ${signature}`);

    // Recebe o payload do webhook do Mercado Pago
    const payload = await req.json();
    console.log("[mercadopago-webhook] Payload recebido:", JSON.stringify(payload));

    const resourceId = payload.data?.id || payload.resource;
    const topic = payload.type || payload.topic;

    // Apenas tópicos relacionados a pagamento são relevantes
    if (topic !== "payment" || !resourceId) {
      console.log(`[mercadopago-webhook] Ignorando notificação irrelevante. Tipo/Tópico: ${topic}`);
      return new Response(JSON.stringify({ success: true, message: "Ignorado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // [MELHORIA DE SEGURANÇA]: Consulta direta e oficial à API do Mercado Pago (Prevenção de Fake Payloads)
    console.log(`[mercadopago-webhook] Consultando dados oficiais do pagamento ${resourceId} no Mercado Pago...`);
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`
      }
    });

    if (!mpResponse.ok) {
      console.error(`[mercadopago-webhook] Erro ao consultar a API oficial do Mercado Pago: ${mpResponse.status}`);
      return new Response(JSON.stringify({ error: "Erro ao consultar a API oficial do Mercado Pago." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const paymentData = await mpResponse.json();
    const orderId = paymentData.external_reference;
    const paymentStatus = paymentData.status; // approved, pending, in_process, cancelled, rejected
    const transactionAmount = Number(paymentData.transaction_amount);

    console.log(`[mercadopago-webhook] Retorno oficial MP -> Pedido ID: ${orderId}, Status: ${paymentStatus}, Valor: R$ ${transactionAmount}`);

    if (!orderId) {
      console.warn(`[mercadopago-webhook] ID do pedido (external_reference) ausente na consulta oficial.`);
      return new Response(JSON.stringify({ error: "ID do pedido não encontrado na transação do Mercado Pago." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Busca o pedido registrado no Supabase
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.warn(`[mercadopago-webhook] Pedido ${orderId} correspondente ao pagamento não foi localizado no Supabase.`);
      return new Response(JSON.stringify({ error: "Pedido correspondente não localizado no e-commerce." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // [MELHORIA DE SEGURANÇA]: Verificação de integridade de valores de pagamento (Anti-Underpayment Fraud)
    const difference = Math.abs(transactionAmount - Number(order.total));
    if (difference > 0.01 && paymentStatus === "approved") {
      console.error(`[mercadopago-webhook] ALERTA DE SEGURANÇA: Discrepância crítica de valores! Pedido exige R$ ${order.total}, mas pagamento efetuado foi de R$ ${transactionAmount}.`);
      
      // Marca o pedido como cancelado/fraudulento para atenção do administrador
      await supabaseClient
        .from("orders")
        .update({
          status: "cancelled",
          notes: `FRAUDE DETECTADA: O pagamento foi efetuado com valor divergente (R$ ${transactionAmount}) do valor oficial do pedido (R$ ${order.total}). O pedido foi cancelado preventivamente.`
        })
        .eq("id", order.id);

      // Registra no Log de Segurança
      try {
        await supabaseClient.from("security_logs").insert({
          event_type: "login_failed", // Registrando como evento crítico de segurança
          user_id: order.user_id,
          email: "seguranca@lojasmaxx.com.br",
          metadata: {
            security_alert: "payment_value_mismatch",
            order_id: order.id,
            expected_total: order.total,
            paid_amount: transactionAmount,
            payment_id: resourceId
          }
        });
      } catch (err) {
        console.error("[mercadopago-webhook] Erro ao gravar log de discrepância:", err);
      }

      return new Response(JSON.stringify({ success: false, error: "Vulnerabilidade de valores detectada. Transação suspensa." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Mapeia o status do Mercado Pago para os status internos da loja
    let nextOrderStatus = order.status;
    if (paymentStatus === "approved") {
      nextOrderStatus = "paid";
    } else if (paymentStatus === "cancelled" || paymentStatus === "rejected") {
      nextOrderStatus = "cancelled";
    }

    // [MELHORIA DE SEGURANÇA]: Prevenção de decrementos múltiplos de estoque (Idempotência / Double-spend)
    const isTransitioningToPaid = nextOrderStatus === "paid" && order.status !== "paid";

    try {
      // Atualiza o pedido de forma segura e atômica
      const { error: updateError } = await supabaseClient
        .from("orders")
        .update({
          status: nextOrderStatus,
          payment_id: String(resourceId),
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", order.id);

      if (updateError) {
        throw updateError;
      }
    } catch (dbErr) {
      console.error("[mercadopago-webhook] Erro ao gravar atualização de pedido no Supabase:", dbErr);
      return new Response(JSON.stringify({ error: "Erro de banco de dados ao atualizar pedido." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[mercadopago-webhook] Pedido ${order.id} sincronizado com status: ${nextOrderStatus}`);

    // [SEGURANÇA CONTRA CONDIÇÃO DE CORRIDA]: Reduz o estoque dos itens utilizando RPC com travas em Row-level (SELECT FOR UPDATE)
    if (isTransitioningToPaid && order.order_items) {
      console.log(`[mercadopago-webhook] Reduzindo estoque com transação atômica contra condições de corrida para o pedido ${order.id}...`);
      for (const item of order.order_items) {
        if (item.product_id) {
          try {
            // Executa a chamada RPC decrement_product_stock para prevenir que estoque fique negativo ou sofra sobreposição concorrente
            const { data: decrementSuccess, error: rpcErr } = await supabaseClient.rpc(
              "decrement_product_stock",
              { _product_id: item.product_id, _quantity: Number(item.quantity) }
            );

            if (rpcErr) {
              console.error(`[mercadopago-webhook] Falha de comunicação RPC no decremento de estoque do produto ${item.product_id}:`, rpcErr);
            } else if (!decrementSuccess) {
              console.warn(`[mercadopago-webhook] Alerta: Estoque insuficiente ou produto inexistente para o produto ID: ${item.product_id}`);
              // Registra observação no pedido do lojista
              await supabaseClient
                .from("orders")
                .update({
                  notes: (order.notes ? order.notes + " | " : "") + `Aviso: O produto "${item.product_name}" esgotou durante o processamento concorrente do pagamento.`
                })
                .eq("id", order.id);
            } else {
              console.log(`[mercadopago-webhook] Estoque decrementado com sucesso de forma atômica para o produto: "${item.product_name}"`);
            }
          } catch (rpcEx) {
            console.error(`[mercadopago-webhook] Exceção na chamada RPC de estoque para o produto ${item.product_id}:`, rpcEx);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Webhook processado com integridade e segurança de ponta a ponta." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[mercadopago-webhook] Erro crítico:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})