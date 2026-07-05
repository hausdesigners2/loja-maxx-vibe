import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag, CheckCircle2, Eye, EyeOff, KeyRound, AlertCircle } from "lucide-react";
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
  const { signIn, signUp } = useAuth();
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
        ) : (
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