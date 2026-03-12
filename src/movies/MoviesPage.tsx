import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import SettingsPanel from "../components/SettingsPanel";
import VRCanvas from "../components/VRCanvas";
import { clearFileFromStore, loadFileFromStore, saveFileToStore } from "../storage/fileStore";
import type { VRSettings } from "../types";

const MOVIE_SLOT = "movie";

type MoviesPageProps = {
  settings: VRSettings;
  updateSettings: (patch: Partial<VRSettings>) => void;
  resetSettings: () => void;
  onBack: () => void;
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function MoviesPage({
  settings,
  updateSettings,
  resetSettings,
  onBack
}: MoviesPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const applyMovieFile = useCallback(async (file: File, persist: boolean) => {
    const video = videoRef.current;
    if (!video) {
      throw new Error("Не найден video элемент");
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    video.src = objectUrl;
    video.loop = false;
    video.muted = false;
    video.playsInline = true;

    await video.play().catch(() => undefined);

    if (persist) {
      await saveFileToStore(MOVIE_SLOT, file, file.name, file.type);
    }

    setFileName(file.name);
    setHasFile(true);
    setError(null);
  }, []);

  useEffect(() => {
    let disposed = false;

    const restore = async () => {
      setLoading(true);
      try {
        const saved = await loadFileFromStore(MOVIE_SLOT);
        if (!saved || disposed) {
          return;
        }

        const restored = new File([saved.blob], saved.name, {
          type: saved.type || saved.blob.type,
          lastModified: saved.updatedAt
        });

        await applyMovieFile(restored, false);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Не удалось восстановить файл");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void restore();

    return () => {
      disposed = true;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [applyMovieFile]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime || 0);
      setDuration(video.duration || 0);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const getSource = useCallback(() => {
    const video = videoRef.current;
    if (!video || !hasFile) {
      return null;
    }

    return {
      element: video,
      width: video.videoWidth || 1,
      height: video.videoHeight || 1,
      ready: video.readyState >= video.HAVE_CURRENT_DATA
    };
  }, [hasFile]);

  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        setLoading(true);
        await applyMovieFile(file, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось открыть видео");
      } finally {
        setLoading(false);
        event.target.value = "";
      }
    },
    [applyMovieFile]
  );

  const handleExitFile = useCallback(async () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    await clearFileFromStore(MOVIE_SLOT);
    setHasFile(false);
    setFileName("");
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setError(null);
  }, []);

  const mediaLabel = useMemo(
    () => `${formatTime(currentTime)} / ${formatTime(duration)}`,
    [currentTime, duration]
  );

  return (
    <div className="app">
      {hasFile ? (
        <div className="stage">
          <div className="canvas-wrap">
            <VRCanvas getSource={getSource} settings={settings} />
          </div>

          <div className="hud media-controls">
            <button className="ghost" onClick={onBack}>Меню</button>
            <button
              className="ghost"
              onClick={() => {
                const video = videoRef.current;
                if (!video) {
                  return;
                }
                video.currentTime = Math.max(0, video.currentTime - 10);
              }}
            >
              -10s
            </button>
            <button
              className="ghost"
              onClick={() => {
                const video = videoRef.current;
                if (!video) {
                  return;
                }
                if (video.paused) {
                  void video.play();
                } else {
                  video.pause();
                }
              }}
            >
              {isPlaying ? "Пауза" : "Плей"}
            </button>
            <button
              className="ghost"
              onClick={() => {
                const video = videoRef.current;
                if (!video) {
                  return;
                }
                video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
              }}
            >
              +10s
            </button>
            <span className="media-page-label">{mediaLabel}</span>
            <button
              className={settingsVisible ? "settings-button toggle-active" : "settings-button"}
              onClick={() => setSettingsVisible((current) => !current)}
            >
              Настройки
            </button>
            <button className="ghost" onClick={() => void handleExitFile()}>Выйти</button>
          </div>

          <div className="overlay-message" style={{ inset: "auto 16px 16px 16px" }}>
            <strong>{fileName}</strong>
            <div className="notice">Видео сохраняется и откроется снова при следующем запуске.</div>
          </div>

          <SettingsPanel
            visible={settingsVisible}
            settings={settings}
            updateSettings={updateSettings}
            onClose={() => setSettingsVisible(false)}
            onReset={resetSettings}
          />
        </div>
      ) : (
        <div className="media-empty-screen">
          <div className="media-empty-card">
            <h2>Фильмы</h2>
            <p>Загрузите видеофайл (MP4, WebM, MOV и другие форматы, поддерживаемые браузером).</p>
            {error && <div className="notice" style={{ color: "var(--danger)" }}>{error}</div>}
            <div className="button-row media-empty-buttons">
              <button
                className="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? "Загрузка..." : "Загрузить файл"}
              </button>
              <button className="ghost" onClick={onBack}>Главное меню</button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.webm,.mkv,.mov,.avi,.m4v"
              className="hidden-input"
              onChange={handleUpload}
            />
          </div>
        </div>
      )}
      <video ref={videoRef} className="hidden-video" playsInline />
    </div>
  );
}
