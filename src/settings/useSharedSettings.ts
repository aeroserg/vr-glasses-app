import { useCallback, useEffect, useState } from "react";
import { defaultSettings, type VRSettings } from "../types";

const SETTINGS_KEY = "phone-vr-shared-settings";

const normalizeSettings = (partial: Partial<VRSettings>): VRSettings => {
  const merged: VRSettings = { ...defaultSettings, ...partial };
  // Backward compatibility for older values saved as 0..1 for distortion coefficients.
  if (merged.k1 <= 1 && merged.k2 <= 1) {
    merged.k1 = merged.k1 * 100;
    merged.k2 = merged.k2 * 100;
  }
  return merged;
};

const loadSettings = (): VRSettings => {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaultSettings;
    }
    const parsed = JSON.parse(raw) as Partial<VRSettings>;
    return normalizeSettings(parsed);
  } catch {
    return defaultSettings;
  }
};

export const useSharedSettings = () => {
  const [settings, setSettings] = useState<VRSettings>(() => loadSettings());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<VRSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings
  };
};
