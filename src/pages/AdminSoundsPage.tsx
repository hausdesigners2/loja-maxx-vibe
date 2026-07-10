import { Link, Navigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Admin2FAGuard } from "@/components/Admin2FAGuard";
import { AdminNotificationSettingsPanel } from "@/components/AdminNotificationSettingsPanel";

export default function AdminSoundsPage() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">Acesso negado</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sua conta não tem permissão de administrador.</p>
      <Link to="/" className="text-primary underline">Voltar</Link>
    </div>
  );

  return (
    <Admin2FAGuard>
      <div className="min-h-screen bg-background pb-8">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Painel
            </Link>
            <h1 className="text-base font-bold">Gerenciar Sons</h1>
            <div className="w-12" /> {/* spacer to align title */}
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight">Preferências de Sons</h2>
            <p className="text-sm text-muted-foreground">
              Defina os avisos sonoros que tocarão automaticamente no seu painel de Pedidos sempre que receber uma nova venda.
            </p>
          </div>

          <AdminNotificationSettingsPanel />
        </main>
      </div>
    </Admin2FAGuard>
  );
}