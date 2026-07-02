import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Copy, Check, Clock, AlertCircle, CheckCircle2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

interface PixData {
  qr_code: string;
  qr_code_base64: string;
  payment_id: string;
  amount: number;
}

export default function PixPaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [pix, setPix] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutos em segundos
  const [expired, setExpired] = useState(false);
  const [paid, setPaid] = useState(false);
  const timerRef = useRef<number | null>(null);

  // 1. Carrega o pedido e gera o Pix
  useEffect(() => {
    if (!orderId) return;

    const loadOrderAndGeneratePix = async () => {
      try {
        // Busca o pedido
        const { data: ord, error: ordErr } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (ordErr || !ord) {
          toast.error("Pedido não encontrado.");
          navigate("/");
          return;
        }

        setOrder(ord);

        if (ord.status === "paid") {
          setPaid(true);
          setLoading(false);
          return;
        }

        if (ord.status === "cancelled") {
          setExpired(true);
          setLoading(false);
          return;
        }

        // Chama a Edge Function para gerar o Pix no Mercado Pago
        const { data, error } = await supabase.functions.invoke("mercadopago-checkout", {
          body: { order_id: orderId }
        });

        if (error || !data || !data.success) {
          throw error || new Error(data?.error || "Falha ao gerar Pix");
        }

        if (data.already_paid) {
          setPaid(true);
        } else {
          setPix({
            qr_code: data.qr_code,
            qr_code_base64: data.qr_code_base64,
            payment_id: data.payment_id,
            amount: data.amount
          });
        }
        setLoading(false);
      } catch (err) {
        console.error("[PixPaymentPage] Erro ao carregar/gerar Pix:", err);
        toast.error("Não foi possível gerar o Pix. Tente novamente.");
        setLoading(false);
      }
    };

    loadOrderAndGeneratePix();
  }, [orderId, navigate]);

  // 2. Escuta atualizações em tempo real do status do pedido no Supabase
  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`pix-order-status-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          const updatedOrder = payload.new;
          if (updatedOrder.status === "paid") {
            setPaid(true);
            toast.success("Pagamento aprovado com sucesso!");
          } else if (updatedOrder.status === "cancelled") {
            setExpired(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // 3. Contador regressivo de 10 minutos
  useEffect(() => {
    if (loading || paid || expired || !pix) return;

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setExpired(true);
          // Cancela o pedido no Supabase por expiração
          supabase
            .from("orders")
            .update({ status: "cancelled", payment_status: "expired" } as any)
            .eq("id", orderId)
            .then();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [loading, paid, expired, pix, orderId]);

  const copyToClipboard = () => {
    if (!pix) return;
    navigator.clipboard.writeText(pix.qr_code);
    setCopied(true);
    toast.success("Código Pix Copia e Cola copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Gerando seu QR Code Pix seguro...</p>
        </div>
      </AppShell>
    );
  }

  if (paid) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-green-500/10 text-green-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Pagamento Confirmado!</h2>
            <p className="text-sm text-muted-foreground mt-1">Seu pedido foi aprovado e já está sendo preparado.</p>
          </div>
          <Button asChild className="gradient-primary shadow-glow mt-2">
            <Link to="/conta">Ir para Meus Pedidos</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (expired) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-16 text-center animate-fade-in">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-red-500/10 text-red-500">
            <AlertCircle className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">Código Pix Expirado</h2>
            <p className="text-sm text-muted-foreground mt-1">O tempo limite para pagamento deste Pix foi atingido.</p>
          </div>
          <Button asChild className="gradient-primary shadow-glow mt-2">
            <Link to="/">Voltar para a loja</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5 animate-fade-in pb-8">
        <Link to="/conta" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Meus Pedidos
        </Link>

        <div className="text-center space-y-2">
          <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary shadow-glow mx-auto">
            <ShoppingBag className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-extrabold">Pagamento via Pix</h1>
          <p className="text-xs text-muted-foreground">Pedido #{order?.order_number || order?.id.slice(0, 8)}</p>
        </div>

        {/* QR Code Card */}
        <div className="rounded-2xl bg-card p-6 border border-border/40 flex flex-col items-center text-center space-y-4">
          <div className="bg-white p-3 rounded-xl aspect-square w-48 h-48 flex items-center justify-center shadow-md">
            {pix?.qr_code_base64 ? (
              <img
                src={`data:image/jpeg;base64,${pix.qr_code_base64}`}
                alt="QR Code Pix"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="h-full w-full bg-secondary animate-pulse rounded-lg" />
            )}
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Valor a pagar</div>
            <div className="text-2xl font-extrabold text-primary">{formatBRL(Number(order?.total || 0))}</div>
          </div>

          {/* Countdown Timer */}
          <div className="flex items-center gap-2 rounded-full bg-secondary/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
            <Clock className="h-4 w-4 text-primary animate-pulse" />
            <span>Pague em até: <strong className="text-foreground">{formatTime(timeLeft)}</strong></span>
          </div>
        </div>

        {/* Copia e Cola Card */}
        <div className="rounded-2xl bg-card p-4 border border-border/40 space-y-3">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pix Copia e Cola</div>
          <p className="text-xs text-muted-foreground">Copie o código abaixo para pagar no aplicativo do seu banco.</p>
          
          <div className="relative flex items-center rounded-xl bg-secondary/40 p-3 border border-border/50">
            <span className="text-xs font-mono truncate pr-10 select-all flex-1 text-left">
              {pix?.qr_code}
            </span>
            <button
              onClick={copyToClipboard}
              className="absolute right-2 grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-glow transition active:scale-95"
              title="Copiar código Pix"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <Button
            onClick={copyToClipboard}
            className="w-full h-11 gradient-primary font-bold shadow-glow text-sm"
          >
            {copied ? "Código Copiado!" : "Copiar Código Pix"}
          </Button>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl bg-secondary/30 p-4 text-xs space-y-2 text-muted-foreground">
          <div className="font-bold text-foreground">Como pagar:</div>
          <ol className="list-decimal list-inside space-y-1">
            <li>Abra o aplicativo do seu banco.</li>
            <li>Escolha a opção de pagar via Pix (QR Code ou Copia e Cola).</li>
            <li>Escaneie o QR Code ou cole o código copiado.</li>
            <li>Confirme as informações e finalize o pagamento.</li>
          </ol>
          <p className="pt-1 text-[10px] italic">A confirmação é automática e leva apenas alguns segundos.</p>
        </div>
      </div>
    </AppShell>
  );
}