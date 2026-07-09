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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { identifier } = await req.json()
    if (!identifier) {
      return new Response(JSON.stringify({ error: "Missing identifier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Define limits: 3 attempts per hour for password reset
    const LIMIT = 3
    const WINDOW_MS = 60 * 60 * 1000 // 1 hour
    const now = new Date()

    const { data: record, error: fetchError } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('identifier', identifier)
      .eq('attempt_type', 'reset')
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    let allowed = true
    let remaining = LIMIT
    let retryAfter = 0

    if (record) {
      const windowStart = new Date(record.window_start)
      const elapsed = now.getTime() - windowStart.getTime()

      if (elapsed < WINDOW_MS) {
        if (record.blocked_until && new Date(record.blocked_until) > now) {
          allowed = false
          remaining = 0
          retryAfter = Math.ceil((new Date(record.blocked_until).getTime() - now.getTime()) / 1000)
        } else if (record.attempts >= LIMIT) {
          allowed = false
          remaining = 0
          retryAfter = Math.ceil((WINDOW_MS - elapsed) / 1000)
          const blockUntil = new Date(now.getTime() + WINDOW_MS)
          await supabase
            .from('login_attempts')
            .update({ attempts: record.attempts + 1, blocked_until: blockUntil.toISOString(), updated_at: now.toISOString() })
            .eq('id', record.id)
        } else {
          await supabase
            .from('login_attempts')
            .update({ attempts: record.attempts + 1, updated_at: now.toISOString() })
            .eq('id', record.id)
          remaining = LIMIT - (record.attempts + 1)
        }
      } else {
        await supabase
          .from('login_attempts')
          .update({ attempts: 1, window_start: now.toISOString(), blocked_until: null, updated_at: now.toISOString() })
          .eq('id', record.id)
        remaining = LIMIT - 1
      }
    } else {
      await supabase
        .from('login_attempts')
        .insert({
          identifier,
          attempt_type: 'reset',
          attempts: 1,
          window_start: now.toISOString()
        })
      remaining = LIMIT - 1
    }

    const response = {
      allowed,
      remaining,
      retryAfter,
      limit: LIMIT,
      windowMinutes: WINDOW_MS / 60000
    }

    return new Response(JSON.stringify(response), {
      status: allowed ? 200 : 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(LIMIT),
        "X-RateLimit-Remaining": String(remaining),
        "Retry-After": String(retryAfter)
      }
    })
  } catch (err) {
    console.error("password-reset-rate-limit error:", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})