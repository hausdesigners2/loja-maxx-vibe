import { useState } from "react";
import { SoundType, playSynthesizedSound } from "@/lib/soundSynthesizer";

export interface NotificationSettings {
  enabled: boolean;
  soundType: SoundType;
  volume: number; // 0 to 100
  repeatUntilRead: boolean;
  customSoundDataUrl: string | null;
  customSoundName: string | null;
}

const SETTINGS_KEY = "loja-maxx-admin-notif-settings";

const defaultSettings: NotificationSettings = {
  enabled: true,
  soundType: "bell",
  volume: 80,
  repeatUntilRead: false,
  customSoundDataUrl: null,
  customSoundName: null,
};

export function useAdminNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const saveSettings = (newSettings: NotificationSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error("[Settings] Failed to save notification settings:", e);
    }
  };

  const setEnabled = (enabled: boolean) => saveSettings({ ...settings, enabled });
  const setSoundType = (soundType: SoundType) => saveSettings({ ...settings, soundType });
  const setVolume = (volume: number) => saveSettings({ ...settings, volume });
  const setRepeatUntilRead = (repeatUntilRead: boolean) => saveSettings({ ...settings, repeatUntilRead });

  const setCustomSound = (name: string, dataUrl: string) => {
    saveSettings({
      ...settings,
      soundType: "custom",
      customSoundName: name,
      customSoundDataUrl: dataUrl,
    });
  };

  const playTest = () => {
    playSynthesizedSound(settings.soundType, settings.volume / 100, settings.customSoundDataUrl);
  };

  const triggerNotificationSound = () => {
    if (!settings.enabled) return;
    playSynthesizedSound(settings.soundType, settings.volume / 100, settings.customSoundDataUrl);
  };

  return {
    settings,
    setEnabled,
    setSoundType,
    setVolume,
    setRepeatUntilRead,
    setCustomSound,
    playTest,
    triggerNotificationSound,
  };
}