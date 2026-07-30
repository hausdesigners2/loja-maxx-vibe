import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, KeyRound, Copy, Check, RefreshCw, LogOut } from "lucide-react";
import { toast } from "sonner";

export function Admin2FAGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isAdmin2FAApproved, verifyAdmin2FA, setupAdmin2FA, getAdmin2FASecret, user, signOut } = useAuth();
  const [hasSecret, setHasSecret] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isAdmin && !isAdmin2FAApproved) {
      getAdmin2FASecret().then((sec) => {
        if (sec) {
          setHasSecret(true);
        } else {
          setHasSecret(false);
          // Gera um novo segredo Base32 seguro de 16 caracteres
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
          let newSecret = "";
          for (let i = 0; i < 16; i++) {
            newSecret += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          setSecret(newSecret);
        }
      });
    }
  }, [isAdmin, isAdmin2FAApproved]);

  if (!isAdmin) return null;

  // Se já estiver aprovado, renderiza o conteúdo da página normalmente
  if (isAdmin2FAApproved) return <>{children}</>;

  if (hasSecret === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("O código deve ter exatamente 6 dígitos.");
      return;
    }

    setLoading(true);
    const success = await verifyAdmin2FA(code);
    setLoading(false);

    if (success) {
      toast.success("Acesso administrativo liberado!");
    } else {
      toast.error("Código inválido. Tente novamente.");
      setCode("");
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("O código deve ter exatamente 6 dígitos.");
      return;
    }

    setLoading(true);
    const success = await setupAdmin2FA(secret, code);
    setLoading(false);

    if (success) {
      toast.success("MFA configurado e ativado com sucesso!");
    } else {
      toast.error("Código de ativação inválido. Verifique o aplicativo.");
      setCode("");
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success("Chave copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  // URL do QR Code usando a API pública do Google Charts (geração de QR Code segura e rápida)
  const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(
    `otpauth://totp/Lojas%20Maxx:${user?.email || "Admin"}?secret=${secret}&issuer=Lojas%20Maxx`
  )}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 animate-fade-in">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-card p-6 border border-border/50 shadow-glow">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary shadow-glow">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">🔒 Verificação de Segurança</h1>
          <p className="text-xs text-muted-foreground">
            {hasSecret 
              ? "Insira o código de 6 dígitos do seu aplicativo autenticador." 
              : "Configure a autenticação em duas etapas para proteger sua conta."}
          </p>
        </div>

        {hasSecret ? (
          /* FORMULÁRIO DE VERIFICAÇÃO */
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="2fa-code" className="text-sm font-bold">Código de 6 dígitos</Label>
              <Input
                id="2fa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center text-2xl font-bold tracking-[0.5em] pl-[0.5em]"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-12 gradient-primary font-bold shadow-glow text-base"
            >
              {loading ? "Verificando..." : "Validar e Acessar"}
            </Button>
          </form>
        ) : (
          /* FORMULÁRIO DE CONFIGURAÇÃO INICIAL */
          <div className="space-y-5">
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-white p-2 rounded-xl aspect-square w-40 h-40 flex items-center justify-center shadow-md">
                <img src={qrCodeUrl} alt="QR Code de Configuração" className="w-full h-full object-contain" />
              </div>
              <p className="text-xs text-muted-foreground max-w-xs text-center">
                Escaneie o QR Code acima com o <strong>Google Authenticator</strong> ou <strong>Authy</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ou insira a chave manualmente</Label>
              <div className="relative flex items-center rounded-xl bg-secondary/40 p-3 border border-border/50">
                <span className="text-xs font-mono truncate pr-10 select-all flex-1 text-left">
                  {secret}
                </span>
                <button
                  onClick={copySecret}
                  className="absolute right-2 grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow transition active:scale-95"
                  title="Copiar chave"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <form onSubmit={handleSetup} className="space-y-4 pt-2 border-t border-border/50">
              <div className="space-y-2">
                <Label htmlFor="setup-code" className="text-sm font-bold">Digite o código gerado para ativar</Label>
                <Input
                  id="setup-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="h-12 text-center text-2xl font-bold tracking-[0.5em] pl-[0.5em]"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full h-12 gradient-primary font-bold shadow-glow text-base"
              >
                {loading ? "Ativando..." : "Ativar e Acessar"}
              </Button>
            </form>
          </div>
        )}

        <Button
          variant="outline"
          onClick={signOut}
          className="w-full h-11 text-xs gap-2 border-border hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Voltar para o início
        </Button>
      </div>
    </div>
  );
}