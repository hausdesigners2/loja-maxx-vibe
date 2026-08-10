import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[onesignal-notification] Received push dispatch request");

  const authHeader = req.headers.get('Authorization') || "";
  const webhookSecretHeader = req.headers.get('X-Webhook-Secret') || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  // Validação rígida de segurança: exige token service_role válido OU o segredo do webhook do banco de dados
  const isAuthorized = 
    (serviceKey && authHeader.includes(serviceKey)) || 
    (webhookSecretHeader === "secure_webhook_token_loja_maxx_2026");

  if (!isAuthorized) {
    console.error("[onesignal-notification] Unauthorized webhook trigger attempt. Access denied.");
    return new Response(JSON.stringify({ error: "Unauthorized access" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const payload = await req.json();
    console.log("[onesignal-notification] Webhook payload:", JSON.stringify(payload));

    // Trata os formatos de envelope do Webhook do Supabase
    let record = payload;
    if (payload.record) {
      record = payload.record;
    } else if (payload.new) {
      record = payload.new;
    }

    const { user_id, title, message } = record;

    if (!user_id || !title || !message) {
      console.warn("[onesignal-notification] Notification payload lacks crucial data:", { user_id, title, message });
      return new Response(JSON.stringify({ error: "Missing payload details" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const oneSignalRestApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!oneSignalAppId || !oneSignalRestApiKey) {
      console.error("[onesignal-notification] Missing OneSignal environment variables ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY.");
      return new Response(JSON.stringify({ error: "Server Configuration Error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[onesignal-notification] Dispatching OneSignal push alert to user: ${user_id}`);

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${oneSignalRestApiKey}`
      },
      body: JSON.stringify({
        app_id: oneSignalAppId,
        headings: { en: title, pt: title },
        contents: { en: message, pt: message },
        include_external_user_ids: [user_id]
      })
    });

    const resData = await response.json();
    console.log("[onesignal-notification] OneSignal API response:", JSON.stringify(resData));

    if (!response.ok) {
      throw new Error(`OneSignal API returned error (${response.status}): ${JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ success: true, result: resData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[onesignal-notification] Error dispatching push notification:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});