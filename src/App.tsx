import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GLRenderer } from "./gl/renderer";
import { defaultSettings, VRSettings } from "./types";
import { MdIosShare, MdShare } from "react-icons/md";

const SETTINGS_KEY = "phone-vr-camera-settings";
const PRESETS_KEY = "phone-vr-camera-presets";
const ACTIVE_PRESET_KEY = "phone-vr-camera-active-preset";

type UiMode = "settings" | "vr";

type SliderProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
};

type PresetSlot = {
  id: string;
  name: string;
  color: string;
  settings: VRSettings;
};

type PresetInputProps = {
  preset: PresetSlot;
  isActive: boolean;
  isEditing: boolean;
  onSelect: (presetId: string) => void;
  onRename: (presetId: string, name: string) => void;
  onRenameStart: (presetId: string) => void;
  onRenameEnd: () => void;
};

const PresetInput = ({
  preset,
  isActive,
  isEditing,
  onSelect,
  onRename,
  onRenameStart,
  onRenameEnd
}: PresetInputProps) => {
  const timerRef = useRef<number | null>(null);
  const longPressRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    if (isEditing) {
      return;
    }
    longPressRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressRef.current = true;
      onRenameStart(preset.id);
    }, 1500);
  };

  const handlePointerUp = () => {
    clearTimer();
    if (!longPressRef.current && !isEditing) {
      onSelect(preset.id);
    }
  };

  const handlePointerLeave = () => {
    clearTimer();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.currentTarget.blur();
      onRenameEnd();
    }
  };

  const handleBlur = () => {
    onRenameEnd();
  };

  return (
    <input
      ref={inputRef}
      className={`preset-input ${isActive ? "active" : ""} ${
        isEditing ? "editing" : ""
      }`}
      value={preset.name}
      readOnly={!isEditing}
      maxLength={30}
      onChange={(event) => onRename(preset.id, event.target.value)}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );
};

const Slider = ({
  label,
  min,
  max,
  step,
  value,
  onChange,
  formatValue
}: SliderProps) => {
  return (
    <label className="control">
      <div className="control-header">
        <strong>{label}</strong>
        <span>{formatValue ? formatValue(value) : value.toFixed(3)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
};

const withAlpha = (hexColor: string, alpha: number) => {
  if (!/^#([0-9a-fA-F]{6})$/.test(hexColor)) {
    return hexColor;
  }
  const hex = hexColor.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function useIsApplePlatform(): boolean {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;

    const ua = navigator.userAgent ?? "";
    const platform = (navigator.platform ?? "") as string;
    const maxTouchPoints = (navigator as any).maxTouchPoints ?? 0;
    const chPlatform = (navigator as any).userAgentData?.platform as string | undefined;

    if (chPlatform) return chPlatform === "macOS" || chPlatform === "iOS" || chPlatform === "iPadOS";

    if (/Windows NT/i.test(ua) || /^Win/i.test(platform)) return false;
    if (/Android/i.test(ua)) return false;

    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    if (platform === "MacIntel" && maxTouchPoints > 1) return true;
    if (/^Mac/i.test(platform)) return true;
    if (/Macintosh/i.test(ua) && !/Mobile/i.test(ua)) return true;

    return false;
  }, []);
}

const normalizeSettings = (partial: Partial<VRSettings>): VRSettings => {
  const merged: VRSettings = { ...defaultSettings, ...partial };
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
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return defaultSettings;
    }
    const parsed = JSON.parse(stored) as Partial<VRSettings>;
    return normalizeSettings(parsed);
  } catch {
    return defaultSettings;
  }
};

const defaultPresets: PresetSlot[] = [
  {
    id: "preset-1",
    name: "Обычный",
    color: "#2dd4bf",
    settings: normalizeSettings(defaultSettings)
  },
  {
    id: "preset-2",
    name: "Чтение",
    color: "#fbbf24",
    settings: normalizeSettings({
      ...defaultSettings,
      filterMode: "amber",
      contrast: 1.1,
      temperature: 0.25,
      highlights: -0.1,
      shadows: 0.15
    })
  },
  {
    id: "preset-3",
    name: "ТВ",
    color: "#38bdf8",
    settings: normalizeSettings({
      ...defaultSettings,
      filterMode: "deepblue",
      contrast: 1.15,
      gamma: 1.05,
      temperature: -0.1
    })
  }
];

