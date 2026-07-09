import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Shield, Bell } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NotificationSettings } from "@/components/admin/NotificationSettings";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Admin2FAGuard } from "@/components/Admin2FAGuard";

export default function AdminNotificationsPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <navigate to="/auth" replace />;
  if (!isAdmin) return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">Acesso negado</h1>
      <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
    </div>
  );

  return (
    <Admin2FAGuard>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronLeft className="h-4 w-4" /> Painel
            </Link>
            <h1 className="text-base font-bold">Notificações</h1>
          </div>
        </header>

        <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
          <NotificationSettings />
        </main>
      </div>
    </Admin2FAGuard>
  );
}