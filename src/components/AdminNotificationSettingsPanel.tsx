import { useAdminNotificationSettings } from "@/hooks/useAdminNotificationSettings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, Music, Play, Upload, HelpCircle, Check, ShieldAlert } from "lucide-react";
import { SOUND_LABELS, SoundType } from "@/lib/soundSynthesizer";
import { toast } from "sonner";

export function AdminNotificationSettingsPanel() {
  const {
    settings,
    setEnabled,
    setSoundType,
    setVolume,
    setRepeatUntilRead,
    setCustomSound,
    playTest,
  } = useAdminNotificationSettings();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/x-wav"];
    if (!allowed.includes(file.type) && !file.name.endsWith(".mp3") && !file.name.endsWith(".wav") && !file.name.endsWith(".ogg")) {
      toast.error("Formato não suportado. Use apenas arquivos .mp3, .wav ou .ogg");
      return;
    }

    // Limit custom base64 file to 1.2MB for localStorage capacity
    if (file.size > 1.2 * 1024 * 1024) {
      toast.error("O arquivo é muito grande! Escolha um som curto de até 1.2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomSound(file.name, reader.result);
        toast.success(`Som personalizado "${file.name}" carregado e ativo!`);
      }
    };
    reader.onerror = () => {
      toast.error("Erro ao processar o arquivo de som.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 rounded-2xl bg-card p-5 border border-border/40 shadow-card animate-fade-in">
      <div className="flex items-center gap-3 border-b border-border/50 pb-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Volume2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Sons de Notificação</h2>
          <p className="text-xs text-muted-foreground">Configurações para alertas em tempo real de novos pedidos</p>
        </div>
      </div>

      {/* Toggle Enabled */}
      <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-3.5 border border-border/30">
        <div className="space-y-0.5">
          <Label htmlFor="sound-enabled" className="text-sm font-bold cursor-pointer">Sons Ativos</Label>
          <p className="text-xs text-muted-foreground">Reproduzir alerta sonoro quando um cliente finalizar um pedido</p>
        </div>
        <Switch
          id="sound-enabled"
          checked={settings.enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Sound Type Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Toque Alerta</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  value={settings.soundType}
                  onValueChange={(v) => setSoundType(v as SoundType)}
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border text-sm">
                    <Music className="mr-2 h-4 w-4 text-primary" />
                    <SelectValue placeholder="Selecione um som" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SOUND_LABELS) as SoundType[]).map((k) => (
                      <SelectItem
                        key={k}
                        value={k}
                        disabled={k === "custom" && !settings.customSoundDataUrl}
                        className="text-sm"
                      >
                        {SOUND_LABELS[k]} {k === "custom" && settings.customSoundName && `(${settings.customSoundName})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={playTest}
                className="h-11 px-4 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center gap-1.5"
                title="Testar som escolhido"
              >
                <Play className="h-4 w-4 fill-primary/30" />
                <span>Testar</span>
              </Button>
            </div>
          </div>

          {/* Volume Control */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Volume</Label>
              <span className="text-xs font-bold text-primary">{settings.volume}%</span>
            </div>
            <div className="flex items-center gap-4 py-2">
              <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                value={[settings.volume]}
                onValueChange={(v) => setVolume(v[0])}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
            </div>
          </div>

          {/* Repeat until read option */}
          <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-3.5 border border-border/30">
            <div className="space-y-0.5">
              <Label htmlFor="sound-repeat" className="text-sm font-bold cursor-pointer">Repetir som em loop</Label>
              <p className="text-xs text-muted-foreground">Tocar o som continuamente a cada 10s até que o pedido seja visualizado</p>
            </div>
            <Switch
              id="sound-repeat"
              checked={settings.repeatUntilRead}
              onCheckedChange={setRepeatUntilRead}
            />
          </div>

          {/* Custom Sound Upload */}
          <div className="rounded-xl border border-dashed border-border p-4 bg-background/50 space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-bold block text-foreground">Enviar arquivo de som próprio</span>
              <p className="text-[11px] text-muted-foreground">Selecione arquivos de áudio leves (.mp3, .wav ou .ogg) de até 1.2MB.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border px-4 py-2.5 text-xs font-semibold text-foreground transition active:scale-95">
                <Upload className="h-3.5 w-3.5 text-primary" />
                <span>Escolher som</span>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {settings.customSoundDataUrl && (
                <div className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                  <Check className="h-4 w-4" />
                  <span className="truncate max-w-[180px]" title={settings.customSoundName || ""}>
                    {settings.customSoundName || "Ativo"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Browser Autoplay alert banner */}
      <div className="rounded-xl bg-primary/5 p-3.5 border border-primary/20 flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
        <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <div>
          <span className="font-bold text-foreground block">Nota sobre navegadores:</span>
          Navegadores exigem interação prévia do usuário (clique) na página para permitir a reprodução automática de som. Certifique-se de clicar em qualquer lugar da tela do painel administrativo ao abrir.
        </div>
      </div>
    </div>
  );
}