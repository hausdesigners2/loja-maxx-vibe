export type SoundType = "bell" | "cash_register" | "doorbell" | "alert" | "modern" | "custom";

export const SOUND_LABELS: Record<SoundType, string> = {
  bell: "🔔 Sino Clássico",
  cash_register: "💰 Caixa Registradora",
  doorbell: "🚪 Campainha Ding-Dong",
  alert: "🚨 Alerta de Urgência",
  modern: "📱 Notificação Moderna",
  custom: "📤 Som Personalizado (Enviado)",
};

export function playSynthesizedSound(type: SoundType, volume: number = 0.8, customSoundDataUrl?: string | null) {
  if (type === "custom" && customSoundDataUrl) {
    try {
      const audio = new Audio(customSoundDataUrl);
      audio.volume = volume;
      audio.play().catch((err) => console.error("[SoundSynthesizer] Error playing custom sound:", err));
    } catch (e) {
      console.error("[SoundSynthesizer] Failed to play custom sound, falling back to bell:", e);
      playSynthesizedSound("bell", volume);
    }
    return;
  }

  // Web Audio API
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    console.warn("[SoundSynthesizer] Web Audio API is not supported in this browser.");
    return;
  }

  try {
    const ctx = new AudioContextClass();
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume, ctx.currentTime);
    mainGain.connect(ctx.destination);

    const t = ctx.currentTime;

    if (type === "bell") {
      // Bell sound with metallic overtones and decay
      const freqs = [880, 1100, 1320, 1760];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, t);
        
        const duration = 2.0 / (idx + 1);
        gain.gain.setValueAtTime(idx === 0 ? 0.5 : 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        
        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(t);
        osc.stop(t + duration + 0.1);
      });
    } else if (type === "cash_register") {
      // Cash Register sound
      // Noise burst for coins clinking
      const bufferSize = ctx.sampleRate * 0.12; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, t);
      filter.Q.setValueAtTime(4, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(mainGain);
      noise.start(t);

      // Bell chime slightly offset
      const bellTime = t + 0.06;
      const bellOsc = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bellOsc.type = "sine";
      bellOsc.frequency.setValueAtTime(1520, bellTime);
      bellGain.gain.setValueAtTime(0.4, bellTime);
      bellGain.gain.exponentialRampToValueAtTime(0.001, bellTime + 0.7);

      bellOsc.connect(bellGain);
      bellGain.connect(mainGain);
      bellOsc.start(bellTime);
      bellOsc.stop(bellTime + 0.8);
    } else if (type === "doorbell") {
      // Doorbell (Ding-Dong)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, t); // E5
      gain1.gain.setValueAtTime(0.5, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc1.connect(gain1);
      gain1.connect(mainGain);
      osc1.start(t);
      osc1.stop(t + 0.7);

      const dongTime = t + 0.32;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(523.25, dongTime); // C5
      gain2.gain.setValueAtTime(0.5, dongTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, dongTime + 0.8);

      osc2.connect(gain2);
      gain2.connect(mainGain);
      osc2.start(dongTime);
      osc2.stop(dongTime + 0.9);
    } else if (type === "alert") {
      // Rapid alert chirp
      const duration = 0.55;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(550, t);
      osc.frequency.linearRampToValueAtTime(850, t + 0.12);
      osc.frequency.linearRampToValueAtTime(550, t + 0.24);
      osc.frequency.linearRampToValueAtTime(850, t + 0.36);
      osc.frequency.linearRampToValueAtTime(550, t + 0.48);
      
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.linearRampToValueAtTime(0.35, t + duration - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      
      osc.connect(gain);
      gain.connect(mainGain);
      osc.start(t);
      osc.stop(t + duration + 0.15);
    } else if (type === "modern") {
      // Modern sweet chord arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((f, idx) => {
        const noteTime = t + idx * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, noteTime);
        
        gain.gain.setValueAtTime(0.25, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);
        
        osc.connect(gain);
        gain.connect(mainGain);
        osc.start(noteTime);
        osc.stop(noteTime + 0.5);
      });
    }
  } catch (error) {
    console.error("[SoundSynthesizer] Failed to play synthesized sound:", error);
  }
}