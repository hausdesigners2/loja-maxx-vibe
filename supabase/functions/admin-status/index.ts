import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";
import { rateLimit, SECURITY_POLICIES, generateRateLimitResponse, injectRateLimitHeaders } from "../_shared/rateLimiter.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Captura o IP do cliente de forma segura
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // Aplica a política de segurança global (máximo 100 requisições por minuto)
  const rateLimitResult = await rateLimit(clientIp, "admin-status", SECURITY_POLICIES.GLOBAL);
  if (!rateLimitResult.allowed) {
    console.warn(`[admin-status] Rate limit excedido para o IP: ${clientIp}`);
    return generateRateLimitResponse(rateLimitResult);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !publishableKey || !serviceRoleKey || !authHeader) {
      return Response.json({ isAdmin: false }, { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return Response.json({ isAdmin: false }, { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (error) throw error;

    const headers = new Headers({ ...corsHeaders, "Content-Type": "application/json" });
    injectRateLimitHeaders(headers, rateLimitResult);

    return new Response(JSON.stringify({ isAdmin: data?.role === "admin" }), { headers });
  } catch (error) {
    console.error("admin-status error", error);
    return Response.json({ isAdmin: false }, { status: 500, headers: corsHeaders });
  }
});