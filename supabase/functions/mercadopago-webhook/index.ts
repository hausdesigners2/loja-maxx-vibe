import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Validação criptográfica oficial de assinatura do Mercado Pago via HMAC SHA-256
 */
async function verifyMercadoPagoSignature(
  signatureHeader: string,
  requestId: string,
  resourceId: string,
  secretKey: string
): Promise<boolean> {
  if (!signatureHeader || !secretKey) return false;
  
  try {
    const parts = signatureHeader.split(",");
    let ts = "";
    let v1 = "";
    for (const part of parts) {
      const [k, v] = part.split("=");
      if (k?.trim() === "ts" || k?.trim() === "t") ts = v?.trim();
      if (k?.trim() === "v1") v1 = v?.trim();
    }
    
    if (!ts || !v1) return false;
    
    const manifest = `id:${resourceId};request-id:${requestId};ts:${ts};`;
    
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(secretKey);
    const dataBytes = encoder.encode(manifest);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
    const signatureBytes = new Uint8Array(signatureBuffer);
    
    const computedHash = Array.from(signatureBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
      
    return computedHash === v1;
  } catch (err) {
    console.error("[mercadopago-webhook] Erro ao validar assinatura criptográfica:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const mpAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const mpWebhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");

    if (!mpAccessToken) {
      console.error("[mercadopago-webhook] Erro: MERCADO_PAGO_ACCESS_TOKEN não configurado.");
      return new Response(JSON.stringify({ error: "MERCADO_PAGO_ACCESS_TOKEN não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("x-signature") || "";
    const requestId = req.headers.get("x-request-id") || "";
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const payload = await req.json();
    console.log(`[mercadopago-webhook] Notificação recebida. RequestId: ${requestId}, IP: ${clientIp}`);

    let resourceId = String(payload.data?.id || "");
    if (!resourceId && payload.resource) {
      const match = payload.resource.match(/payments\/(\d+)/);
      if (match) {
        resourceId = match[1];
      } else {
        resourceId = payload.resource;
      }
    }

    const topic = payload.type || payload.topic || "";

    // Tenta validar a assinatura se o segredo estiver configurado
    if (mpWebhookSecret && signature) {
      const isSignatureValid = await verifyMercadoPagoSignature(signature, requestId, resourceId, mpWebhookSecret);
      if (isSignatureValid) {
        console.log("[mercadopago-webhook] Assinatura validada criptograficamente via HMAC SHA-256 com sucesso!");
      } else {
        console.warn(`[mercadopago-webhook] Assinatura inválida detectada para o IP: ${clientIp}. Prosseguindo para validação direta via API oficial do Mercado Pago por segurança.`);
      }
    } else {
      console.log("[mercadopago-webhook] Assinatura ou segredo ausente. Prosseguindo para validação direta via API oficial do Mercado Pago.");
    }

    if (topic !== "payment" || !resourceId) {
      console.log(`[mercadopago-webhook] Ignorando notificação irrelevante. Tipo/Tópico: ${topic}`);
      return new Response(JSON.stringify({ success: true, message: "Ignorado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Consulta direta e oficial à API do Mercado Pago (Prevenção absoluta de Fake Payloads)
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
    const paymentStatus = paymentData.status;
    const transactionAmount = Number(paymentData.transaction_amount);

    console.log(`[mercadopago-webhook] Retorno oficial MP -> Pedido ID: ${orderId}, Status: ${paymentStatus}, Valor: R$ ${transactionAmount}`);

    if (!orderId) {
      console.warn(`[mercadopago-webhook] ID do pedido (external_reference) ausente na consulta oficial.`);
      return new Response(JSON.stringify({ error: "ID do pedido não encontrado na transação do Mercado Pago." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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

    if (order.status === "paid") {
      console.log(`[mercadopago-webhook] Pedido ${order.id} já está pago. Retornando sucesso (idempotência).`);
      return new Response(JSON.stringify({ success: true, message: "Pedido já pago." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const difference = Math.abs(transactionAmount - Number(order.total));
    if (difference > 0.01 && paymentStatus === "approved") {
      console.error(`[mercadopago-webhook] ALERTA DE SEGURANÇA: Discrepância crítica de valores! Pedido exige R$ ${order.total}, mas pagamento efetuado foi de R$ ${transactionAmount}.`);
      
      await supabaseClient
        .from("orders")
        .update({
          status: "cancelled",
          notes: `FRAUDE DETECTADA: O pagamento foi efetuado com valor divergente (R$ ${transactionAmount}) do valor oficial do pedido (R$ ${order.total}). O pedido foi cancelado preventivamente.`
        })
        .eq("id", order.id);

      try {
        await supabaseClient.from("security_logs").insert({
          event_type: "login_failed",
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

    let nextOrderStatus = order.status;
    if (paymentStatus === "approved") {
      nextOrderStatus = "paid";
    } else if (paymentStatus === "cancelled" || paymentStatus === "rejected") {
      nextOrderStatus = "cancelled";
    }

    const isTransitioningToPaid = nextOrderStatus === "paid" && order.status !== "paid";

    try {
      const { error: updateError } = await supabaseClient
        .from("orders")
        .update({
          status: nextOrderStatus,
          payment_id: String(resourceId),
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        } as any)
        .eq("id", order.id);

      if (updateError) {
        console.warn(`[mercadopago-webhook] Falha ao salvar colunas opcionais de pagamento. Executando atualização de fallback robusta...`, updateError);
        
        const appendNotes = `[Pix MP Ref: ${resourceId} | Status: ${paymentStatus}]`;
        const fallbackNotes = order.notes ? `${order.notes} ${appendNotes}` : appendNotes;
        
        const { error: fallbackError } = await supabaseClient
          .from("orders")
          .update({
            status: nextOrderStatus,
            notes: fallbackNotes.slice(0, 1000),
            updated_at: new Date().toISOString()
          })
          .eq("id", order.id);

        if (fallbackError) {
          throw fallbackError;
        }
        console.log(`[mercadopago-webhook] Atualização de fallback do pedido ${order.id} concluída com sucesso.`);
      } else {
        console.log(`[mercadopago-webhook] Pedido ${order.id} atualizado com sucesso.`);
      }
    } catch (dbErr) {
      console.error("[mercadopago-webhook] Erro ao gravar atualização de pedido no Supabase:", dbErr);
      return new Response(JSON.stringify({ error: "Erro de banco de dados ao atualizar pedido." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[mercadopago-webhook] Pedido ${order.id} sincronizado com status: ${nextOrderStatus}`);

    if (isTransitioningToPaid && order.order_items) {
      console.log(`[mercadopago-webhook] Reduzindo estoque com transação atômica contra condições de corrida para o pedido ${order.id}...`);
      for (const item of order.order_items) {
        if (item.product_id) {
          try {
            const { data: decrementSuccess, error: rpcErr } = await supabaseClient.rpc(
              "decrement_product_stock",
              { _product_id: item.product_id, _quantity: Number(item.quantity) }
            );

            if (rpcErr) {
              console.warn(`[mercadopago-webhook] RPC decrement_product_stock falhou ou não existe. Executando fallback de atualização direta...`, rpcErr);
              
              const { data: prod, error: prodErr } = await supabaseClient
                .from("products")
                .select("stock, name")
                .eq("id", item.product_id)
                .single();
                
              if (!prodErr && prod) {
                const newStock = Math.max(0, Number(prod.stock) - Number(item.quantity));
                await supabaseClient
                  .from("products")
                  .update({ stock: newStock })
                  .eq("id", item.product_id);
                console.log(`[mercadopago-webhook] Estoque do produto "${prod.name}" atualizado via fallback direto para: ${newStock}`);
              }
            } else if (!decrementSuccess) {
              console.warn(`[mercadopago-webhook] Alerta: Estoque insuficiente ou produto inexistente para o produto ID: ${item.product_id}`);
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