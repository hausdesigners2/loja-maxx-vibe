import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Copy, Check, Clock, AlertCircle, CheckCircle2, ShoppingBag, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // CPF States
  const [cpf, setCpf] = useState(() => localStorage.getItem("loja-maxx-cpf") || "");
  const [generating, setGenerating] = useState(false);
  const [needsCpf, setNeedsCpf] = useState(true);

  const timerRef = useRef<number | null>(null);

  // Formata o CPF com máscara (000.000.000-00)
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const formatted = raw
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
    setCpf(formatted);
  };

  // 1. Carrega o pedido inicial
  useEffect(() => {
    if (!orderId) return;

    const loadOrder = async () => {
      try {
        setErrorMessage(null);
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
          setNeedsCpf(false);
          setLoading(false);
          return;
        }

        if (ord.status === "cancelled") {
          setExpired(true);
          setNeedsCpf(false);
          setLoading(false);
          return;
        }

        // Se o CPF já estiver salvo no localStorage, podemos tentar gerar o Pix automaticamente
        const savedCpf = localStorage.getItem("loja-maxx-cpf") || "";
        if (savedCpf.replace(/\D/g, "").length === 11) {
          setNeedsCpf(false);
          generatePix(savedCpf);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("[PixPaymentPage] Erro ao carregar pedido:", err);
        setErrorMessage("Não foi possível carregar os detalhes do pedido.");
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId, navigate]);

  // Gera o Pix chamando a Edge Function
  const generatePix = async (cpfToUse: string) => {
    const cleanCpf = cpfToUse.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("Por favor, informe um CPF válido com 11 dígitos.");
      return;
    }

    setGenerating(true);
    setLoading(true);
    setErrorMessage(null);

    try {
      // Salva o CPF no localStorage para compras futuras
      localStorage.setItem("loja-maxx-cpf", cpfToUse);

      const { data, error } = await supabase.functions.invoke("mercadopago-checkout", {
        body: { order_id: orderId, cpf: cleanCpf }
      });

      if (error) {
        console.error("[PixPaymentPage] Erro na chamada da Edge Function:", error);
        throw new Error("Não foi possível conectar ao servidor de pagamentos. Verifique sua conexão.");
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || "Falha ao gerar Pix no Mercado Pago.");
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
        setNeedsCpf(false);
      }
    } catch (err: any) {
      console.error("[PixPaymentPage] Erro ao gerar Pix:", err);
      setErrorMessage(err?.message || "Não foi possível gerar o Pix. Tente novamente.");
      setNeedsCpf(true);
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

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
          <p className="text-sm text-muted-foreground">Processando...</p>
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

  if (needsCpf) {
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
            <h1 className="text-xl font-extrabold">Identificação do Pagador</h1>
            <p className="text-xs text-muted-foreground">O Mercado Pago exige um CPF válido para gerar o Pix.</p>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/20 flex items-start gap-3 text-xs text-red-500">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Erro ao gerar Pix:</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-card p-5 border border-border/40 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf-input" className="text-sm font-bold">Informe seu CPF</Label>
              <Input
                id="cpf-input"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={handleCpfChange}
                className="h-12 text-base"
              />
            </div>

            <Button
              onClick={() => generatePix(cpf)}
              disabled={generating || cpf.replace(/\D/g, "").length !== 11}
              className="w-full h-12 gradient-primary font-bold shadow-glow text-base flex items-center justify-center gap-2"
            >
              <CreditCard className="h-5 w-5" />
              {generating ? "Gerando Pix..." : "Gerar QR Code Pix"}
            </Button>
          </div>
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