import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { passwordSchema, friendlyAuthError } from "@/lib/security";

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase recovery link sets a session via URL hash; listen for it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const handle = async () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Senha inválida."); return; }
    if (password !== confirm) { toast.error("As senhas não coincidem."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(friendlyAuthError(error.message)); return; }
    setDone(true);
    toast.success("Senha atualizada!");
    setTimeout(() => { void supabase.auth.signOut().then(() => nav("/auth")); }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary shadow-glow">
            <ShoppingBag className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold">Nova senha</h1>
          <p className="text-sm text-muted-foreground">Defina uma nova senha para sua conta</p>
        </div>

        {done ? (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-3 font-semibold">Senha atualizada com sucesso!</p>
            <p className="text-sm text-muted-foreground">Redirecionando para o login...</p>
          </div>
        ) : !ready ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Validando link de recuperação...
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pass">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-pass"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground hover:text-foreground active:scale-95"
                >
                  {show ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pass">Confirmar senha</Label>
              <Input
                id="confirm-pass"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12"
              />
            </div>
            <Button
              onClick={handle}
              disabled={loading}
              className="h-12 w-full gradient-primary text-base font-bold shadow-glow transition-transform active:scale-[0.98]"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
