import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag, CheckCircle2, Eye, EyeOff, KeyRound, AlertCircle, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { authSchema, emailSchema, formatAuthError, friendlyAuthError } from "@/lib/security";
import { supabase } from "@/integrations/supabase/client";
import { LegalDocumentModal, TERMS_VERSION, PRIVACY_VERSION } from "@/components/LegalDocuments";

export default function AuthPage() {
  const { signIn, signUp, verifyAdmin2FA, setupAdmin2FA, signOut } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState<string | null>(null);

  // Campos adicionais para cadastro completo
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Estados para os Modais de Termos e Privacidade
  const [legalModalType, setLegalModalType] = useState<"terms" | "privacy" | null>(null);

  // Estados exclusivos para 2FA do Administrador na tela de Login
  const [showAdmin2FA, setShowAdmin2FA] = useState(false);
  const [admin2FACode, setAdmin2FACode] = useState("");
  const [admin2FASecret, setAdmin2FASecret] = useState<string | null>(null);
  const [hasSecret, setHasSecret] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  // Formata o telefone com máscara (99) 99999-9999
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const formatted = raw
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d)(\d{4})$/, "$1-$2")
      .substring(0, 15);
    setPhone(formatted);
  };

  const handleCheckboxChange = (checked: boolean) => {
    setAcceptedTerms(checked);
    if (checked) {
      setValidationError(null);
    }
  };

  const handle = async (mode: "in" | "up") => {
    console.log(`[AuthPage] handle(${mode}) chamado`, { email, passwordLength: password.length });
    
    // Validação básica de email e senha
    const parsed = authSchema.safeParse({ email, password });
    if (!parsed.success) {
      console.warn(`[AuthPage] validação falhou:`, parsed.error.issues);
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    // Validações adicionais exclusivas para o cadastro completo
    if (mode === "up") {
      if (!fullName.trim()) {
        toast.error("Por favor, informe seu nome completo.");
        return;
      }
      if (phone.replace(/\D/g, "").length < 10) {
        toast.error("Por favor, informe um telefone válido com DDD.");
        return;
      }
      if (!address.trim()) {
        toast.error("Por favor, informe seu endereço de entrega.");
        return;
      }
      if (!acceptedTerms) {
        setValidationError("Você precisa ler e aceitar os Termos de Uso e a Política de Privacidade para criar sua conta.");
        toast.error("Você precisa ler e aceitar os Termos de Uso e a Política de Privacidade para criar sua conta.");
        return;
      }
    }

    console.log(`[AuthPage] validação ok, chamando ${mode === "in" ? "signIn" : "signUp"}...`);
    setLoading(true);
    let result;
    try {
      if (mode === "in") {
        result = await signIn(parsed.data.email, parsed.data.password);
      } else {
        // Passa os metadados adicionais para o Supabase Auth (Backend Validation & Storage)
        result = await signUp(parsed.data.email, parsed.data.password, {
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          accepted_terms: true,
          accepted_privacy: true,
          accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION
        });
      }
      console.log(`[AuthPage] resposta do ${mode === "in" ? "signIn" : "signUp"}:`, result);
    } catch (err) {
      console.error(`[AuthPage] exceção em ${mode}:`, err);
      setLoading(false);
      toast.error("Erro inesperado", { description: String((err as Error)?.message ?? err) });
      return;
    }

    const { error, errorDetails, data } = (result as any);
    if (error) {
      setLoading(false);
      console.error(`[AuthPage] Erro completo no ${mode === "in" ? "login" : "cadastro"}:`, errorDetails ?? error);
      toast.error(friendlyAuthError(error), { description: formatAuthError(errorDetails ?? error) });
      return;
    }

    if (mode === "in") {
      if (data?.user) {
        // Verifica se o usuário que está logando é administrador
        const { data: isAdminRole, error: roleError } = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "admin"
        });

        if (!roleError && isAdminRole === true) {
          // É administrador! Checar se já tem 2FA aprovado nesta aba/sessão
          const isApproved = sessionStorage.getItem("loja-maxx-admin-2fa-approved") === "true";
          if (!isApproved) {
            // Verifica se o admin já tem uma chave 2FA configurada em seu perfil
            const { data: profileData } = await supabase
              .from("customer_profiles")
              .select("complement")
              .eq("user_id", data.user.id)
              .maybeSingle();

            const existingSecret = profileData?.complement?.startsWith("[2FA]:")
              ? profileData.complement.replace("[2FA]:", "").trim()
              : null;

            if (existingSecret) {
              setAdmin2FASecret(existingSecret);
              setHasSecret(true);
            } else {
              // Caso não tenha segredo, inicia o fluxo de configuração do 2FA
              const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
              let newSecret = "";
              for (let i = 0; i < 16; i++) {
                newSecret += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              setAdmin2FASecret(newSecret);
              setHasSecret(false);
            }

            setShowAdmin2FA(true);
            setLoading(false);
            return; // Pausa o login normal e exibe a tela de 2FA obrigatória
          }
        }
      }

      toast.success("Bem-vindo!");
      setLoading(false);
      nav("/", { replace: true });
    } else {
      const usedEmail = parsed.data.email;
      console.log(`[AuthPage] cadastro concluído com sucesso para`, usedEmail);
      
      // Se o usuário foi autenticado imediatamente (confirmação de e-mail desativada)
      if (data?.session) {
        try {
          // Salva os dados diretamente na tabela customer_profiles com o registro de aceite
          const { error: profileError } = await supabase
            .from("customer_profiles")
            .upsert({
              user_id: data.user.id,
              full_name: fullName.trim(),
              phone: phone.trim(),
              address: address.trim(),
              email: usedEmail,
              complement: `[Accepted Terms ${TERMS_VERSION} & Privacy ${PRIVACY_VERSION} at ${new Date().toLocaleDateString("pt-BR")}]`
            }, { onConflict: "user_id" });

          if (profileError) {
            console.error("[AuthPage] Erro ao salvar perfil do cliente:", profileError);
          }
        } catch (profileErr) {
          console.error("[AuthPage] Exceção ao salvar perfil do cliente:", profileErr);
        }
        
        toast.success("Conta criada com sucesso!");
        setLoading(false);
        nav("/", { replace: true });
      } else {
        toast.success("Conta criada com sucesso!");
        setEmail("");
        setPassword("");
        setFullName("");
        setPhone("");
        setAddress("");
        setAcceptedTerms(false);
        setSignupDone(usedEmail);
        setTab("in");
        setLoading(false);
      }
    }
  };

  const handleForgot = async () => {
    const parsed = emailSchema.safeParse(forgotEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Email inválido.");
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) {
      console.error("Lovable Cloud auth password reset error:", error);
      toast.error(friendlyAuthError(error.message), { description: formatAuthError(error) });
      return;
    }
    toast.success("Enviamos um link de redefinição para seu email.");
    setForgotOpen(false);
    setForgotEmail("");
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-md px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary shadow-glow">
            <ShoppingBag className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold">Lojas Maxx</h1>
          <p className="text-sm text-muted-foreground">Entre ou crie sua conta</p>
        </div>

        {signupDone ? (
          <div className="mt-8 space-y-5 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15">
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Cadastro realizado com sucesso!</h2>
              <p className="text-sm text-muted-foreground">
                Enviamos um email de confirmação para <strong className="text-foreground">{signupDone}</strong>.
                Confirme seu email para acessar sua conta.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => nav("/")} className="h-12 w-full gradient-primary text-base font-bold shadow-glow">
                Continuar navegando
              </Button>
              <Button
                variant="outline"
                onClick={() => { setSignupDone(null); setTab("in"); }}
                className="h-12 w-full"
              >
                Ir para o login
              </Button>
            </div>
          </div>
        ) : showAdmin2FA ? (
          /* TELA 2FA OBRIGATÓRIA PARA ADMINISTRADORES */
          (() => {
            const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(
              `otpauth://totp/Lojas%20Maxx:${email || "Admin"}?secret=${admin2FASecret}&issuer=Lojas%20Maxx`
            )}`;

            const handleVerify2FA = async (e: React.FormEvent) => {
              e.preventDefault();
              if (admin2FACode.length !== 6) {
                toast.error("O código deve ter exatamente 6 dígitos.");
                return;
              }

              setLoading(true);
              const success = await verifyAdmin2FA(admin2FACode);
              setLoading(false);

              if (success) {
                toast.success("Acesso administrativo liberado!");
                nav("/admin", { replace: true });
              } else {
                toast.error("Código inválido. Tente novamente.");
                setAdmin2FACode("");
              }
            };

            const handleSetup2FA = async (e: React.FormEvent) => {
              e.preventDefault();
              if (admin2FACode.length !== 6) {
                toast.error("O código deve ter exatamente 6 dígitos.");
                return;
              }

              setLoading(true);
              const success = await setupAdmin2FA(admin2FASecret!, admin2FACode);
              setLoading(false);

              if (success) {
                toast.success("MFA configurado e ativado com sucesso!");
                nav("/admin", { replace: true });
              } else {
                toast.error("Código de ativação inválido. Verifique o aplicativo.");
                setAdmin2FACode("");
              }
            };

            const copySecret = () => {
              if (!admin2FASecret) return;
              navigator.clipboard.writeText(admin2FASecret);
              setCopied(true);
              toast.success("Chave copiada para a área de transferência!");
              setTimeout(() => setCopied(false), 2000);
            };

            return (
              <div className="mt-6 space-y-6 animate-fade-in bg-card p-6 rounded-2xl border border-border/50">
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold">🔒 Verificação de Segurança (2FA)</h2>
                  <p className="text-xs text-muted-foreground">
                    {hasSecret 
                      ? "Insira o código de 6 dígitos do seu aplicativo autenticador para acessar sua conta administrativa." 
                      : "Configure a autenticação em duas etapas para proteger sua conta administrativa."}
                  </p>
                </div>

                {hasSecret ? (
                  /* VERIFICAÇÃO */
                  <form onSubmit={handleVerify2FA} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="auth-2fa-code" className="text-sm font-bold">Código de 6 dígitos</Label>
                      <Input
                        id="auth-2fa-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="000000"
                        value={admin2FACode}
                        onChange={(e) => setAdmin2FACode(e.target.value.replace(/\D/g, ""))}
                        className="h-12 text-center text-2xl font-bold tracking-[0.5em] pl-[0.5em]"
                        autoFocus
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || admin2FACode.length !== 6}
                      className="w-full h-12 gradient-primary font-bold shadow-glow text-base"
                    >
                      {loading ? "Verificando..." : "Validar e Acessar"}
                    </Button>
                  </form>
                ) : (
                  /* CONFIGURAÇÃO */
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
                          {admin2FASecret}
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

                    <form onSubmit={handleSetup2FA} className="space-y-4 pt-2 border-t border-border/50">
                      <div className="space-y-2">
                        <Label htmlFor="auth-setup-code" className="text-sm font-bold">Digite o código gerado para ativar</Label>
                        <Input
                          id="auth-setup-code"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          placeholder="000000"
                          value={admin2FACode}
                          onChange={(e) => setAdmin2FACode(e.target.value.replace(/\D/g, ""))}
                          className="h-12 text-center text-2xl font-bold tracking-[0.5em] pl-[0.5em]"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || admin2FACode.length !== 6}
                        className="w-full h-12 gradient-primary font-bold shadow-glow text-base"
                      >
                        {loading ? "Ativando..." : "Ativar e Acessar"}
                      </Button>
                    </form>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={async () => {
                    setShowAdmin2FA(false);
                    setAdmin2FACode("");
                    setAdmin2FASecret(null);
                    setHasSecret(null);
                    await signOut();
                  }}
                  className="w-full h-11 text-xs gap-2 border-border hover:bg-secondary"
                >
                  Voltar para o login
                </Button>
              </div>
            );
          })()
        ) : (
          /* FORMULÁRIO DE LOGIN NORMAL */
          <>
            <Tabs value={tab} onValueChange={(v) => { setTab(v as "in" | "up"); setShowPass(false); setValidationError(null); }} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">Entrar</TabsTrigger>
                <TabsTrigger value="up">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="in" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="in-email">Email</Label>
                  <Input id="in-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="in-pass">Senha</Label>
                  <div className="relative">
                    <Input
                      id="in-pass"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground transition-colors hover:text-foreground active:scale-95"
                    >
                      {showPass ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <Button
                  onClick={() => handle("in")}
                  disabled={loading}
                  className="h-12 w-full gradient-primary text-base font-bold shadow-glow transition-transform active:scale-[0.98]"
                >
                  {loading ? "Aguarde..." : "Entrar"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                  className="h-12 w-full rounded-xl border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary transition-transform active:scale-[0.98]"
                >
                  <KeyRound className="h-4 w-4" />
                  Esqueci minha senha
                </Button>
              </TabsContent>

              <TabsContent value="up" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="up-fullname">Nome Completo *</Label>
                  <Input id="up-fullname" type="text" placeholder="Seu nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="up-phone">Telefone (WhatsApp) *</Label>
                  <Input id="up-phone" type="tel" placeholder="(11) 99999-9999" value={phone} onChange={handlePhoneChange} className="h-12" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="up-address">Endereço de Entrega *</Label>
                  <Input id="up-address" type="text" placeholder="Rua, número, bairro" value={address} onChange={(e) => setAddress(e.target.value)} className="h-12" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="up-email">Email *</Label>
                  <Input id="up-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="up-pass">Senha *</Label>
                  <div className="relative">
                    <Input
                      id="up-pass"
                      type={showPass ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground transition-colors hover:text-foreground active:scale-95"
                    >
                      {showPass ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {validationError && (
                  <div className="rounded-xl bg-red-500/10 p-3 border border-red-500/20 flex items-start gap-2 text-xs text-red-500 animate-fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div className="flex items-start gap-2.5 pt-2">
                  <input
                    id="up-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => handleCheckboxChange(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border bg-card text-primary focus:ring-primary cursor-pointer"
                  />
                  <Label htmlFor="up-terms" className="text-xs leading-normal text-muted-foreground cursor-pointer select-none">
                    Li e aceito os{" "}
                    <button
                      type="button"
                      onClick={() => setLegalModalType("terms")}
                      className="text-primary underline font-semibold hover:text-primary/80"
                    >
                      Termos de Uso
                    </button>{" "}
                    e a{" "}
                    <button
                      type="button"
                      onClick={() => setLegalModalType("privacy")}
                      className="text-primary underline font-semibold hover:text-primary/80"
                    >
                      Política de Privacidade
                    </button>{" "}
                    da Lojas Maxx.
                  </Label>
                </div>

                <Button
                  onClick={() => handle("up")}
                  disabled={loading}
                  className="h-12 w-full gradient-primary text-base font-bold shadow-glow transition-transform active:scale-[0.98] mt-2"
                >
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Modal de Recuperação de Senha */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe seu email cadastrado. Enviaremos um link para você criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="h-12"
              placeholder="seu@email.com"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setForgotOpen(false)} className="h-12">
              Cancelar
            </Button>
            <Button
              onClick={handleForgot}
              disabled={forgotLoading}
              className="h-12 gradient-primary font-bold shadow-glow"
            >
              {forgotLoading ? "Enviando..." : "Enviar link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Termos de Uso e Política de Privacidade */}
      <Dialog open={legalModalType !== null} onOpenChange={(open) => !open && setLegalModalType(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden">
          {legalModalType && (
            <LegalDocumentModal
              type={legalModalType}
              onClose={() => setLegalModalType(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}