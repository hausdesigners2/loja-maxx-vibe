import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função auxiliar para calcular o preço final com desconto em centavos inteiros sem erros de arredondamento
function getFinalPriceCents(price: number, discountPercent: number): number {
  const discount = discountPercent || 0;
  const finalPrice = Math.max(0, price * (1 - discount / 100));
  return Math.round(finalPrice * 100);
}

Deno.serve(async (req) => {
  // Trata requisições OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const infinitepayHandle = Deno.env.get("INFINITEPAY_HANDLE");

    // Log de confirmação de carregamento do Secret (sem mostrar o valor)
    if (infinitepayHandle) {
      console.log("[infinitepay-checkout] Secret INFINITEPAY_HANDLE carregado com sucesso.");
    } else {
      console.error("[infinitepay-checkout] Erro: Secret INFINITEPAY_HANDLE não configurado no Supabase.");
      return new Response(JSON.stringify({ error: "INFINITEPAY_HANDLE não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Recupera o corpo da requisição
    const { order_id } = await req.json();
    if (!order_id) {
      console.error("[infinitepay-checkout] Erro: order_id é obrigatório.");
      return new Response(JSON.stringify({ error: "order_id é obrigatório" }), {
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
      console.error("[infinitepay-checkout] Erro ao buscar pedido no banco:", orderError);
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Mapeia os itens calculando o valor unitário final com desconto diretamente em centavos inteiros
    const items = order.order_items.map((item: any) => {
      const unitAmountCents = getFinalPriceCents(
        Number(item.unit_price),
        Number(item.discount_percent || 0)
      );
      return {
        description: item.product_name.slice(0, 100), // Limita tamanho da descrição conforme boas práticas
        price: unitAmountCents,
        quantity: item.quantity
      };
    });

    // O order_nsu deve ser o ID único do pedido (UUID) para garantir unicidade absoluta na InfinitePay
    const order_nsu = order.id;

    // Prepara a chamada para a API oficial de Checkout da InfinitePay
    const infinitePayUrl = "https://api.checkout.infinitepay.io/links";
    
    const payload = {
      handle: infinitepayHandle,
      order_nsu: order_nsu,
      items: items,
      redirect_url: `${req.headers.get("origin") || "https://lojasmaxx.com"}/conta`,
      webhook_url: `${supabaseUrl}/functions/v1/infinitepay-webhook`
    };

    console.log("[infinitepay-checkout] Enviando payload oficial para InfinitePay:", JSON.stringify(payload));

    const response = await fetch(infinitePayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("[infinitepay-checkout] Código HTTP retornado pela InfinitePay:", response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[infinitepay-checkout] Erro retornado pela API da InfinitePay (${response.status}): ${errText}`);
      return new Response(JSON.stringify({ error: `Erro na InfinitePay: ${errText}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const checkoutData = await response.json();
    console.log("[infinitepay-checkout] Resposta completa da InfinitePay:", JSON.stringify(checkoutData));

    const checkoutUrl = checkoutData.url;
    if (!checkoutUrl) {
      console.error("[infinitepay-checkout] Erro: URL de checkout não retornada pela InfinitePay.");
      return new Response(JSON.stringify({ error: "URL de checkout não retornada pela InfinitePay" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Atualiza o pedido no Supabase de forma segura contra erros PGRST204 (colunas ausentes)
    // Tenta atualizar com checkout_url se a coluna existir, caso contrário atualiza apenas as colunas básicas
    try {
      const { error: updateError } = await supabaseClient
        .from("orders")
        .update({
          payment_id: order_nsu,
          payment_status: "pending",
          checkout_url: checkoutUrl
        } as any)
        .eq("id", order.id);

      if (updateError) {
        if (updateError.code === "PGRST204") {
          console.log("[infinitepay-checkout] Coluna checkout_url não existe no banco. Atualizando apenas payment_id e payment_status.");
          const { error: fallbackError } = await supabaseClient
            .from("orders")
            .update({
              payment_id: order_nsu,
              payment_status: "pending"
            } as any)
            .eq("id", order.id);
          
          if (fallbackError) {
            console.error("[infinitepay-checkout] Erro no update de fallback:", fallbackError);
          }
        } else {
          console.error("[infinitepay-checkout] Erro ao atualizar pedido no Supabase:", updateError);
        }
      } else {
        console.log("[infinitepay-checkout] Pedido atualizado com sucesso no Supabase.");
      }
    } catch (dbErr) {
      console.error("[infinitepay-checkout] Exceção ao atualizar banco de dados:", dbErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutUrl
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("[infinitepay-checkout] Erro geral na execução da função:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
})