import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GLRenderer } from "./gl/renderer";
import { defaultSettings, VRSettings } from "./types";
import { MdIosShare, MdShare } from "react-icons/md";

const SETTINGS_KEY = "phone-vr-camera-settings";

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
    const merged: VRSettings = { ...defaultSettings, ...parsed };
    if (merged.k1 <= 1 && merged.k2 <= 1) {
      merged.k1 = merged.k1 * 100;
      merged.k2 = merged.k2 * 100;
    }
    return merged;
  } catch {
    return defaultSettings;
  }
};

const presets: Record<string, VRSettings> = {
  "Сброс": defaultSettings,
  "Мягкий": {
    ...defaultSettings,
    scale: 1.05,
    separation: 0.02,
    contrast: 1.05,
    k1: 25,
    k2: 12,
    sphereStrength: 25,
    sphereDiameter: 90
  },
  "Сильный": {
    ...defaultSettings,
    scale: 1.15,
    separation: 0.03,
    contrast: 1.1,
    k1: 70,
    k2: 45,
    sphereStrength: 60,
    sphereDiameter: 100
  }
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
  const [settings, setSettings] = useState<VRSettings>(() => loadSettings());
  const [uiMode, setUiMode] = useState<UiMode>("settings");
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
    return () => {
      handleStop();
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

  const handleStart = async () => {
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

      if (!canvasRef.current) {
        throw new Error("Не найден canvas элемент.");
      }

      if (!rendererRef.current) {
        rendererRef.current = new GLRenderer(
          canvasRef.current,
          video,
          () => settingsRef.current
        );
      }

      rendererRef.current.start();
      setIsRunning(true);
    } catch (err) {
      setError(errorMessage(err));
      setIsRunning(false);
    }
  };

  const handleStop = useCallback(() => {
    rendererRef.current?.stop();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRunning(false);
  }, []);

  const applyPreset = (preset: VRSettings) => {
    setSettings(preset);
  };

  const isApplePlatform = useIsApplePlatform();

  useEffect(() => {
    if (!isLandscape) {
      handleStop();
      rendererRef.current = null;
    }
  }, [handleStop, isLandscape]);

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
            setUiMode((mode) => (mode === "settings" ? "vr" : "settings"))
          }
        >
          {uiMode === "settings" ? "VR режим" : "Настройки"}
        </button>
      </header>

      <div className="stage">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} />
        </div>

        <div className="hud">
          {isRunning ? (
            <button className="danger" onClick={handleStop}>
              Стоп
            </button>
          ) : (
            <button className="primary" onClick={handleStart}>
              Старт
            </button>
          )}
          <button
            className={settings.calibration ? "toggle-active" : "ghost"}
            onClick={() => updateSettings({ calibration: !settings.calibration })}
          >
            Калибровка
          </button>
          {uiMode === "vr" && (
            <button className="ghost" onClick={() => setUiMode("settings")}>
              Настройки
            </button>
          )}
        </div>

        {!isRunning && (
          <div className="overlay-message">
            <strong>Готово к запуску камеры</strong>
            <div className="notice">
              Нажмите Старт для доступа к задней камере. Настройки смещения, масштаба и дисторсии доступны в
              панели.
            </div>
            {error && (
              <div className="notice" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            )}
          </div>
        )}

        <video ref={videoRef} className="hidden-video" playsInline />

        <div className={`panel ${uiMode === "settings" ? "" : "hidden"}`}>
          <div className="section-title">Камера</div>
          <div className="button-row">
            {isRunning ? (
              <button className="danger" onClick={handleStop}>
                Остановить
              </button>
            ) : (
              <button className="primary" onClick={handleStart}>
                Запустить
              </button>
            )}
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

          <div className="section-title">Пресеты</div>
          <div className="button-row">
            {Object.entries(presets).map(([label, preset]) => (
              <button key={label} onClick={() => applyPreset(preset)}>
                {label}
              </button>
            ))}
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
              label="Левый сдвиг Y"
              min={-0.2}
              max={0.2}
              step={0.001}
              value={settings.leftOffsetY}
              onChange={(value) => updateSettings({ leftOffsetY: value })}
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
              label="Правый сдвиг Y"
              min={-0.2}
              max={0.2}
              step={0.001}
              value={settings.rightOffsetY}
              onChange={(value) => updateSettings({ rightOffsetY: value })}
            />
            <Slider
              label="Масштаб"
              min={0.7}
              max={1.7}
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
              max={3}
              step={0.01}
              value={settings.magnifierZoom}
              onChange={(value) => updateSettings({ magnifierZoom: value })}
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