const loadPresets = (): PresetSlot[] => {
  if (typeof window === "undefined") {
    return defaultPresets;
  }
  try {
    const stored = window.localStorage.getItem(PRESETS_KEY);
    if (!stored) {
      return defaultPresets;
    }
    const parsed = JSON.parse(stored) as Array<Partial<PresetSlot>>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultPresets;
    }
    return defaultPresets.map((fallback, index) => {
      const incoming = parsed[index];
      if (!incoming) {
        return fallback;
      }
      return {
        ...fallback,
        ...incoming,
        name: typeof incoming.name === "string" ? incoming.name.slice(0, 30) : fallback.name,
        settings: normalizeSettings(incoming.settings ?? fallback.settings)
      };
    });
  } catch {
    return defaultPresets;
  }
};

const loadActivePresetId = (presets: PresetSlot[]): string => {
  if (typeof window === "undefined") {
    return presets[0]?.id ?? "preset-1";
  }
  const stored = window.localStorage.getItem(ACTIVE_PRESET_KEY);
  const exists = presets.some((preset) => preset.id === stored);
  return exists ? (stored as string) : presets[0]?.id ?? "preset-1";
};

const errorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "Доступ к камере запрещен. Разрешите камеру в настройках браузера.";
      case "NotFoundError":
        return "На устройстве не найдена камера.";
      case "NotReadableError":
        return "Камера уже используется другим приложением.";
      default:
        return `Ошибка камеры: ${error.message}`;
    }
  }
  return "Неожиданная ошибка камеры. Попробуйте снова.";
};

