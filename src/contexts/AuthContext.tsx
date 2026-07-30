import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { formatAuthError, logSecurityEvent } from "@/lib/security";
import { loginOneSignalUser, logoutOneSignalUser } from "@/lib/onesignal";
import { generateTOTP, verifyTOTP } from "@/lib/totp";
import QRCode from "qrcode";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isAdmin2FAApproved: boolean;
  loading: boolean;
  useCustomMFA: boolean;
  signIn: (email: string, password: string) => Promise<{ data: any; error: string | null; errorDetails?: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ data: any; error: string | null; errorDetails?: AuthError | null }>;
  signOut: () => Promise<void>;
  verifyAdmin2FA: (code: string) => Promise<boolean>;
  setupAdmin2FA: (secret: string, code: string) => Promise<boolean>;
  getAdmin2FASecret: () => Promise<{ secret: string; qrCode: string } | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  const [mfaFactor, setMfaFactor] = useState<any>(null);
  const [useCustomMFA, setUseCustomMFA] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("loja-maxx-use-custom-mfa") === "true";
    }
    return false;
  });
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
        loginOneSignalUser(sess.user.id);
      } else {
        setIsAdmin(false);
        setIsAdmin2FAApproved(false);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("loja-maxx-admin-2fa-approved");
        }
        logoutOneSignalUser();
      }
      if (active) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setLoading(true);
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
    return { data, error: error ? formatAuthError(error) : null, errorDetails: error };
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

  const getLocal2FASecret = async (): Promise<{ secret: string; qrCode: string } | null> => {
    if (!user) return null;
    let localSecret = localStorage.getItem(`loja-maxx-2fa-secret:${user.id}`);
    if (!localSecret) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      localSecret = "";
      for (let i = 0; i < 16; i++) {
        localSecret += chars[Math.floor(Math.random() * chars.length)];
      }
      localStorage.setItem(`loja-maxx-2fa-secret:${user.id}`, localSecret);
    }

    const otpauthUrl = `otpauth://totp/Lojas%20Maxx:${encodeURIComponent(user.email || "Admin")}?secret=${localSecret}&issuer=Lojas%20Maxx`;
    
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return {
        secret: localSecret,
        qrCode: qrCodeDataUrl
      };
    } catch (qrErr) {
      console.error("[AuthContext] Erro ao gerar QR Code local:", qrErr);
    }
    return null;
  };

  const getAdmin2FASecret = async (): Promise<{ secret: string; qrCode: string } | null> => {
    if (!user) return null;

    if (useCustomMFA) {
      return getLocal2FASecret();
    }

    try {
      // 1. Tenta usar o MFA nativo do Supabase
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const unverifiedFactors = factors?.all?.filter(f => f.status === 'unverified') || [];
      for (const factor of unverifiedFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Lojas Maxx',
        friendlyName: user.email || 'Admin'
      });

      if (error) {
        throw error; // Força o fallback para o TOTP local se houver erro na API do Supabase
      }

      if (data) {
        setMfaFactor(data);
        setUseCustomMFA(false);
        localStorage.setItem("loja-maxx-use-custom-mfa", "false");
        return {
          secret: data.totp.secret,
          qrCode: data.totp.qr_code
        };
      }
    } catch (e) {
      console.warn("[AuthContext] Supabase MFA nativo indisponível ou desativado. Usando fallback local seguro.", e);
    }

    // 2. Fallback local seguro (TOTP gerado localmente)
    setUseCustomMFA(true);
    localStorage.setItem("loja-maxx-use-custom-mfa", "true");
    return getLocal2FASecret();
  };

  const verifyAdmin2FA = async (code: string): Promise<boolean> => {
    if (!user) return false;

    if (useCustomMFA) {
      const localSecret = localStorage.getItem(`loja-maxx-2fa-secret:${user.id}`);
      if (!localSecret) return false;
      const isValid = await verifyTOTP(localSecret, code);
      if (isValid) {
        setIsAdmin2FAApproved(true);
        sessionStorage.setItem("loja-maxx-admin-2fa-approved", "true");
        localStorage.setItem(`loja-maxx-2fa-verified:${user.id}`, "true");
        void logSecurityEvent("admin_access", { userId: user.id, email: user.email, metadata: { mfa: "success_local" } });
        return true;
      }
      return false;
    }

    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const activeFactor = factors?.all?.find(f => f.status === 'verified');
      if (!activeFactor) return false;

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: activeFactor.id
      });
      if (challengeError) throw challengeError;

      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: activeFactor.id,
        challengeId: challenge.id,
        code: code
      });

      if (verifyError) throw verifyError;

      setIsAdmin2FAApproved(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("loja-maxx-admin-2fa-approved", "true");
      }
      void logSecurityEvent("admin_access", { userId: user.id, email: user.email, metadata: { mfa: "success" } });
      return true;
    } catch (e) {
      console.error("Erro ao verificar MFA nativo:", e);
    }
    return false;
  };

  const setupAdmin2FA = async (secret: string, code: string): Promise<boolean> => {
    if (!user) return false;

    if (useCustomMFA) {
      const isValid = await verifyTOTP(secret, code);
      if (isValid) {
        setIsAdmin2FAApproved(true);
        sessionStorage.setItem("loja-maxx-admin-2fa-approved", "true");
        localStorage.setItem(`loja-maxx-2fa-verified:${user.id}`, "true");
        return true;
      }
      return false;
    }

    if (!mfaFactor) return false;

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactor.id
      });
      if (challengeError) throw challengeError;

      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactor.id,
        challengeId: challenge.id,
        code: code
      });

      if (verifyError) throw verifyError;

      setIsAdmin2FAApproved(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("loja-maxx-admin-2fa-approved", "true");
      }
      return true;
    } catch (e) {
      console.error("Erro ao configurar MFA nativo:", e);
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isAdmin2FAApproved, loading, useCustomMFA, signIn, signUp, signOut, verifyAdmin2FA, setupAdmin2FA, getAdmin2FASecret }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};