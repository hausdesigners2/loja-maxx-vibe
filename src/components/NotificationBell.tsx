import { useEffect, useState, useRef } from "react";
import { Bell, CheckCheck, Clock, Tag, MessageSquare, AlertCircle, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { playSynthesizedSound } from "@/lib/soundSynthesizer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  promotion: <Tag className="h-4 w-4 text-orange-500" />,
  coupon: <Tag className="h-4 w-4 text-green-500" />,
  warning: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  order: <ShoppingBag className="h-4 w-4 text-blue-500" />,
};

const TYPE_LABELS: Record<string, string> = {
  promotion: "Promoção",
  coupon: "Cupom",
  warning: "Aviso",
  order: "Pedido",
};

export function NotificationBell() {
  const { user } = useAuth();
  const [list, setList] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [limit, setLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Carrega as configurações de som e notificações do perfil
  useEffect(() => {
    if (!user) return;
    supabase
      .from("customer_profiles")
      .select("notification_sound")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.notification_sound !== undefined) {
          // Se o banco tiver as colunas novas, aplicamos, caso contrário, default true
          setSoundEnabled((data as any).notification_sound ?? true);
        }
      });
  }, [user]);

  const loadNotifications = async (currentLimit: number, append = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(append ? list.length : 0, (append ? list.length : 0) + currentLimit - 1);

      if (error) throw error;

      if (data) {
        setList((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === currentLimit);
      }

      // Conta não lidas de forma rápida
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setUnreadCount(count ?? 0);
    } catch (e) {
      console.error("[Notifications] Erro ao carregar:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setList([]);
      setUnreadCount(0);
      return;
    }

    loadNotifications(limit);

    // Inscrição em tempo real com Supabase Realtime
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setList((prev) => [newNotif, ...prev]);
          setUnreadCount((c) => c + 1);

          // Toca o som caso esteja ativo
          if (soundEnabled) {
            playSynthesizedSound("modern");
          }

          // Exibe o toast visual discreto
          toast.info(newNotif.title, {
            description: newNotif.message,
            duration: 5000,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Recarrega contagem de não lidas e atualizações
          loadNotifications(limit);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, soundEnabled]);

  const markAllAsRead = async () => {
    if (!user || list.length === 0) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;

      setList((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("Todas as notificações marcadas como lidas!");
    } catch (e) {
      toast.error("Falha ao atualizar notificações.");
    }
  };

  const markAsRead = async (id: string) => {
    const notif = list.find((n) => n.id === id);
    if (!notif || notif.is_read) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);

      if (error) throw error;

      setList((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error("[Notifications] Erro ao ler:", e);
    }
  };

  if (!user) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Notificações"
          className="relative grid h-10 w-10 place-items-center rounded-full bg-secondary transition hover:bg-secondary/80 active:scale-95"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground animate-pulse shadow-glow">
              {unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent className="w-full max-w-md bg-card border-l border-border max-h-screen flex flex-col p-0">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" /> Notificações
            </SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs text-primary hover:text-primary/80 hover:bg-primary/5 flex items-center gap-1.5"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Marcar lidas
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3 text-muted-foreground animate-fade-in">
              <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">Nenhuma notificação.</p>
            </div>
          ) : (
            list.map((n) => (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                className={`group relative flex gap-3 rounded-2xl p-3.5 border transition cursor-pointer ${
                  n.is_read
                    ? "border-border/40 bg-card/50 hover:bg-secondary/10"
                    : "border-primary/30 bg-primary/5 shadow-glow ring-1 ring-primary/10"
                }`}
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary/50">
                  {TYPE_ICONS[n.type] || <MessageSquare className="h-4 w-4" />}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {TYPE_LABELS[n.type] || n.type}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(n.created_at).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(n.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-foreground leading-snug">{n.title}</h4>
                  <p className="text-xs text-muted-foreground leading-normal">{n.message}</p>
                </div>

                {!n.is_read && (
                  <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            ))
          )}

          {hasMore && (
            <div className="pt-2 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextLimit = limit + 20;
                  setLimit(nextLimit);
                  loadNotifications(20, true);
                }}
                disabled={loading}
                className="text-xs font-semibold"
              >
                {loading ? "Carregando..." : "Carregar mais"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}