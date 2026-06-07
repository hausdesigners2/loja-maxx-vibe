import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
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

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handle = async (mode: "in" | "up") => {
    console.log(`[AuthPage] handle(${mode}) chamado`, { email, passwordLength: password.length });
    const parsed = authSchema.safeParse({ email, password });
    if (!parsed.success) {
      console.warn(`[AuthPage] validação falhou:`, parsed.error.issues);
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    console.log(`[AuthPage] validação ok, chamando ${mode === "in" ? "signIn" : "signUp"}...`);
    setLoading(true);
    let result;
    try {
      result = mode === "in"
        ? await signIn(parsed.data.email, parsed.data.password)
        : await signUp(parsed.data.email, parsed.data.password);
      console.log(`[AuthPage] resposta do ${mode === "in" ? "signIn" : "signUp"}:`, result);
    } catch (err) {
      console.error(`[AuthPage] exceção em ${mode}:`, err);
      setLoading(false);
      toast.error("Erro inesperado", { description: String((err as Error)?.message ?? err) });
      return;
    }
    setLoading(false);
    const { error, errorDetails } = result;
    if (error) {
      console.error(`[AuthPage] Erro completo no ${mode === "in" ? "login" : "cadastro"}:`, errorDetails ?? error);
      toast.error(friendlyAuthError(error), { description: formatAuthError(errorDetails ?? error) });
      return;
    }

    if (mode === "in") {
      toast.success("Bem-vindo!");
      nav("/", { replace: true });
    } else {
      const usedEmail = parsed.data.email;
      console.log(`[AuthPage] cadastro concluído com sucesso para`, usedEmail);
      toast.success("Conta criada com sucesso!");
      setEmail("");
      setPassword("");
      setSignupDone(usedEmail);
      setTab("in");
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
    <div className="min-h-screen bg-background">
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
            <Tabs value={tab} onValueChange={(v) => { setTab(v as "in" | "up"); setShowPass(false); }} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">Entrar</TabsTrigger>
                <TabsTrigger value="up">Criar conta</TabsTrigger>
              </TabsList>

              {(["in", "up"] as const).map((mode) => (
                <TabsContent key={mode} value={mode} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${mode}-email`}>Email</Label>
                    <Input id={`${mode}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${mode}-pass`}>Senha</Label>
                    <div className="relative">
                      <Input
                        id={`${mode}-pass`}
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
                    onClick={() => handle(mode)}
                    disabled={loading}
                    className="h-12 w-full gradient-primary text-base font-bold shadow-glow transition-transform active:scale-[0.98]"
                  >
                    {loading ? "Aguarde..." : mode === "in" ? "Entrar" : "Criar conta"}
                  </Button>

                  {mode === "in" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                      className="h-12 w-full rounded-xl border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary transition-transform active:scale-[0.98]"
                    >
                      <KeyRound className="h-4 w-4" />
                      Esqueci minha senha
                    </Button>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>

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
    </div>
  );
}
