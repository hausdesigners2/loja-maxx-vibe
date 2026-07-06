/**
 * [Lojas Maxx] Middleware de Rate Limiting de Alta Performance
 * Especialista em Infraestrutura e Defesa Web
 */

export interface RateLimitConfig {
  limit: number;      // Máximo de requisições permitidas
  windowMs: number;   // Janela de tempo em milissegundos
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Timestamp de quando o limite reseta
}

// Configurações Padrão de Segurança
export const SECURITY_POLICIES = {
  GLOBAL: { limit: 100, windowMs: 60 * 1000 },       // 100 req/min
  SENSITIVE: { limit: 5, windowMs: 15 * 60 * 1000 },  // 5 req/15min (Login, Checkout, Reset)
};

// --- FALLBACK EM MEMÓRIA COM LIMPEZA ATIVA ---
class InMemoryStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  constructor() {
    // Limpeza ativa a cada 1 minuto para evitar vazamento de memória
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { allowed: true, limit, remaining: limit - 1, resetTime };
    }

    record.count += 1;
    const remaining = Math.max(0, limit - record.count);
    const allowed = record.count <= limit;

    return { allowed, limit, remaining, resetTime: record.resetTime };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// --- CONEXÃO REDIS (UPSTASH REST API) ---
class RedisStore {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSeconds = Math.ceil(windowMs / 1000);
    
    try {
      // Pipeline Redis usando a API REST do Upstash para máxima performance e zero dependências pesadas
      const response = await fetch(`${this.url}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["TTL", key]
        ]),
      });

      if (!response.ok) throw new Error("Redis REST API Error");
      
      const [incrResult, ttlResult] = await response.json();
      const count = incrResult.result;
      let ttl = ttlResult.result;

      // Se for a primeira requisição, define o TTL da chave
      if (count === 1 || ttl === -1) {
        await fetch(`${this.url}/EXPIRE/${key}/${windowSeconds}`, {
          headers: { Authorization: `Bearer ${this.token}` }
        });
        ttl = windowSeconds;
      }

      const remaining = Math.max(0, limit - count);
      const allowed = count <= limit;
      const resetTime = now + (ttl * 1000);

      return { allowed, limit, remaining, resetTime };
    } catch (err) {
      console.error("[RateLimiter] Falha ao conectar ao Redis. Usando fallback em memória.", err);
      throw err; // Força o fallback no catch do orquestrador
    }
  }
}

// Orquestrador do Rate Limiter
const inMemoryStore = new InMemoryStore();
let redisStore: RedisStore | null = null;

// Inicializa o Redis se as variáveis de ambiente estiverem presentes
const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
if (redisUrl && redisToken) {
  redisStore = new RedisStore(redisUrl, redisToken);
  console.log("[RateLimiter] Redis ativado com sucesso para ambiente distribuído.");
} else {
  console.log("[RateLimiter] Redis não configurado. Utilizando armazenamento em memória local.");
}

/**
 * Executa a verificação de Rate Limit para um determinado IP e rota.
 */
export async function rateLimit(
  ip: string,
  route: string,
  policy: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${route}:${ip}`;
  
  if (redisStore) {
    try {
      return await redisStore.check(key, policy.limit, policy.windowMs);
    } catch {
      return await inMemoryStore.check(key, policy.limit, policy.windowMs);
    }
  }
  
  return await inMemoryStore.check(key, policy.limit, policy.windowMs);
}

/**
 * Helper para gerar a resposta HTTP 429 padronizada com os headers de segurança.
 */
export function generateRateLimitResponse(result: RateLimitResult): Response {
  const retryAfterSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: "Muitas requisições detectadas. Por favor, aguarde antes de tentar novamente para garantir a segurança da sua conta.",
      retry_after_seconds: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

/**
 * Helper para injetar os headers de Rate Limit em respostas de sucesso (200 OK).
 */
export function injectRateLimitHeaders(headers: Headers, result: RateLimitResult): Headers {
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  return headers;
}