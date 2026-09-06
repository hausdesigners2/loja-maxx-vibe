import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { formatAuthError, logSecurityEvent } from "@/lib/security";
import { verifyTOTP } from "@/lib/totp";
import { loginOneSignalUser, logoutOneSignalUser } from "@/lib/onesignal";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isAdmin2FAApproved: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: any; error: string | null; errorDetails?: AuthError | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ data: any; error: string | null; errorDetails?: AuthError | null }>;
  signOut: () => Promise<void>;
  verifyAdmin2FA: (code: string) => Promise<boolean>;
  setupAdmin2FA: (secret: string, code: string) => Promise<boolean>;
  getAdmin2FASecret: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// 30 minutes of inactivity → automatic logout
const INACTIVITY_MS = 30 * 60 * 1000;

// Helper to generate a secure random Base32 secret for TOTP
function generateBase32Secret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  if (typeof window !== "undefined" && window.crypto) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      secret += chars.charAt(array[i] % chars.length);
    }
  } else {
    for (let i = 0; i < 16; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return secret;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdmin2FAApproved, setIsAdmin2FAApproved] = useState(false);
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
        const admin = await checkAdmin(sess.user.id);
        // Link authenticated user session with OneSignal external_id
        loginOneSignalUser(sess.user.id);
        
        if (admin) {
          // Admins must always pass the 2FA challenge on a new session
          setIsAdmin2FAApproved(false);
        } else {
          setIsAdmin2FAApproved(true);
        }
      } else {
        setIsAdmin(false);
        setIsAdmin2FAApproved(true);
        // Logout user from OneSignal session tracking
        logoutOneSignalUser();
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
    await supabase.auth.signOut();
  };

  const getAdmin2FASecret = async (): Promise<string | null> => {
    if (!user) return null;
    const storageKey = `loja-maxx-admin-2fa-secret-${user.id}`;
    let secret = localStorage.getItem(storageKey);
    if (!secret) {
      secret = generateBase32Secret();
    }
    return secret;
  };

  const verifyAdmin2FA = async (code: string): Promise<boolean> => {
    if (!user) return false;
    const storageKey = `loja-maxx-admin-2fa-secret-${user.id}`;
    const secret = localStorage.getItem(storageKey);
    if (!secret) return false;

    const isValid = await verifyTOTP(secret, code);
    if (isValid) {
      setIsAdmin2FAApproved(true);
      void logSecurityEvent("admin_access", { userId: user.id, email: user.email, metadata: { mfa: "totp_success" } });
    } else {
      void logSecurityEvent("admin_access_denied", { userId: user.id, email: user.email, metadata: { mfa: "totp_failed" } });
    }
    return isValid;
  };

  const setupAdmin2FA = async (secret: string, code: string): Promise<boolean> => {
    if (!user) return false;
    const isValid = await verifyTOTP(secret, code);
    if (isValid) {
      const storageKey = `loja-maxx-admin-2fa-secret-${user.id}`;
      localStorage.setItem(storageKey, secret);
      setIsAdmin2FAApproved(true);
      void logSecurityEvent("admin_access", { userId: user.id, email: user.email, metadata: { mfa: "setup_success" } });
      return true;
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