import { useEffect, useState, useCallback } from "react";

type NotificationSettings = {
  soundUrl: string;
  volume: number; // 0 to 1
  enabled: boolean;
  repeatUntilSeen: boolean;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  soundUrl: "/sounds/bell.mp3",
  volume: 0.8,
  enabled: true,
  repeatUntilSeen: false,
};

const STORAGE_KEY = "loja-maxx-notification-settings";
const NOTIFIED_ORDERS_KEY = "loja-maxx-notified-orders";

export function useNotificationSound() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [notifiedOrderIds, setNotifiedOrderIds] = useState<Set<string>>(new Set());

  // Load settings from localStorage on init
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    // Load notified orders
    try {
      const storedIds = localStorage.getItem(NOTIFIED_ORDERS_KEY);
      if (storedIds) {
        const arr = JSON.parse(storedIds) as string[];
        setNotifiedOrderIds(new Set(arr));
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist settings when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Persist notified order ids when they change
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFIED_ORDERS_KEY, JSON.stringify([...notifiedOrderIds]));
    } catch {
      // ignore
    }
  }, [notifiedOrderIds]);

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const markOrderAsNotified = useCallback((orderId: string) => {
    setNotifiedOrderIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(orderId);
      return newSet;
    });
  }, []);

  const isOrderNotified = useCallback((orderId: string) => notifiedOrderIds.has(orderId), [notifiedOrderIds]);

  const playSound = useCallback(() => {
    if (!settings.enabled) return;
    const audio = new Audio(settings.soundUrl);
    audio.volume = Math.min(Math.max(settings.volume, 0), 1);
    audio.play().catch((err) => console.warn("Failed to play notification sound:", err));
    if (settings.repeatUntilSeen) {
      // We'll rely on the caller to repeat; this function just plays once.
    }
  }, [settings.enabled, settings.soundUrl, settings.volume, settings.repeatUntilSeen]);

  return {
    settings,
    updateSettings,
    playSound,
    isOrderNotified,
    markOrderAsNotified,
  };
}