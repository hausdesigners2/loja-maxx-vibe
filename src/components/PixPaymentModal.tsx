import { useEffect, useState } from "react";
import { Check, Copy, Clock, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  total: number;
  checkoutUrl?: string;
  onRegenerate: () => void;
  paymentStatus: string;
}

export function PixPaymentModal({
  isOpen,
  onClose,
  pixCode,
  qrCodeUrl,
  expiresAt,
  total,
  checkoutUrl,
  onRegenerate,
  paymentStatus
}: PixPaymentModalProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !expiresAt) return;

    const calculateTimeLeft = () => {
      const difference = +new Date(expiresAt) - +new Date();
      return difference > 0 ? Math.floor(difference / 1000) : 0;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const left = calculateTimeLeft();
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, expiresAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast.success("Código Pix copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isExpired = timeLeft <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-glow">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-extrabold tracking-tight">Pagamento via Pix</h2>
          <p className="text-xs text-muted-foreground">Pagamento instantâneo • Aprovação automática</p>
        </div>

        {/* Valor */}
        <div className="my-5 rounded-2xl bg-secondary/50 p-4 text-center">
          <span className="text-xs text-muted-foreground block">Valor a pagar</span>
          <span className="text-3xl font-black text-primary">{formatBRL(total)}</span>
        </div>

        {/* QR Code & Status */}
        <div className="flex flex-col items-center justify-center space-y-4">
          {isExpired ? (
            <div className="flex flex-col items-center justify-center aspect-square w-60 rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-center space-y-3">
              <Clock className="h-12 w-12 text-destructive animate-pulse" />
              <p className="text-sm font-bold text-foreground">Código Pix Expirado</p>
              <p className="text-xs text-muted-foreground">O tempo limite de 30 minutos para pagamento foi atingido.</p>
              <Button onClick={onRegenerate} className="gradient-primary shadow-glow text-xs h-9">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Gerar novo Pix
              </Button>
            </div>
          ) : (
            <>
              <div className="relative aspect-square w-60 overflow-hidden rounded-2xl border border-border bg-white p-3 shadow-card">
                <img src={qrCodeUrl} alt="QR Code Pix" className="h-full w-full object-contain" />
                {paymentStatus === "Pago" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm text-center p-4 animate-scale-in">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/20 text-primary mb-2">
                      <Check className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-foreground">Pagamento Aprovado!</p>
                    <p className="text-xs text-muted-foreground">Seu pedido foi confirmado automaticamente.</p>
                  </div>
                )}
              </div>

              {/* Timer Progress Bar */}
              <div className="w-full space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Tempo restante:
                  </span>
                  <span className="text-primary font-bold">{formatTime(timeLeft)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${(timeLeft / 1800) * 100}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Copia e Cola */}
        {!isExpired && paymentStatus !== "Pago" && (
          <div className="mt-5 space-y-2">
            <span className="text-xs text-muted-foreground font-medium block">Pix Copia e Cola</span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={pixCode}
                className="h-10 flex-1 rounded-xl border border-border bg-secondary/30 px-3 text-xs text-muted-foreground focus:outline-none"
              />
              <Button onClick={handleCopy} className="h-10 px-3 gradient-primary shadow-glow">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Checkout Externo */}
        {checkoutUrl && !isExpired && paymentStatus !== "Pago" && (
          <div className="mt-4">
            <a 
              href={checkoutUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-primary font-bold hover:underline"
            >
              Pagar no Checkout InfinitePay <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 rounded-xl">
            {paymentStatus === "Pago" ? "Fechar" : "Pagar depois"}
          </Button>
        </div>
      </div>
    </div>
  );
}