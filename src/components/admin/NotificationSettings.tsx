import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { toast } from "sonner";

const DEFAULT_SOUNDS = [
  { label: "Sino", value: "/sounds/bell.mp3" },
  { label: "Caixa registradora", value: "/sounds/cash-register.mp3" },
  { label: "Campainha", value: "/sounds/doorbell.mp3" },
  { label: "Alerta", value: "/sounds/alert.mp3" },
  { label: "Notificação moderna", value: "/sounds/modern-notification.mp3" },
];

export function NotificationSettings() {
  const { settings, updateSettings, playSound } = useNotificationSound();
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/audio\/(mp3|wav|ogg)/)) {
      toast.error("Por favor, envie um arquivo de áudio (mp3, wav ou ogg).");
      return;
    }
    setCustomFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!customFile) return;
    setIsUploading(true);
    try {
      // In a real app you would upload to storage; for demo we just use object URL.
      const url = URL.createObjectURL(customFile);
      updateSettings({ soundUrl: url });
      toast.success("Som personalizado carregado!");
    } catch (err) {
      toast.error("Falha ao carregar som personalizado.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTestSound = () => {
    playSound();
    toast.info("Testando som...");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-4">
        <h2 className="text-xl font-bold mb-2">Configurações de Notificação Sonora</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o som que será tocado ao receber um novo pedido.
        </p>

        <div className="mt-4 space-y-3">
          <Label>Som padrão</Label>
          <Select value={settings.soundUrl} onValueChange={(v) => updateSettings({ soundUrl: v as string })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um som" />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_SOUNDS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 space-y-3">
          <Label>Som personalizado (opcional)</Label>
          <div className="space-y-2">
            <input
              type="file"
              accept="audio/mp3, audio/wav, audio/ogg"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => document.querySelector('input[type="file"]')?.click()}
              className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              <span>Selecionar arquivo</span>
              {customFile && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({customFile.name})
                </span>
              )}
            </button>
          </div>
          {previewUrl && (
            <div className="mt-2">
              <audio controls src={previewUrl} className="w-full" />
              <button onClick={handleUpload} disabled={isUploading} className="mt-2 w-full h-10 rounded-lg border border-border bg-background px-3">
                {isUploading ? "Carregando..." : "Usar este som"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <Label className="flex items-center justify-between">
            <span>Volume</span>
            <span className="text-xs text-muted-foreground">{Math.round(settings.volume * 100)}%</span>
          </Label>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.volume * 100)}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
            className="w-full"
          />
        </div>

        <div className="mt-4 space-y-3">
          <Label className="flex items-center justify-between">
            <span>Ativar notificações sonoras</span>
            <Switch checked={settings.enabled} onCheckedChange={(v) => updateSettings({ enabled: v })} />
          </Label>
        </div>

        <div className="mt-4 space-y-3">
          <Label className="flex items-center justify-between">
            <span>Repetir som até visualizar o pedido</span>
            <Switch checked={settings.repeatUntilSeen} onCheckedChange={(v) => updateSettings({ repeatUntilSeen: v })} />
          </Label>
        </div>

        <div className="mt-6">
          <Button onClick={handleTestSound} variant="outline" className="w-full">
            Testar Som
          </Button>
        </div>
      </div>
    </div>
  );
}