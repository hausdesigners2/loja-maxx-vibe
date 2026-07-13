/**
 * Lojas Maxx - Centralized Secure CORS Helper
 * Prevents unauthorized cross-origin request forgery while allowing production and preview environments.
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
    "Vary": "Origin" // Tells browsers/caches to cache CORS response per origin
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