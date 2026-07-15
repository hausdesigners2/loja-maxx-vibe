import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft, Send, Users, User, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Admin2FAGuard } from "@/components/Admin2FAGuard";

type Profile = Tables<"customer_profiles">;

type TargetType = "all" | "promotions_only" | "specific";
type NotifType = "promotion" | "coupon" | "warning" | "order";

export default function AdminNotificationsPage() {
  const { user, isAdmin, loading } = useAuth();
  
  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState<NotifType>("promotion");
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  
  // Data State
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (loading || !user || !isAdmin) return;
    
    // Carrega a lista de clientes para envio específico
    supabase
      .from("customer_profiles")
      .select("*")
      .order("full_name")
      .then(({ data }) => {
        setCustomers(data ?? []);
      });
  }, [loading, user, isAdmin]);

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/admin" replace />;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast.error("Por favor, preencha o título e a mensagem.");
      return;
    }

    if (targetType === "specific" && !selectedUserId) {
      toast.error("Por favor, selecione o cliente específico.");
      return;
    }

    setSending(true);
    try {
      let targetUserIds: string[] = [];

      if (targetType === "all") {
        // Envia para todos os clientes ativos com perfis
        const { data, error } = await supabase
          .from("customer_profiles")
          .select("user_id");
          
        if (error) throw error;
        targetUserIds = (data ?? []).map((c) => c.user_id).filter(Boolean);
      } else if (targetType === "promotions_only") {
        // Envia apenas para os clientes optantes por receber promoções (receive_promotions = true)
        const { data, error } = await supabase
          .from("customer_profiles")
          .select("user_id")
          .eq("receive_promotions", true);
          
        if (error) throw error;
        targetUserIds = (data ?? []).map((c) => c.user_id).filter(Boolean);
      } else {
        // Envia apenas para o cliente específico selecionado
        targetUserIds = [selectedUserId];
      }

      if (targetUserIds.length === 0) {
        toast.warning("Nenhum cliente correspondente aos critérios de envio foi encontrado.");
        setSending(false);
        return;
      }

      // Prepara o payload de inserção em massa no Supabase
      const payload = targetUserIds.map((uid) => ({
        user_id: uid,
        title: title.trim(),
        message: message.trim(),
        type: notifType,
        is_read: false,
      }));

      const { error } = await supabase
        .from("notifications")
        .insert(payload);

      if (error) throw error;

      toast.success(`Notificação enviada com sucesso para ${targetUserIds.length} cliente(s)!`);
      
      // Limpa os campos após envio de sucesso
      setTitle("");
      setMessage("");
    } catch (err: any) {
      console.error("[Notifications Admin] Erro de envio:", err);
      toast.error(err?.message || "Falha ao enviar notificações.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Admin2FAGuard>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background">
          <div className="mx-auto max-w-3xl px-4 pt-4 pb-2">
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Painel
            </Link>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Painel Administrativo</h1>
            <div className="mt-3 flex gap-6 border-b border-border select-none">
              <Link to="/admin/dashboard" className="pb-2 text-sm font-medium text-muted-foreground">
                Pedidos
              </Link>
              <Link to="/admin" className="pb-2 text-sm font-medium text-muted-foreground">
                Produtos
              </Link>
              <Link to="/admin/banners" className="pb-2 text-sm font-medium text-muted-foreground">
                Banners
              </Link>
              <span className="-mb-px border-b-2 border-primary pb-2 text-sm font-bold text-foreground">
                Notificações
              </span>
              <Link to="/admin/sounds" className="pb-2 text-sm font-medium text-muted-foreground">
                Sons
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Enviar Nova Notificação</h2>
              <p className="text-xs text-muted-foreground">
                Dispare alertas push e em tempo real para os clientes cadastrados na plataforma.
              </p>
            </div>

            <form onSubmit={handleSend} className="space-y-4 rounded-2xl bg-card p-5 border border-border/40 shadow-card">
              {/* Target Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Destinatários</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border text-sm">
                    <SelectValue placeholder="Selecione o público-alvo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm">Todos os clientes</SelectItem>
                    <SelectItem value="promotions_only" className="text-sm">Apenas clientes que aceitam promoções</SelectItem>
                    <SelectItem value="specific" className="text-sm">Cliente específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Specific Customer Selector */}
              {targetType === "specific" && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Selecione o Cliente</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="h-11 rounded-xl bg-background border-border text-sm">
                      <SelectValue placeholder="Selecione um cliente cadastrado..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.user_id} className="text-sm">
                          {c.full_name} ({c.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Notification Type Selector */}
                <div className="col-span-2 sm:col-span-1 space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tipo de Alerta</Label>
                  <Select value={notifType} onValueChange={(v) => setNotifType(v as NotifType)}>
                    <SelectTrigger className="h-11 rounded-xl bg-background border-border text-sm">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="promotion" className="text-sm font-semibold text-orange-500">🏷️ Promoção</SelectItem>
                      <SelectItem value="coupon" className="text-sm font-semibold text-green-500">🎫 Cupom</SelectItem>
                      <SelectItem value="warning" className="text-sm font-semibold text-yellow-500">🚨 Aviso</SelectItem>
                      <SelectItem value="order" className="text-sm font-semibold text-blue-500">📦 Pedido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Form Input Fields */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-bold">Título da Notificação *</Label>
                <Input
                  id="title"
                  type="text"
                  maxLength={100}
                  placeholder="Ex: Cupom de Frete Grátis Ativo! 🎫"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-11 text-sm bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-bold">Mensagem *</Label>
                <Textarea
                  id="message"
                  rows={4}
                  maxLength={500}
                  placeholder="Ex: Use o cupom MAXXFRETE e garanta entrega grátis em toda a sua lista de mercado hoje mesmo!"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="text-sm bg-background border-border p-3"
                />
              </div>

              <Button
                type="submit"
                disabled={sending}
                className="w-full h-12 gradient-primary text-base font-bold shadow-glow flex items-center justify-center gap-2"
              >
                <Send className="h-5 w-5" />
                {sending ? "Disparando..." : "Enviar Notificação"}
              </Button>
            </form>
          </div>
        </main>
      </div>
    </Admin2FAGuard>
  );
}