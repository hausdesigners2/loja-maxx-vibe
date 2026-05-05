import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Shield, User as UserIcon, Heart, ShoppingBag, Save, Package } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

interface Profile {
  full_name: string;
  phone: string;
  address: string;
  complement: string;
  city: string;
  state: string;
  zip: string;
}

const empty: Profile = { full_name: "", phone: "", address: "", complement: "", city: "", state: "", zip: "" };

export default function AccountPage() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(empty);
  const [orders, setOrders] = useState<{ id: string; created_at: string; total: number; status: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("customer_profiles")
        .select("full_name, phone, address, complement, city, state, zip")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile({ ...empty, ...data });

      const { data: ord } = await supabase
        .from("orders")
        .select("id, created_at, total, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setOrders(ord ?? []);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("customer_profiles")
      .upsert({ user_id: user.id, email: user.email, ...profile }, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dados salvos com sucesso!");
    setSaved(true);
    setTimeout(() => navigate("/"), 1500);
  };

  if (!user) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-secondary">
            <UserIcon className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">Entrar na Loja Maxx</h1>
          <p className="max-w-xs text-sm text-muted-foreground">Faça login ou crie sua conta para aproveitar todas as vantagens!</p>
          <Button asChild className="gradient-primary shadow-glow"><Link to="/auth">Entrar / Criar conta</Link></Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5 animate-fade-in pb-8">
        <div className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full gradient-primary text-lg font-bold text-primary-foreground">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold">{user.email}</p>
              {isAdmin && <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><Shield className="h-3 w-3" /> Administrador</span>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 space-y-3">
          <h2 className="text-sm font-bold">Meus dados</h2>
          <Field label="Nome completo" v={profile.full_name} on={(v) => setProfile({ ...profile, full_name: v })} />
          <Field label="Telefone (WhatsApp)" v={profile.phone} on={(v) => setProfile({ ...profile, phone: v })} placeholder="(11) 99999-9999" />
          <Field label="Endereço" v={profile.address} on={(v) => setProfile({ ...profile, address: v })} placeholder="Rua, número, bairro" />
          <Field label="Complemento" v={profile.complement} on={(v) => setProfile({ ...profile, complement: v })} placeholder="Apto, casa..." />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cidade" v={profile.city} on={(v) => setProfile({ ...profile, city: v })} />
            <Field label="UF" v={profile.state} on={(v) => setProfile({ ...profile, state: v })} />
          </div>
          <Field label="CEP" v={profile.zip} on={(v) => setProfile({ ...profile, zip: v })} />
          <Button onClick={save} disabled={saving} className="w-full gradient-primary">
            <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar dados"}
          </Button>
        </div>

        {orders.length > 0 && (
          <div className="rounded-2xl bg-card p-4 space-y-2">
            <h2 className="text-sm font-bold flex items-center gap-2"><Package className="h-4 w-4" /> Meus pedidos</h2>
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-t border-border pt-2 text-xs">
                <div>
                  <div className="font-semibold">#{o.id.slice(0, 8)}</div>
                  <div className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")} · {o.status}</div>
                </div>
                <div className="font-bold text-primary">{formatBRL(Number(o.total))}</div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Link to="/favoritos" className="flex items-center gap-3 rounded-2xl bg-card p-4">
            <Heart className="h-5 w-5 text-primary" /> <span className="text-sm font-medium">Meus favoritos</span>
          </Link>
          <Link to="/carrinho" className="flex items-center gap-3 rounded-2xl bg-card p-4">
            <ShoppingBag className="h-5 w-5 text-primary" /> <span className="text-sm font-medium">Meu carrinho</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-3 rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/30">
              <Shield className="h-5 w-5 text-primary" /> <span className="text-sm font-bold text-primary">Painel administrativo</span>
            </Link>
          )}
        </div>

        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </AppShell>
  );
}

function Field({ label, v, on, placeholder }: { label: string; v: string; on: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} className="h-10" />
    </div>
  );
}
