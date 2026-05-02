import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { authSchema, friendlyAuthError } from "@/lib/security";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
    toast.success(mode === "in" ? "Bem-vindo!" : "Conta criada! Verifique seu email.");
    nav("/conta");
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

        <Tabs defaultValue="in" className="mt-8">
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
      </div>
    </div>
  );
}
