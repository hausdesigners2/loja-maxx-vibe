import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound, Copy, Check, LogOut, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function Admin2FAGuard({ children }: { children: React.ReactNode }) {
  const { 
    user, 
    isAdmin, 
    isAdmin2FAApproved, 
    getAdmin2FASecret, 
    setupAdmin2FA, 
    verifyAdmin2FA, 
    signOut 
  } = useAuth();

  const [isConfigured, setIsConfigured] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const checkConfig = async () => {
      const storageKey = `loja-maxx-admin-2fa-secret-${user.id}`;
      const savedSecret = localStorage.getItem(storageKey);
      
      if (savedSecret) {
        setIsConfigured(true);
        setSecret(savedSecret);
      } else {
        setIsConfigured(false);
        const newSecret = await getAdmin2FASecret();
        setSecret(newSecret);
      }
    };

    checkConfig();
  }, [user, isAdmin, getAdmin2FASecret]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (isAdmin2FAApproved) {
    return <>{children}</>;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || isNaN(Number(code))) {
      toast.error("Por favor, insira um código de 6 dígitos válido.");
      return;
    }

    setLoading(true);
    try {
      const success = await verifyAdmin2FA(code);
      if (success) {
        toast.success("Autenticação de dois fatores aprovada!");
      } else {
        toast.error("Código inválido. Tente novamente.");
        setCode("");
      }
    } catch (err) {
      toast.error("Erro ao verificar código.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) return;
    if (code.length !== 6 || isNaN(Number(code))) {
      toast.error("Por favor, insira um código de 6 dígitos válido.");
      return;
    }

    setLoading(true);
    try {
      const success = await setupAdmin2FA(secret, code);
      if (success) {
        setIsConfigured(true);
        toast.success("Autenticação de dois fatores configurada com sucesso!");
      } else {
        toast.error("Código de verificação incorreto. Verifique o aplicativo autenticador.");
        setCode("");
      }
    } catch (err) {
      toast.error("Erro ao configurar 2FA.");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success("Chave secreta copiada!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-card p-6 border border-border/40 shadow-card animate-fade-in">
        <div className="text-center space-y-2">
          <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary shadow-glow mx-auto">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-extrabold">Segurança do Administrador</h1>
          <p className="text-xs text-muted-foreground">
            {isConfigured 
              ? "Insira o código de 6 dígitos do seu aplicativo autenticador." 
              : "Configure a autenticação de dois fatores (2FA) para proteger sua conta."}
          </p>
        </div>

        {isConfigured ? (
          /* Verification Form */
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="2fa-code" className="text-sm font-bold">Código de Verificação</Label>
              <Input
                id="2fa-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center text-lg font-mono tracking-[0.5em] bg-background border-border"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-12 gradient-primary font-bold shadow-glow text-base"
            >
              {loading ? "Verificando..." : "Entrar no Painel"}
            </Button>
          </form>
        ) : (
          /* Setup Form */
          <form onSubmit={handleSetup} className="space-y-5">
            <div className="rounded-xl bg-primary/5 p-3.5 border border-primary/20 flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
              <KeyRound className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <span className="font-bold text-foreground block">Como configurar:</span>
                1. Baixe um aplicativo autenticador (Google Authenticator, Authy, etc.).<br />
                2. Adicione uma nova conta manualmente usando a chave secreta abaixo.
              </div>
            </div>

            {secret && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Chave Secreta</Label>
                <div className="relative flex items-center rounded-xl bg-secondary/40 p-3 border border-border/50">
                  <span className="text-xs font-mono select-all flex-1 text-left truncate pr-10">
                    {secret}
                  </span>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="absolute right-2 grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow transition active:scale-95"
                    title="Copiar chave secreta"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="setup-code" className="text-sm font-bold">Código de Confirmação</Label>
              <Input
                id="setup-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center text-lg font-mono tracking-[0.5em] bg-background border-border"
              />
              <p className="text-[10px] text-muted-foreground text-center">
                Insira o código gerado pelo aplicativo para confirmar a configuração.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-12 gradient-primary font-bold shadow-glow text-base"
            >
              {loading ? "Configurando..." : "Confirmar e Ativar 2FA"}
            </Button>
          </form>
        )}

        <div className="pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            onClick={() => signOut()}
            className="w-full h-10 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}