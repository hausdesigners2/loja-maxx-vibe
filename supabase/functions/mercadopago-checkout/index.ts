import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { rateLimit, SECURITY_POLICIES, generateRateLimitResponse, injectRateLimitHeaders } from "../_shared/rateLimiter.ts"
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle preflight requests securely
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // Aplica a política de segurança restrita para rotas sensíveis (máximo 5 tentativas em 15 minutos)
  const rateLimitResult = await rateLimit(clientIp, "mercadopago-checkout", SECURITY_POLICIES.SENSITIVE);
  if (!rateLimitResult.allowed) {
    console.warn(`[mercadopago-checkout] Rate limit excedido para o IP: ${clientIp}`);
    return generateRateLimitResponse(rateLimitResult);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const mpAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");

    console.log("[mercadopago-checkout] Iniciando processo de checkout Pix...");

    if (!mpAccessToken) {
      console.error("[mercadopago-checkout] Erro: MERCADO_PAGO_ACCESS_TOKEN não configurado nas variáveis de ambiente do Supabase.");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "MERCADO_PAGO_ACCESS_TOKEN não configurado no servidor. Contate o administrador." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn(`[mercadopago-checkout] Requisição rejeitada: cabeçalho Authorization ausente.`);
      return new Response(JSON.stringify({ success: false, error: "Sessão expirada ou não autenticada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Inicializa cliente Supabase para validar a sessão do usuário chamador
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.warn(`[mercadopago-checkout] Falha na autenticação do token JWT:`, userError);
      return new Response(JSON.stringify({ success: false, error: "Acesso não autorizado. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Recupera o corpo da requisição
    const { order_id, cpf } = await req.json();
    if (!order_id) {
      console.error("[mercadopago-checkout] Erro: order_id é obrigatório.");
      return new Response(JSON.stringify({ success: false, error: "order_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!cpf) {
      console.error("[mercadopago-checkout] Erro: CPF é obrigatório para pagamentos Pix.");
      return new Response(JSON.stringify({ success: false, error: "CPF é obrigatório para pagamentos Pix." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      console.error("[mercadopago-checkout] Erro: CPF inválido.");
      return new Response(JSON.stringify({ success: false, error: "CPF inválido. Certifique-se de digitar 11 números." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Busca o pedido e seus itens associados
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("[mercadopago-checkout] Erro ao buscar pedido no banco:", orderError);
      return new Response(JSON.stringify({ success: false, error: "Pedido não encontrado no banco de dados." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Garante que o usuário logado só pode gerar pagamento para o próprio pedido
    if (order.user_id && order.user_id !== user.id) {
      console.warn(`[mercadopago-checkout] TENTATIVA DE IDOR DETECTADA! Usuário ${user.id} tentou pagar o pedido ${order.id} do usuário ${order.user_id}.`);
      
      // Registrar log de violação de segurança
      try {
        await supabaseClient.from("security_logs").insert({
          event_type: "login_failed",
          user_id: user.id,
          email: user.email,
          metadata: {
            security_alert: "unauthorized_order_payment_attempt",
            attempted_order_id: order_id,
            owner_user_id: order.user_id,
            ip_address: clientIp
          },
          user_agent: req.headers.get("user-agent")?.slice(0, 500) || null
        });
      } catch (logErr) {
        console.error("[mercadopago-checkout] Erro ao gravar log de violação IDOR:", logErr);
      }

      return new Response(JSON.stringify({ success: false, error: "Ação não autorizada. Você só pode pagar os seus próprios pedidos." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Se o pedido já estiver pago, retorna sucesso imediatamente
    if (order.status === "paid") {
      console.log("[mercadopago-checkout] Pedido já está pago.");
      const headers = new Headers({ ...corsHeaders, "Content-Type": "application/json" });
      injectRateLimitHeaders(headers, rateLimitResult);
      return new Response(JSON.stringify({ success: true, already_paid: true }), {
        status: 200,
        headers
      });
    }

    // Validação robusta de preços, descontos e total (Anti-Tampering)
    const orderItems = order.order_items || [];
    if (orderItems.length === 0) {
      console.error("[mercadopago-checkout] Erro: O pedido não possui itens.");
      return new Response(JSON.stringify({ success: false, error: "Pedido inválido: sem itens associados." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const productIds = orderItems.map((it: any) => it.product_id).filter(Boolean);
    const { data: dbProducts, error: productsError } = await supabaseClient
      .from("products")
      .select("id, name, price, discount_percent, active")
      .in("id", productIds);

    if (productsError || !dbProducts) {
      console.error("[mercadopago-checkout] Erro ao validar produtos com o banco:", productsError);
      return new Response(JSON.stringify({ success: false, error: "Erro de validação no banco de dados." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const productsMap = new Map(dbProducts.map((p: any) => [p.id, p]));
    let recalculatedTotal = 0;
    let isFraud = false;
    const fraudDetails: string[] = [];

    for (const item of orderItems) {
      const dbProd = productsMap.get(item.product_id);
      
      if (!dbProd) {
        isFraud = true;
        fraudDetails.push(`Produto inexistente no catálogo: ID ${item.product_id}`);
        break;
      }

      if (!dbProd.active) {
        isFraud = true;
        fraudDetails.push(`Tentativa de comprar produto inativo: "${dbProd.name}"`);
        break;
      }

      if (Number(item.quantity) <= 0) {
        isFraud = true;
        fraudDetails.push(`Quantidade inválida para o produto "${dbProd.name}": ${item.quantity}`);
        break;
      }

      // Preços oficiais vindos direto do catálogo (nunca confiamos no cliente)
      const officialPrice = Number(dbProd.price);
      const officialDiscount = Number(dbProd.discount_percent || 0);
      const officialFinalUnitPrice = Math.max(0, officialPrice * (1 - officialDiscount / 100));
      const expectedSubtotal = officialFinalUnitPrice * Number(item.quantity);

      recalculatedTotal += expectedSubtotal;

      // Validação de discrepância
      const priceDiff = Math.abs(Number(item.unit_price) - officialPrice);
      const subtotalDiff = Math.abs(Number(item.subtotal) - expectedSubtotal);

      if (priceDiff > 0.01 || subtotalDiff > 0.01 || Number(item.discount_percent) !== officialDiscount) {
        isFraud = true;
        fraudDetails.push(
          `Adulteração no item "${dbProd.name}": Preço enviado R$ ${item.unit_price} (esperado R$ ${officialPrice}), Desconto enviado ${item.discount_percent}% (esperado ${officialDiscount}%), Subtotal enviado R$ ${item.subtotal} (esperado R$ ${expectedSubtotal}).`
        );
      }
    }

    // Compara o total recalculado com o total oficial gravado no pedido
    const totalDiff = Math.abs(recalculatedTotal - Number(order.total));
    if (totalDiff > 0.01) {
      isFraud = true;
      fraudDetails.push(`Adulteração no total do pedido: Enviado R$ ${order.total} (esperado R$ ${recalculatedTotal})`);
    }

    if (isFraud) {
      console.warn(`[mercadopago-checkout] TENTATIVA DE FRAUDE DETECTADA no pedido ${order_id} pelo IP ${clientIp}. Detalhes: ${fraudDetails.join(" | ")}`);

      // Altera o status do pedido para cancelado no banco de dados por segurança
      await supabaseClient
        .from("orders")
        .update({
          status: "cancelled",
          notes: `Cancelado automaticamente pelo sistema de segurança: Adulteração de valores detectada. Detalhes: ${fraudDetails.join(" | ")}`
        })
        .eq("id", order_id);

      // Registra evento de segurança na tabela para auditoria futura do administrador
      try {
        await supabaseClient.from("security_logs").insert({
          event_type: "login_failed",
          user_id: user.id,
          email: user.email,
          metadata: {
            security_alert: "price_tampering_detected",
            order_id: order_id,
            details: fraudDetails,
            ip_address: clientIp,
            recalculated_total: recalculatedTotal,
            submitted_total: order.total
          },
          user_agent: req.headers.get("user-agent")?.slice(0, 500) || null
        });
      } catch (logErr) {
        console.error("[mercadopago-checkout] Erro ao gravar log de violação de preços:", logErr);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: "Erro de segurança: Discrepância nos valores dos produtos detectada. A transação foi bloqueada." 
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Busca o e-mail do cliente no perfil do banco de dados
    let customerEmail = user.email || "cliente@lojasmaxx.com.br";
    const { data: profile } = await supabaseClient
      .from("customer_profiles")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (profile?.email && profile.email.includes("@")) {
      customerEmail = profile.email;
    }

    // Formata o nome do cliente de forma robusta
    const nameParts = (order.customer_name || "Cliente Lojas Maxx").trim().split(/\s+/);
    const firstName = nameParts[0] || "Cliente";
    const lastName = nameParts.slice(1).join(" ") || "Lojas Maxx";

    // Limpa e valida o telefone (apenas números)
    const cleanPhone = (order.customer_phone || "").replace(/\D/g, "");
    let areaCode = "11";
    let phoneNumber = "999999999";
    if (cleanPhone.length >= 10) {
      areaCode = cleanPhone.substring(0, 2);
      phoneNumber = cleanPhone.substring(2);
    } else if (cleanPhone.length > 0) {
      phoneNumber = cleanPhone;
    }

    // Formata rigorosamente o valor monetário com ponto decimal para evitar erros de API
    const finalAmount = Number(Number(recalculatedTotal).toFixed(2));

    // Monta o payload do Mercado Pago utilizando estritamente o valor recalculado no servidor
    const mpPayload = {
      transaction_amount: finalAmount,
      description: `Pedido #${order.order_number || order.id.slice(0, 8)} - Lojas Maxx`,
      payment_method_id: "pix",
      payer: {
        email: customerEmail,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: "CPF",
          number: cleanCpf
        },
        phone: {
          area_code: areaCode,
          number: phoneNumber
        }
      },
      installments: 1,
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      external_reference: order.id
    };

    console.log("[mercadopago-checkout] Enviando payload seguro para o Mercado Pago:", JSON.stringify(mpPayload));

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mpAccessToken}`,
        "X-Idempotency-Key": order.id
      },
      body: JSON.stringify(mpPayload)
    });

    if (!mpResponse.ok) {
      const errText = await mpResponse.text();
      console.error(`[mercadopago-checkout] Erro retornado pelo Mercado Pago (${mpResponse.status}): ${errText}`);
      
      let parsedError;
      try {
        parsedError = JSON.parse(errText);
      } catch {
        parsedError = { message: errText };
      }

      const errorMessage = parsedError.message || parsedError.description || "Erro na geração do Pix no Mercado Pago.";

      return new Response(JSON.stringify({ 
        success: false, 
        error: `Erro na API do Mercado Pago: ${errorMessage}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const mpData = await mpResponse.json();
    console.log("[mercadopago-checkout] Resposta do Mercado Pago recebida com sucesso.");

    const paymentId = String(mpData.id);
    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
    const status = mpData.status;

    if (!qrCode || !qrCodeBase64) {
      console.error("[mercadopago-checkout] Erro: Dados do Pix não retornados pelo Mercado Pago.", JSON.stringify(mpData));
      return new Response(JSON.stringify({ 
        success: false, 
        error: "A API do Mercado Pago não retornou os dados de pagamento. Verifique as credenciais Pix." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Atualiza o pedido com os dados de pagamento de forma resiliente
    try {
      await supabaseClient
        .from("orders")
        .update({
          payment_id: paymentId,
          payment_status: status,
          updated_at: new Date().toISOString()
        } as any)
        .eq("id", order.id);
    } catch (dbErr) {
      console.error("[mercadopago-checkout] Erro ao salvar ID de pagamento no pedido:", dbErr);
    }

    const headers = new Headers({ ...corsHeaders, "Content-Type": "application/json" });
    injectRateLimitHeaders(headers, rateLimitResult);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentId,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        amount: finalAmount,
        status: status
      }),
      {
        status: 200,
        headers
      }
    );

  } catch (error) {
    console.error("[mercadopago-checkout] Erro geral na execução da função:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
})