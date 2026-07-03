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

    console.log("[mercadopago-checkout] Iniciando processo de checkout Pix...");

    if (!mpAccessToken) {
      console.error("[mercadopago-checkout] Erro: MERCADO_PAGO_ACCESS_TOKEN não configurado nas variáveis de ambiente do Supabase.");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "MERCADO_PAGO_ACCESS_TOKEN não configurado nas variáveis de ambiente do Supabase. Por favor, configure este segredo no painel do Supabase." 
      }), {
        status: 500,
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

    // Busca o pedido e seus itens
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

    // Se o pedido já estiver pago, retorna sucesso imediatamente
    if (order.status === "paid") {
      console.log("[mercadopago-checkout] Pedido já está pago.");
      return new Response(JSON.stringify({ success: true, already_paid: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Busca o e-mail do cliente no perfil se houver um user_id associado
    let customerEmail = "cliente@lojasmaxx.com.br";
    if (order.user_id) {
      const { data: profile } = await supabaseClient
        .from("customer_profiles")
        .select("email")
        .eq("user_id", order.user_id)
        .maybeSingle();
      if (profile?.email && profile.email.includes("@")) {
        customerEmail = profile.email;
      }
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

    // Monta o payload para o Mercado Pago seguindo estritamente a API de pagamentos v1
    const mpPayload = {
      transaction_amount: Number(order.total),
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

    console.log("[mercadopago-checkout] Enviando payload para o Mercado Pago:", JSON.stringify(mpPayload));

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

      const errorMessage = parsedError.message || parsedError.description || "Erro desconhecido na API do Mercado Pago.";

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
        error: "A API do Mercado Pago não retornou os dados do QR Code Pix. Verifique se sua conta do Mercado Pago está ativa e homologada para receber Pix." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Atualiza o pedido no Supabase com o ID do pagamento do Mercado Pago
    const { error: updateError } = await supabaseClient
      .from("orders")
      .update({
        payment_id: paymentId,
        payment_status: status,
        updated_at: new Date().toISOString()
      } as any)
      .eq("id", order.id);

    if (updateError) {
      console.error("[mercadopago-checkout] Erro ao atualizar pedido no Supabase:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentId,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        amount: order.total,
        status: status
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
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