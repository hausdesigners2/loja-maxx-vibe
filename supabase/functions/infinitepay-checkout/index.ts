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

// Função auxiliar para tentar extrair rua e número de um endereço em formato de texto único
function parseAddress(fullAddress: string) {
  const addressStr = fullAddress || "";
  // Tenta encontrar um padrão de "Nome da Rua, Número"
  const match = addressStr.match(/^([^,]+),\s*(\d+)/);
  if (match) {
    return {
      street: match[1].trim(),
      number: match[2].trim()
    };
  }
  return {
    street: addressStr.trim(),
    number: "S/N"
  };
}

// Função auxiliar para formatar o telefone para o padrão esperado (apenas dígitos)
function formatPhone(phoneStr: string): string {
  const digits = phoneStr.replace(/\D/g, '');
  // Se não tiver o DDI (55), adiciona para números brasileiros de 10 ou 11 dígitos
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
  return digits;
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

    // Busca o e-mail do cliente no perfil se houver um user_id associado
    let customerEmail = "";
    if (order.user_id) {
      const { data: profile } = await supabaseClient
        .from("customer_profiles")
        .select("email")
        .eq("user_id", order.user_id)
        .maybeSingle();
      if (profile?.email) {
        customerEmail = profile.email;
      }
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

    // Extrai rua e número do endereço completo do pedido
    const parsedAddr = parseAddress(order.customer_address);

    // Monta os objetos de cliente e endereço para pré-preenchimento
    const customerPayload: any = {
      name: order.customer_name,
      phone: formatPhone(order.customer_phone)
    };
    if (customerEmail) {
      customerPayload.email = customerEmail;
    }

    const addressPayload: any = {
      street: parsedAddr.street,
      number: parsedAddr.number
    };
    if (order.customer_zip) {
      addressPayload.cep = order.customer_zip.replace(/\D/g, '');
    }
    if (order.customer_complement) {
      addressPayload.complement = order.customer_complement;
    }

    // Prepara a chamada para a API oficial de Checkout da InfinitePay
    const infinitePayUrl = "https://api.checkout.infinitepay.io/links";
    
    // Define a URL de redirecionamento dinamicamente com base na origem da requisição,
    // caindo de volta para o domínio oficial de produção da Loja Maxx (/conta)
    const origin = req.headers.get("origin") || "https://www.lojasmaxx.com.br";
    const redirectUrl = `${origin}/conta`;

    const payload = {
      handle: infinitepayHandle,
      order_nsu: order_nsu,
      items: items,
      redirect_url: redirectUrl,
      webhook_url: `${supabaseUrl}/functions/v1/infinitepay-webhook`,
      customer: customerPayload,
      address: addressPayload
    };

    console.log("[infinitepay-checkout] Enviando payload oficial com redirect_url configurado para:", redirectUrl);

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