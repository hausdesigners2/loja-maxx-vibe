import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { rateLimit, SECURITY_POLICIES, generateRateLimitResponse, injectRateLimitHeaders } from "../_shared/rateLimiter.ts"
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts"

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // Apply rate limiting
  const rateLimitResult = await rateLimit(clientIp, "guest-order", SECURITY_POLICIES.GLOBAL);
  if (!rateLimitResult.allowed) {
    return generateRateLimitResponse(rateLimitResult);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === "POST") {
      // Create guest order
      const { items, customer, extras } = await req.json();

      if (!items || !customer) {
        return new Response(JSON.stringify({ error: "Missing items or customer info" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Generate secure guest token
      const array = new Uint32Array(4);
      crypto.getRandomValues(array);
      const guestToken = Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('');

      const total = items.reduce(
        (s: number, it: any) => s + (it.price * (1 - (it.discount_percent || 0) / 100)) * it.quantity,
        0
      );

      const method = customer.payment_method || "Pix";
      const initialStatus = method === "Débito" || method === "Crédito" ? "awaiting_machine" : "pending";
      const tokenMarker = `[GuestToken: ${guestToken}]`;
      const finalNotes = extras?.notes ? `${extras.notes} ${tokenMarker}` : tokenMarker;

      // Insert order
      const { data: order, error: orderError } = await supabaseClient
        .from("orders")
        .insert({
          user_id: null,
          customer_name: customer.full_name,
          customer_phone: customer.phone,
          customer_address: customer.address,
          customer_complement: customer.complement || null,
          customer_city: customer.city || null,
          customer_state: customer.state || null,
          customer_zip: customer.zip || null,
          total,
          payment_method: method,
          change_for: extras?.change_for ?? null,
          notes: finalNotes,
          status: initialStatus,
        })
        .select()
        .single();

      if (orderError || !order) {
        throw orderError || new Error("Failed to create order");
      }

      // Insert order items
      const itemsPayload = items.map((it: any) => {
        const unit = it.price * (1 - (it.discount_percent || 0) / 100);
        return {
          order_id: order.id,
          product_id: it.id,
          product_name: it.name,
          unit_price: it.price,
          discount_percent: it.discount_percent || 0,
          quantity: it.quantity,
          subtotal: unit * it.quantity,
        };
      });

      const { error: itemsErr } = await supabaseClient.from("order_items").insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      const headers = new Headers({ ...corsHeaders, "Content-Type": "application/json" });
      injectRateLimitHeaders(headers, rateLimitResult);

      return new Response(JSON.stringify({ success: true, order, guest_token: guestToken }), {
        status: 200,
        headers
      });
    } 
    
    if (req.method === "GET") {
      // Retrieve guest order
      const url = new URL(req.url);
      const orderId = url.searchParams.get("order_id");
      const guestToken = url.searchParams.get("guest_token");

      if (!orderId || !guestToken) {
        return new Response(JSON.stringify({ error: "Missing order_id or guest_token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Fetch order
      const { data: order, error: orderError } = await supabaseClient
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Validate guest token
      const notesText = order.notes || "";
      const match = notesText.match(/\[GuestToken:\s*([a-f0-9]+)\]/i);
      const storedGuestToken = match ? match[1] : null;

      if (!storedGuestToken || storedGuestToken !== guestToken) {
        return new Response(JSON.stringify({ error: "Unauthorized access to guest order" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const headers = new Headers({ ...corsHeaders, "Content-Type": "application/json" });
      injectRateLimitHeaders(headers, rateLimitResult);

      return new Response(JSON.stringify({ success: true, order }), {
        status: 200,
        headers
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[guest-order] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});