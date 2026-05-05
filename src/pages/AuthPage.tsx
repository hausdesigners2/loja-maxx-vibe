import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { authSchema, friendlyAuthError } from "@/lib/security";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState<string | null>(null);

  const handle = async (mode: "in" | "up") => {
    const parsed = authSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setLoading(true);
    const { error } = mode === "in"
      ? await signIn(parsed.data.email, parsed.data.password)
      : await signUp(parsed.data.email, parsed.data.password);
    setLoading(false);
    if (error) { toast.error(friendlyAuthError(error)); return; }

    if (mode === "in") {
      toast.success("Bem-vindo!");
      nav("/conta");
    } else {
      // Cadastro concluído: limpar form, mostrar confirmação e voltar para aba de login
      const usedEmail = parsed.data.email;
      toast.success("Conta criada com sucesso!");
      setEmail("");
      setPassword("");
      setSignupDone(usedEmail);
      setTab("in");
    }
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
          <h1 className="text-2xl font-extrabold">Loja Maxx</h1>
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
            <Tabs value={tab} onValueChange={(v) => setTab(v as "in" | "up")} className="mt-6">
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
                    <Input id={`${mode}-pass`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
                  </div>
                  <Button onClick={() => handle(mode)} disabled={loading}
                    className="h-12 w-full gradient-primary text-base font-bold shadow-glow">
                    {loading ? "Aguarde..." : mode === "in" ? "Entrar" : "Criar conta"}
                  </Button>
                </TabsContent>
              ))}
            </Tabs>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Para virar admin, crie a conta e use o painel do banco para adicionar a função "admin".
            </p>
          </>
        )}
      </div>
    </div>
  );
}