export default function App() {
  const initialPresetsRef = useRef<PresetSlot[]>(loadPresets());
  const [settings, setSettings] = useState<VRSettings>(() => loadSettings());
  const [presetSlots, setPresetSlots] = useState<PresetSlot[]>(
    () => initialPresetsRef.current
  );
  const [activePresetId, setActivePresetId] = useState<string>(() =>
    loadActivePresetId(initialPresetsRef.current)
  );
  const [uiMode, setUiMode] = useState<UiMode>("settings");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [startupMenuVisible, setStartupMenuVisible] = useState(true);
  const [vrMenuVisible, setVrMenuVisible] = useState(false);
  const [savePresetMode, setSavePresetMode] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const mq = window.matchMedia?.("(orientation: landscape)");
    if (mq && typeof mq.matches === "boolean") {
      return mq.matches;
    }
    return window.innerWidth >= window.innerHeight;
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rendererRef = useRef<GLRenderer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const settingsRef = useRef(settings);
  const effectiveScaleRef = useRef(settings.scale);
  const opticalZoomRef = useRef(1);
  const autoStartRef = useRef(false);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsTimeoutRef = useRef<number | null>(null);
  const menuTimeoutRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0.5, y: 0.5 });

  const supportsCamera = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }, []);

  

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presetSlots));
  }, [presetSlots]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_PRESET_KEY, activePresetId);
  }, [activePresetId]);

  useEffect(() => {
    if (!presetSlots.some((preset) => preset.id === activePresetId)) {
      setActivePresetId(presetSlots[0]?.id ?? "preset-1");
    }
  }, [activePresetId, presetSlots]);

  useEffect(() => {
    return () => {
      handleStop();
      if (settingsTimeoutRef.current) {
        window.clearTimeout(settingsTimeoutRef.current);
      }
      if (menuTimeoutRef.current) {
        window.clearTimeout(menuTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mq = window.matchMedia?.("(orientation: landscape)");
    const update = () => {
      if (mq && typeof mq.matches === "boolean") {
        setIsLandscape(mq.matches);
      } else {
        setIsLandscape(window.innerWidth >= window.innerHeight);
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    if (mq) {
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", update);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(update);
      }
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      if (mq) {
        if (typeof mq.removeEventListener === "function") {
          mq.removeEventListener("change", update);
        } else if (typeof mq.removeListener === "function") {
          mq.removeListener(update);
        }
      }
    };
  }, []);

  const updateSettings = (patch: Partial<VRSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const resetSettingsTimer = useCallback(() => {
    if (settingsTimeoutRef.current) {
      window.clearTimeout(settingsTimeoutRef.current);
    }
    settingsTimeoutRef.current = window.setTimeout(() => {
      setSettingsVisible(false);
    }, 10000);
  }, []);

  const openSettings = useCallback(() => {
    if (startupMenuVisible) {
      return;
    }
    setSettingsVisible(true);
    resetSettingsTimer();
  }, [resetSettingsTimer, startupMenuVisible]);

  const closeSettings = useCallback(() => {
    setSettingsVisible(false);
    if (settingsTimeoutRef.current) {
      window.clearTimeout(settingsTimeoutRef.current);
      settingsTimeoutRef.current = null;
    }
  }, []);

  const resetMenuTimer = useCallback(() => {
    if (menuTimeoutRef.current) {
      window.clearTimeout(menuTimeoutRef.current);
    }
    menuTimeoutRef.current = window.setTimeout(() => {
      setVrMenuVisible(false);
    }, 10000);
  }, []);

  const showVrMenu = useCallback(() => {
    setVrMenuVisible(true);
    resetMenuTimer();
  }, [resetMenuTimer]);

  const hideVrMenu = useCallback(() => {
    setVrMenuVisible(false);
    if (menuTimeoutRef.current) {
      window.clearTimeout(menuTimeoutRef.current);
      menuTimeoutRef.current = null;
    }
  }, []);

  const updateCursor = useCallback((dx: number, dy: number) => {
    if (typeof window === "undefined") {
      return;
    }
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const speed = 0.35;
    setCursorPos((pos) => ({
      x: Math.min(1, Math.max(0, pos.x - (dx / width) * speed)),
      y: Math.min(1, Math.max(0, pos.y - (dy / height) * speed))
    }));
  }, []);

  const applyNativeZoom = useCallback(async (desiredScale: number) => {
    const safeDesired = Math.max(1, desiredScale);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== "function") {
      opticalZoomRef.current = 1;
      effectiveScaleRef.current = safeDesired;
      return;
    }
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      zoom?: MediaTrackConstraintRange;
    };
    const zoomCaps = capabilities.zoom;
    if (!zoomCaps) {
      opticalZoomRef.current = 1;
      effectiveScaleRef.current = safeDesired;
      return;
    }
    const min = typeof zoomCaps.min === "number" ? zoomCaps.min : 1;
    const max =
      typeof zoomCaps.max === "number" ? zoomCaps.max : safeDesired;
    const step = typeof zoomCaps.step === "number" ? zoomCaps.step : 0.1;
    const clamped = Math.min(max, Math.max(min, safeDesired));
    const snapped = step > 0 ? Math.round(clamped / step) * step : clamped;
    try {
      await track.applyConstraints({ advanced: [{ zoom: snapped }] });
      const applied = (track.getSettings() as { zoom?: number }).zoom;
      opticalZoomRef.current = typeof applied === "number" ? applied : snapped;
    } catch {
      opticalZoomRef.current = 1;
    }
    const optical = opticalZoomRef.current || 1;
    effectiveScaleRef.current = safeDesired / optical;
  }, []);

  const handleGestureReveal = useCallback(() => {
    if (startupMenuVisible || settingsVisible || !isRunning) {
      return;
    }
    closeSettings();
    showVrMenu();
  }, [closeSettings, isRunning, settingsVisible, showVrMenu, startupMenuVisible]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (settingsVisible || startupMenuVisible || !isRunning) {
        return;
      }
      updateCursor(event.deltaX, event.deltaY);
      if (vrMenuVisible) {
        resetMenuTimer();
        return;
      }
      if (Math.abs(event.deltaY) > 18 || Math.abs(event.deltaX) > 18) {
        handleGestureReveal();
      }
    },
    [
      handleGestureReveal,
      isRunning,
      resetMenuTimer,
      settingsVisible,
      startupMenuVisible,
      updateCursor,
      vrMenuVisible
    ]
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length === 1) {
        touchStartYRef.current = event.touches[0].clientY;
        touchStartXRef.current = event.touches[0].clientX;
      }
    },
    []
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (settingsVisible || startupMenuVisible) {
        return;
      }
      if (
        touchStartYRef.current === null ||
        touchStartXRef.current === null ||
        event.touches.length !== 1
      ) {
        return;
      }
      const current = event.touches[0];
      const dx = current.clientX - touchStartXRef.current;
      const dy = current.clientY - touchStartYRef.current;

      if (vrMenuVisible) {
        updateCursor(dx, dy);
        resetMenuTimer();
        touchStartXRef.current = current.clientX;
        touchStartYRef.current = current.clientY;
        return;
      }

      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
        handleGestureReveal();
        updateCursor(dx, dy);
        touchStartXRef.current = current.clientX;
        touchStartYRef.current = current.clientY;
      }
    },
    [
      handleGestureReveal,
      resetMenuTimer,
      settingsVisible,
      startupMenuVisible,
      updateCursor,
      vrMenuVisible
    ]
  );

  const handleTouchEnd = useCallback(() => {
    touchStartYRef.current = null;
    touchStartXRef.current = null;
  }, []);

  const handleStagePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!settingsVisible) {
        return;
      }
      const target = event.target as Node;
      if (settingsPanelRef.current?.contains(target)) {
        return;
      }
      if (settingsButtonRef.current?.contains(target)) {
        return;
      }
      closeSettings();
    },
    [closeSettings, settingsVisible]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    if (!supportsCamera) {
      setError("Доступ к камере не поддерживается в этом браузере.");
      return;
    }

    if (isRunning) {
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Не найден video элемент.");
      }

      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;

      await video.play();
      await applyNativeZoom(settingsRef.current.scale);

      if (!canvasRef.current) {
        throw new Error("Не найден canvas элемент.");
      }

      if (!rendererRef.current) {
        rendererRef.current = new GLRenderer(
          canvasRef.current,
          video,
          () => ({
            ...settingsRef.current,
            scale: effectiveScaleRef.current
          })
        );
      }

      rendererRef.current.start();
      setIsRunning(true);
    } catch (err) {
      setError(errorMessage(err));
      setIsRunning(false);
    }
  }, [applyNativeZoom, isRunning, supportsCamera]);

  const handleStop = useCallback(() => {
    rendererRef.current?.stop();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    opticalZoomRef.current = 1;
    effectiveScaleRef.current = settingsRef.current.scale;
    setIsRunning(false);
  }, []);

  const applyPreset = useCallback(
    (presetId: string, options?: { keepSettings?: boolean }) => {
      const preset = presetSlots.find((item) => item.id === presetId);
      if (!preset) {
        return;
      }
      setSettings(preset.settings);
      setActivePresetId(presetId);
      setStartupMenuVisible(false);
      hideVrMenu();
      if (!options?.keepSettings) {
        closeSettings();
      } else {
        resetSettingsTimer();
      }
    },
    [closeSettings, hideVrMenu, presetSlots, resetSettingsTimer]
  );

  const savePreset = useCallback(
    (presetId: string) => {
      setPresetSlots((current) =>
        current.map((preset) =>
          preset.id === presetId
            ? { ...preset, settings: { ...settingsRef.current } }
            : preset
        )
      );
    },
    []
  );

  const renamePreset = useCallback((presetId: string, name: string) => {
    const trimmed = name.trim().slice(0, 30);
    if (!trimmed) {
      return;
    }
    setPresetSlots((current) =>
      current.map((preset) =>
        preset.id === presetId ? { ...preset, name: trimmed } : preset
      )
    );
  }, []);

  const isApplePlatform = useIsApplePlatform();

  useEffect(() => {
    if (!isLandscape) {
      handleStop();
      rendererRef.current = null;
      autoStartRef.current = false;
      setStartupMenuVisible(true);
      setVrMenuVisible(false);
      closeSettings();
    }
  }, [closeSettings, handleStop, isLandscape]);

  useEffect(() => {
    if (!isRunning) {
      effectiveScaleRef.current = settings.scale;
      return;
    }
    void applyNativeZoom(settings.scale);
  }, [applyNativeZoom, isRunning, settings.scale]);

  useEffect(() => {
    if (settingsVisible) {
      resetSettingsTimer();
    }
  }, [resetSettingsTimer, settingsVisible]);

  useEffect(() => {
    if (vrMenuVisible) {
      setCursorPos({ x: 0.5, y: 0.5 });
    }
  }, [vrMenuVisible]);

  useEffect(() => {
    if (startupMenuVisible) {
      closeSettings();
      hideVrMenu();
    }
  }, [closeSettings, hideVrMenu, startupMenuVisible]);

  useEffect(() => {
    if (!settingsVisible) {
      setEditingPresetId(null);
      setSavePresetMode(false);
    }
  }, [settingsVisible]);

  useEffect(() => {
    if (uiMode !== "vr") {
      hideVrMenu();
    }
  }, [hideVrMenu, uiMode]);

  useEffect(() => {
    if (!isLandscape) {
      return;
    }
    if (autoStartRef.current) {
      return;
    }
    autoStartRef.current = true;
    void handleStart();
  }, [handleStart, isLandscape]);

  if (!isLandscape) {
    return (
      <div className="orientation-screen">
        <div className="orientation-card ">
          <div className="orientation-icon" aria-hidden="true" />
          <div className="orientation-title">Поверните устройство</div>
          <div className="orientation-text">
            Для корректной работы переведите телефон в альбомную ориентацию.
          </div>
          <div className="orientation-hint">
            После поворота интерфейс появится автоматически.
          </div>
        </div>

         <div className="orientation-card">
          {isApplePlatform ? (
            <MdIosShare size={36} aria-hidden="true" />
          ) : (
            <MdShare size={36} aria-hidden="true" />
          )}
          <div className="orientation-title">Добавьте на главный экран</div>
          <div className="orientation-text">
            Для полноценного опыта использования добавьте ссылку на главный экран. Нажмите "поделиться", затем выберите "добавить на главный экран" или "добавить на экран домой".
          </div>
          <div className="orientation-hint">
            После этого откройте приложение с рабочего стола. Оно запустится как полноценное приложение.
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className={`app ${uiMode === "vr" ? "mode-vr" : "mode-settings"}`}>
      <header className="topbar">
        <div className="brand">Phone VR Camera</div>
        <span className="chip">WebGL</span>
        <div className="status">
          {isRunning ? "Запущено" : "Остановлено"}
        </div>
        <button
          className="ghost"
          onClick={() =>
            setUiMode((mode) => {
              const next = mode === "settings" ? "vr" : "settings";
              if (next === "settings") {
                openSettings();
              } else {
                closeSettings();
              }
              return next;
            })
          }
        >
          {uiMode === "settings" ? "VR режим" : "Обычный режим"}
        </button>
      </header>

      <div
        className="stage"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDownCapture={handleStagePointerDown}
      >
        <div className="canvas-wrap">
          <canvas ref={canvasRef} />
        </div>

        <div className="hud">
          <button
            className={settings.calibration ? "toggle-active" : "ghost"}
            onClick={() => updateSettings({ calibration: !settings.calibration })}
          >
            Калибровка
          </button>
          <button
            ref={settingsButtonRef}
            className={`settings-button ${settingsVisible ? "toggle-active" : ""}`}
            onClick={() => {
              if (settingsVisible) {
                closeSettings();
              } else {
                openSettings();
              }
            }}
          >
            Настройки
          </button>
        </div>

        {startupMenuVisible && (
          <div className="startup-menu">
            <div className="startup-menu-inner">
              {presetSlots.map((preset) => (
                <button
                  key={preset.id}
                  className="startup-button"
                  style={{ background: withAlpha(preset.color, 0.75) }}
                  onClick={() => applyPreset(preset.id)}
                >
                  <span className="startup-title">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {vrMenuVisible && (
          <div className="vr-menu-dual" onPointerDown={hideVrMenu}>
            {["left", "right"].map((eye) => (
              <div key={eye} className="vr-menu-eye">
                <div
                  className="vr-menu-grid"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    resetMenuTimer();
                  }}
                >
                  {presetSlots.map((preset) => (
                    <button
                      key={`${eye}-${preset.id}`}
                      className={`vr-menu-button ${
                        activePresetId === preset.id ? "active" : ""
                      }`}
                      style={{ background: withAlpha(preset.color, 0.65) }}
                      onClick={() => applyPreset(preset.id)}
                    >
                      {preset.name}
                    </button>
                  ))}
                  <button
                    className="vr-menu-button settings"
                    onClick={() => {
                      hideVrMenu();
                      openSettings();
                    }}
                  >
                    Настройки
                  </button>
                </div>
                <div
                  className="vr-cursor"
                  style={{
                    left: `${cursorPos.x * 100}%`,
                    top: `${cursorPos.y * 100}%`
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {(!isRunning || error) && (
          <div className="overlay-message">
            <strong>{error ? "Ошибка камеры" : "Запуск камеры..."}</strong>
            <div className="notice">
              {error
                ? "Разрешите доступ к камере в браузере и перезагрузите страницу."
                : "Ожидайте подключение камеры. Если не запускается — проверьте разрешения."}
            </div>
            {error && (
              <div className="notice" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            )}
          </div>
        )}

        <video ref={videoRef} className="hidden-video" playsInline />

        <div
          ref={settingsPanelRef}
          className={`panel ${settingsVisible ? "" : "hidden"}`}
          onPointerDown={resetSettingsTimer}
          onTouchStart={(event) => {
            event.stopPropagation();
            resetSettingsTimer();
          }}
          onTouchMove={(event) => event.stopPropagation()}
          onWheel={(event) => {
            event.stopPropagation();
            resetSettingsTimer();
          }}
        >
          <div className="section-title">Камера</div>
          <div className="button-row">
            <button
              className={settings.distortionEnabled ? "toggle-active" : "ghost"}
              onClick={() =>
                updateSettings({ distortionEnabled: !settings.distortionEnabled })
              }
            >
              Дисторсия
            </button>
            <button
              className={settings.magnifierEnabled ? "toggle-active" : "ghost"}
              onClick={() =>
                updateSettings({ magnifierEnabled: !settings.magnifierEnabled })
              }
            >
              Лупа
            </button>
            <button
              className={settings.calibration ? "toggle-active" : "ghost"}
              onClick={() => updateSettings({ calibration: !settings.calibration })}
            >
              Сетка
            </button>
          </div>

          <div className="section-title">Профили</div>
          <div className="preset-grid">
            {presetSlots.map((preset) => (
              <PresetInput
                key={preset.id}
                preset={preset}
                isActive={activePresetId === preset.id}
                isEditing={editingPresetId === preset.id}
                onSelect={(presetId) => applyPreset(presetId, { keepSettings: true })}
                onRename={renamePreset}
                onRenameStart={(presetId) => setEditingPresetId(presetId)}
                onRenameEnd={() => setEditingPresetId(null)}
              />
            ))}
          </div>
          <div className="save-row">
            <button
              className={savePresetMode ? "toggle-active" : "ghost"}
              onClick={() => setSavePresetMode((current) => !current)}
            >
              Сохранить пресет
            </button>
            {savePresetMode && (
              <div className="save-targets">
                {presetSlots.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      savePreset(preset.id);
                      setSavePresetMode(false);
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="section-title">Фильтры</div>
          <div className="button-row">
            <button
              className={settings.filterMode === "none" ? "toggle-active" : "ghost"}
              onClick={() => updateSettings({ filterMode: "none" })}
            >
              Без фильтра
            </button>
            <button
              className={
                settings.filterMode === "amber" ? "toggle-active" : "ghost"
              }
              onClick={() => updateSettings({ filterMode: "amber" })}
            >
              Желто-черный
            </button>
            <button
              className={
                settings.filterMode === "deepblue" ? "toggle-active" : "ghost"
              }
              onClick={() => updateSettings({ filterMode: "deepblue" })}
            >
              Темно-сине-белый
            </button>
            <button
              className={
                settings.filterMode === "edge" ? "toggle-active" : "ghost"
              }
              onClick={() => updateSettings({ filterMode: "edge" })}
            >
              Контурная резкость
            </button>
          </div>

          <div className="section-title">Изображение</div>
          <div className="controls">
            <Slider
              label="Контраст"
              min={0.5}
              max={2}
              step={0.01}
              value={settings.contrast}
              onChange={(value) => updateSettings({ contrast: value })}
            />
            <Slider
              label="Яркость"
              min={-0.5}
              max={0.5}
              step={0.01}
              value={settings.brightness}
              onChange={(value) => updateSettings({ brightness: value })}
            />
            <Slider
              label="Гамма"
              min={0.5}
              max={2.5}
              step={0.01}
              value={settings.gamma}
              onChange={(value) => updateSettings({ gamma: value })}
            />
            <Slider
              label="Температура"
              min={-1}
              max={1}
              step={0.01}
              value={settings.temperature}
              onChange={(value) => updateSettings({ temperature: value })}
            />
            <Slider
              label="Светлые участки"
              min={-1}
              max={1}
              step={0.01}
              value={settings.highlights}
              onChange={(value) => updateSettings({ highlights: value })}
            />
            <Slider
              label="Тени"
              min={-1}
              max={1}
              step={0.01}
              value={settings.shadows}
              onChange={(value) => updateSettings({ shadows: value })}
            />
          </div>

          <div className="section-title">Выравнивание глаз</div>
          <div className="controls">
            <Slider
              label="Левый сдвиг X"
              min={-0.2}
              max={0.2}
              step={0.001}
              value={settings.leftOffsetX}
              onChange={(value) => updateSettings({ leftOffsetX: value })}
            />
            <Slider
              label="Правый сдвиг X"
              min={-0.2}
              max={0.2}
              step={0.001}
              value={settings.rightOffsetX}
              onChange={(value) => updateSettings({ rightOffsetX: value })}
            />
            <Slider
              label="Масштаб"
              min={1}
              max={3}
              step={0.01}
              value={settings.scale}
              onChange={(value) => updateSettings({ scale: value })}
            />
            <Slider
              label="Межзрачковое смещение"
              min={-0.1}
              max={0.1}
              step={0.001}
              value={settings.separation}
              onChange={(value) => updateSettings({ separation: value })}
            />
          </div>

          <div className="section-title">Дисторсия</div>
          <div className="controls">
            <Slider
              label="k1 (0-100)"
              min={0}
              max={100}
              step={1}
              value={settings.k1}
              onChange={(value) => updateSettings({ k1: value })}
              formatValue={(value) => value.toFixed(0)}
            />
            <Slider
              label="k2 (0-100)"
              min={0}
              max={100}
              step={1}
              value={settings.k2}
              onChange={(value) => updateSettings({ k2: value })}
              formatValue={(value) => value.toFixed(0)}
            />
            <Slider
              label="Сферизация (граница)"
              min={0}
              max={100}
              step={1}
              value={settings.sphereStrength}
              onChange={(value) => updateSettings({ sphereStrength: value })}
              formatValue={(value) => value.toFixed(0)}
            />
            <Slider
              label="Диаметр сферы (0-100)"
              min={0}
              max={100}
              step={1}
              value={settings.sphereDiameter}
              onChange={(value) => updateSettings({ sphereDiameter: value })}
              formatValue={(value) => value.toFixed(0)}
            />
          </div>

          <div className="section-title">Лупа</div>
          <div className="controls">
            <Slider
              label="Увеличение лупы"
              min={1}
              max={10}
              step={0.01}
              value={settings.magnifierZoom}
              onChange={(value) => updateSettings({ magnifierZoom: value })}
            />
            <Slider
              label="Размер лупы"
              min={0.2}
              max={1}
              step={0.01}
              value={settings.magnifierSize}
              onChange={(value) => updateSettings({ magnifierSize: value })}
            />
          </div>

          <div className="section-title">Советы</div>
          <div className="notice">
            Используйте сетку для калибровки. Увеличьте масштаб, если картинка
            слишком маленькая. Отрегулируйте межзрачковое смещение под линзы.
          </div>
        </div>
      </div>
    </div>
  );
}
