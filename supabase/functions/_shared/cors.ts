/**
 * Lojas Maxx - Centralized Secure CORS & Security Headers Helper
 * Prevents unauthorized cross-origin request forgery and enforces rigorous server-side security.
 */

const ALLOWED_ORIGINS = [
  "https://www.lojasmaxx.com.br",
  "https://lojasmaxx.com.br",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  
  // Safe default
  let allowedOrigin = "https://www.lojasmaxx.com.br";

  // If the origin is in our production list, allow it
  if (ALLOWED_ORIGINS.includes(origin)) {
    allowedOrigin = origin;
  } 
  // Allow localhost and Lovable development/preview sandboxes for testing/production parity
  else if (
    origin.startsWith("http://localhost:") || 
    origin.startsWith("http://127.0.0.1:") ||
    origin.includes(".lovable.app") ||
    origin.includes(".lovableproject.com") ||
    origin.includes("---") // Lovable preview patterns
  ) {
    allowedOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin", // Tells browsers/caches to cache CORS response per origin
    
    // Rigorous Security Headers (Server-side defense)
    "Content-Security-Policy": "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; connect-src 'self' https: wss:; frame-src 'self' https:; object-src 'none';",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-site"
  };
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }
  return null;
}