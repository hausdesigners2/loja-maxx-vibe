import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/* ---------- Validation schemas ---------- */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu email")
  .max(320, "Email muito longo")
  .email("Email inválido");

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .max(128, "Senha muito longa");

export const authSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/** Strip control chars, collapse whitespace, hard cap length. */
export function sanitizeText(input: string, maxLength = 500): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/* ---------- Friendly error mapping (no internal details leaked) ---------- */

const errorMap: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Confirme seu email antes de entrar.",
  "User already registered": "Este email já está cadastrado.",
  "Password should be at least 6 characters": "A senha é muito curta.",
  "Signup requires a valid password": "Senha inválida.",
  "Email rate limit exceeded": "Muitas tentativas. Tente novamente em alguns minutos.",
  "Password is known to be weak and easy to guess": "Senha fraca: esta senha é conhecida e fácil de adivinhar. Escolha outra senha.",
};

export type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
  weak_password?: { reasons?: string[] };
};

export function formatAuthError(error: AuthErrorLike | string | null | undefined): string {
  if (!error) return "Algo deu errado. Tente novamente.";
  if (typeof error === "string") return error;

  const parts = [
    error.code ? `code: ${error.code}` : null,
    error.status ? `status: ${error.status}` : null,
    error.message ? `message: ${error.message}` : null,
    error.weak_password?.reasons?.length ? `weak_password.reasons: ${error.weak_password.reasons.join(", ")}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : JSON.stringify(error);
}

export function friendlyAuthError(message: string | null | undefined): string {
  if (!message) return "Algo deu errado. Tente novamente.";
  for (const key of Object.keys(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return errorMap[key];
  }
  // Pwned password check from Supabase
  if (/pwned|leaked|compromised/i.test(message)) {
    return "Esta senha apareceu em vazamentos públicos. Escolha outra mais forte.";
  }
  return "Não foi possível concluir. Verifique os dados e tente novamente.";
}

/* ---------- Security event logging ---------- */

export type SecurityEvent =
  | "login_success"
  | "login_failed"
  | "signup_success"
  | "signup_failed"
  | "logout"
  | "admin_access"
  | "admin_access_denied"
  | "session_timeout"
  | "password_reset_requested";

export async function logSecurityEvent(
  event_type: SecurityEvent,
  opts: { userId?: string | null; email?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("security_logs" as any) as any).insert({
      event_type,
      user_id: opts.userId ?? null,
      email: opts.email ? sanitizeText(opts.email, 320) : null,
      metadata: opts.metadata ?? {},
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch {
    // Never let logging break the app
  }
}
