import { Link } from "react-router-dom";
import { LogOut, Shield, User as UserIcon, Heart, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function AccountPage() {
  const { user, isAdmin, signOut } = useAuth();

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
      <div className="space-y-5 animate-fade-in">
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
