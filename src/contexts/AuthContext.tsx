import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { formatAuthError, logSecurityEvent } from "@/lib/security";
import * as OTPAuth from "otpauth";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isAdmin2FAApproved: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; errorDetails?: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ data: any; error: string | null; errorDetails?: AuthError | null }>;
  signOut: () => Promise<void>;
  verifyAdmin2FA: (code: string) => Promise<boolean>;
  setupAdmin2FA: (secret: string, code: string) => Promise<boolean>;
  getAdmin2FASecret: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// 30 minutes of inactivity → automatic logout
const INACTIVITY_MS = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdmin2FAApproved, setIsAdmin2FAApproved] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("loja-maxx-admin-2fa-approved") === "true";
    }
    return false;
  });
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<number | null>(null);

  /* ---------- inactivity logout ---------- */
  useEffect(() => {
    if (!session) return;

    const reset = () => {
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = window.setTimeout(async () => {
        await logSecurityEvent("session_timeout", {
          userId: session.user.id,
          email: session.user.email,
        });
        await supabase.auth.signOut();
      }, INACTIVITY_MS);
    };

    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session]);

  /* ---------- session sync ---------- */
  useEffect(() => {
    let active = true;

    const applySession = async (sess: Session | null) => {
      if (!active) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        await checkAdmin(sess.user.id);
      } else {
        setIsAdmin(false);
        setIsAdmin2FAApproved(false);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("loja-maxx-admin-2fa-approved");
        }
      }
      if (active) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setLoading(true);
      // defer to avoid deadlocks with supabase calls inside the callback
      setTimeout(() => { void applySession(sess); }, 0);
    });

    const initialTimeout = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 3500);

    supabase.auth.getSession()
      .then(async ({ data: { session: sess } }) => {
        window.clearTimeout(initialTimeout);
        await applySession(sess);
      })
      .catch(() => {
        window.clearTimeout(initialTimeout);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(initialTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const checkAdmin = async (userId: string) => {
    const timeout = new Promise<false>((resolve) => window.setTimeout(() => resolve(false), 8000));
    const check: Promise<boolean> = (async () => {
      try {
        const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
        return !error && data === true;
      } catch {
        return false;
      }
    })();
    const admin = await Promise.race([check, timeout]);
    setIsAdmin(admin);
    return admin;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Lovable Cloud auth login error:", error);
      void logSecurityEvent("login_failed", { email, metadata: { reason: error.message, details: formatAuthError(error) } });
    } else {
      void logSecurityEvent("login_success", { email, userId: data.user?.id });
    }
    return { error: error ? formatAuthError(error) : null, errorDetails: error };
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        emailRedirectTo: `${window.location.origin}/`,
        data: metadata
      },
    });
    if (error) {
      console.error("Lovable Cloud auth signup error:", error);
      void logSecurityEvent("signup_failed", { email, metadata: { reason: error.message, details: formatAuthError(error) } });
    } else {
      void logSecurityEvent("signup_success", { email, userId: data.user?.id });
    }
    return { data, error: error ? formatAuthError(error) : null, errorDetails: error };
  };

  const signOut = async () => {
    setIsAdmin2FAApproved(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("loja-maxx-admin-2fa-approved");
    }
    await supabase.auth.signOut();
  };

  const getAdmin2FASecret = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from("customer_profiles")
        .select("complement")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data || !data.complement) return null;
      if (data.complement.startsWith("[2FA]:")) {
        return data.complement.replace("[2FA]:", "").trim();
      }
    } catch (e) {
      console.error("Erro ao buscar segredo 2FA:", e);
    }
    return null;
  };

  const verifyAdmin2FA = async (code: string): Promise<boolean> => {
    const secret = await getAdmin2FASecret();
    if (!secret) return false;

    try {
      const totp = new OTPAuth.TOTP({
        issuer: "Lojas Maxx",
        label: user?.email || "Admin",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret,
      });

      const delta = totp.validate({ token: code, window: 1 });
      if (delta !== null) {
        setIsAdmin2FAApproved(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("loja-maxx-admin-2fa-approved", "true");
        }
        void logSecurityEvent("admin_access", { userId: user?.id, email: user?.email, metadata: { mfa: "success" } });
        return true;
      }
    } catch (e) {
      console.error("Erro ao validar TOTP:", e);
    }
    return false;
  };

  const setupAdmin2FA = async (secret: string, code: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const totp = new OTPAuth.TOTP({
        issuer: "Lojas Maxx",
        label: user.email || "Admin",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret,
      });

      const delta = totp.validate({ token: code, window: 1 });
      if (delta !== null) {
        // Salva o segredo no perfil do cliente usando o campo complement
        const { error } = await supabase
          .from("customer_profiles")
          .upsert({
            user_id: user.id,
            email: user.email,
            complement: `[2FA]:${secret}`,
            full_name: "Administrador",
            phone: "00000000000",
            address: "Painel Administrativo"
          }, { onConflict: "user_id" });

        if (error) throw error;

        setIsAdmin2FAApproved(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("loja-maxx-admin-2fa-approved", "true");
        }
        return true;
      }
    } catch (e) {
      console.error("Erro ao configurar TOTP:", e);
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isAdmin2FAApproved, loading, signIn, signUp, signOut, verifyAdmin2FA, setupAdmin2FA, getAdmin2FASecret }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};