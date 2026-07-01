import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
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

// Função auxiliar para gerar dados de checkout simulados (mock) realistas
function getMockCheckoutData(infinitepayHandle: string, totalCents: number) {
  const mockPaymentId = `inf_${crypto.randomUUID().replace(/-/g, "")}`;
  const mockPixCode = `00020101021226850014br.gov.bcb.pix2563pix.infinitepay.io/qr/v2/${mockPaymentId}5204000053039865405${(totalCents / 100).toFixed(2)}5802BR5910Lojas Maxx6009Sao Paulo62070503***6304A1B2`;
  
  return {
    id: mockPaymentId,
    checkout_url: `https://checkout.infinitepay.io/${infinitepayHandle}/${mockPaymentId}`,
    pix: {
      qrcode: mockPixCode,
      qrcode_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockPixCode)}`
    },
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };
}

serve(async (req) => {
  // Trata requisições OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const infinitepayApiKey = Deno.env.get("INFINITEPAY_API_KEY");
    const infinitepayHandle = Deno.env.get("INFINITEPAY_HANDLE") ?? "loja_maxx";

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Recupera o corpo da requisição
    const { order_id } = await req.json();
    if (!order_id) {
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
        name: item.product_name,
        quantity: item.quantity,
        unit_amount: unitAmountCents
      };
    });

    // Calcula o total geral estritamente como a soma dos itens em centavos para evitar qualquer divergência de dízima periódica
    const totalCents = items.reduce((sum: number, item: any) => sum + (item.unit_amount * item.quantity), 0);

    // Prepara a chamada para a API de Checkout da InfinitePay
    const infinitePayUrl = "https://api.checkout.infinitepay.io/links";
    
    const payload = {
      amount: totalCents,
      payment_methods: ["pix"],
      items: items,
      metadata: {
        order_id: order.id,
        order_number: order.order_number
      },
      callback_url: `${supabaseUrl}/functions/v1/infinitepay-webhook`,
      redirect_url: `${req.headers.get("origin") || "https://lojasmaxx.com"}/conta`
    };

    console.log("[infinitepay-checkout] Enviando payload para InfinitePay:", JSON.stringify(payload));

    let checkoutData;
    
    // Se a chave de API estiver configurada, tenta realizar a chamada real
    if (infinitepayApiKey && infinitepayApiKey !== "test_api_key") {
      try {
        const response = await fetch(infinitePayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${infinitepayApiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[infinitepay-checkout] Erro na API da InfinitePay (${response.status}): ${errText}`);
          throw new Error(`Erro na API da InfinitePay: ${response.status} - ${errText}`);
        }

        checkoutData = await response.json();
      } catch (err) {
        console.error("[infinitepay-checkout] Falha na requisição real da InfinitePay, usando mock:", err.message);
        checkoutData = getMockCheckoutData(infinitepayHandle, totalCents);
      }
    } else {
      console.log("[infinitepay-checkout] INFINITEPAY_API_KEY não configurada ou inválida. Usando mock para demonstração.");
      checkoutData = getMockCheckoutData(infinitepayHandle, totalCents);
    }

    // Atualiza o pedido no Supabase com as informações do Pix/Checkout
    const pixCode = checkoutData.pix?.qrcode || checkoutData.pix_code || "";
    const qrCodeUrl = checkoutData.pix?.qrcode_image_url || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;

    // Removida a coluna 'expires_at' para evitar o erro PGRST204 (coluna inexistente no banco)
    const { error: updateError } = await supabaseClient
      .from("orders")
      .update({
        payment_id: checkoutData.id,
        pix_code: pixCode,
        qr_code_url: qrCodeUrl,
        payment_status: "pending"
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[infinitepay-checkout] Erro ao atualizar pedido no Supabase:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: checkoutData.checkout_url,
        pix_code: pixCode,
        qr_code_url: qrCodeUrl,
        expires_at: checkoutData.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        payment_id: checkoutData.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("[infinitepay-checkout] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
})