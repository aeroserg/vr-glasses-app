import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type TouchEvent,
  type WheelEvent
} from "react";
import SettingsPanel from "../components/SettingsPanel";
import VRCanvas from "../components/VRCanvas";
import {
  createReaderLayout,
  drawReaderToCanvas,
  parseBookFile,
  readerCanvasSize,
  type BookContent
} from "./bookUtils";
import { clearFileFromStore, loadFileFromStore, saveFileToStore } from "../storage/fileStore";
import type { VRSettings } from "../types";

const BOOK_SLOT = "book";
const BOOK_SCROLL_PREFIX = "book-viewer-scroll:";

type BooksPageProps = {
  settings: VRSettings;
  updateSettings: (patch: Partial<VRSettings>) => void;
  resetSettings: () => void;
  onBack: () => void;
};

const scrollStorageKey = (fileKey: string) => `${BOOK_SCROLL_PREFIX}${encodeURIComponent(fileKey)}`;

const loadSavedScroll = (fileKey: string) => {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(scrollStorageKey(fileKey));
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
};

const saveScroll = (fileKey: string, scrollTop: number) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(scrollStorageKey(fileKey), String(Math.max(0, Math.round(scrollTop))));
};

const shouldIgnoreStageScroll = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(".hud") ||
      target.closest(".panel") ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("label")
  );
};

export default function BooksPage({
  settings,
  updateSettings,
  resetSettings,
  onBack
}: BooksPageProps) {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [bookContent, setBookContent] = useState<BookContent | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchYRef = useRef<number | null>(null);

  if (!sourceCanvasRef.current && typeof document !== "undefined") {
    sourceCanvasRef.current = document.createElement("canvas");
  }

  const openBookFile = useCallback(
    async (file: File, options: { persist: boolean; restorePosition: boolean }) => {
      const parsed = await parseBookFile(file);

      if (options.persist) {
        await saveFileToStore(BOOK_SLOT, file, file.name, file.type);
      }

      setBookContent(parsed);
      setScrollTop(options.restorePosition ? loadSavedScroll(parsed.fileKey) : 0);
      setError(null);
    },
    []
  );

  useEffect(() => {
    let disposed = false;

    const loadStored = async () => {
      setLoading(true);

      try {
        const saved = await loadFileFromStore(BOOK_SLOT);
        if (!saved || disposed) {
          return;
        }

        const restoredFile = new File([saved.blob], saved.name, {
          type: saved.type || saved.blob.type,
          lastModified: saved.updatedAt
        });

        await openBookFile(restoredFile, { persist: false, restorePosition: true });
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Не удалось восстановить книгу");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void loadStored();

    return () => {
      disposed = true;
    };
  }, [openBookFile]);

  const layout = useMemo(
    () =>
      bookContent
        ? createReaderLayout(bookContent, {
            readerFontFamily: settings.readerFontFamily,
            readerFontSize: settings.readerFontSize
          })
        : null,
    [bookContent, settings.readerFontFamily, settings.readerFontSize]
  );

  useEffect(() => {
    if (!bookContent) {
      return;
    }

    saveScroll(bookContent.fileKey, scrollTop);
  }, [bookContent, scrollTop]);

  useEffect(() => {
    if (!layout) {
      return;
    }
    setScrollTop((current) => Math.min(layout.maxScrollTop, Math.max(0, current)));
  }, [layout]);

  useEffect(() => {
    if (!layout || !sourceCanvasRef.current) {
      return;
    }

    drawReaderToCanvas(sourceCanvasRef.current, layout, scrollTop);
  }, [layout, scrollTop]);

  const getSource = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || !bookContent) {
      return null;
    }

    return {
      element: canvas,
      width: canvas.width || readerCanvasSize,
      height: canvas.height || readerCanvasSize,
      ready: true
    };
  }, [bookContent]);

  const clampScroll = useCallback(
    (next: number) => {
      if (!layout) {
        return 0;
      }
      return Math.min(layout.maxScrollTop, Math.max(0, next));
    },
    [layout]
  );

  const scrollBy = useCallback(
    (delta: number) => {
      setScrollTop((current) => clampScroll(current + delta));
    },
    [clampScroll]
  );

  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        setLoading(true);
        await openBookFile(file, { persist: true, restorePosition: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось открыть файл");
      } finally {
        setLoading(false);
        event.target.value = "";
      }
    },
    [openBookFile]
  );

  const handleClearFile = useCallback(async () => {
    setLoading(true);
    try {
      await clearFileFromStore(BOOK_SLOT);
      setBookContent(null);
      setScrollTop(0);
      setSettingsVisible(false);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (!bookContent || settingsVisible || shouldIgnoreStageScroll(event.target)) {
        return;
      }

      event.preventDefault();
      scrollBy(event.deltaY);
    },
    [bookContent, scrollBy, settingsVisible]
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (settingsVisible || shouldIgnoreStageScroll(event.target)) {
        touchYRef.current = null;
        return;
      }

      if (event.touches.length === 1) {
        touchYRef.current = event.touches[0].clientY;
      }
    },
    [settingsVisible]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (settingsVisible || shouldIgnoreStageScroll(event.target)) {
        return;
      }

      if (touchYRef.current === null || event.touches.length !== 1) {
        return;
      }

      const currentY = event.touches[0].clientY;
      const delta = touchYRef.current - currentY;
      if (Math.abs(delta) < 1) {
        return;
      }

      event.preventDefault();
      scrollBy(delta * 1.1);
      touchYRef.current = currentY;
    },
    [scrollBy, settingsVisible]
  );

  const handleTouchEnd = useCallback(() => {
    touchYRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !bookContent) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (settingsVisible) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        scrollBy(140);
      }

      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        scrollBy(-140);
      }

      if (event.key === "Home") {
        event.preventDefault();
        setScrollTop(0);
      }

      if (event.key === "End" && layout) {
        event.preventDefault();
        setScrollTop(layout.maxScrollTop);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [bookContent, layout, scrollBy, settingsVisible]);

  const handleExit = useCallback(() => {
    setSettingsVisible(false);
    onBack();
  }, [onBack]);

  const progress = useMemo(() => {
    if (!layout) {
      return 0;
    }
    if (layout.maxScrollTop <= 0) {
      return 100;
    }
    return Math.round((clampScroll(scrollTop) / layout.maxScrollTop) * 100);
  }, [clampScroll, layout, scrollTop]);

  if (!bookContent) {
    return (
      <div className="app">
        <div className="media-empty-screen">
          <div className="media-empty-card">
            <h2>Читалка</h2>
            <p>Поддерживаются PDF, FB2, TXT, DOCX и HTML. Все файлы открываются как единая длинная лента текста.</p>
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
              accept=".pdf,.fb2,.txt,.docx,.html,.htm,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,application/xml,text/xml"
              className="hidden-input"
              onChange={handleUpload}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div
        className="stage reader-stage"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="canvas-wrap">
          <VRCanvas getSource={getSource} settings={settings} className="reader-canvas" />
        </div>

        <div className="hud reader-hud">
          <div className="reader-status">{bookContent.fileName}</div>
          <div className="reader-status">{progress}%</div>
          <button
            className={settingsVisible ? "settings-button toggle-active" : "settings-button"}
            onClick={() => setSettingsVisible((current) => !current)}
          >
            Настройки
          </button>
          <button className="ghost" onClick={handleExit}>Выход в меню</button>
        </div>

        {error && (
          <div className="overlay-message reader-overlay">
            <strong>Ошибка файла</strong>
            <div className="notice" style={{ color: "var(--danger)" }}>{error}</div>
          </div>
        )}

        <SettingsPanel
          visible={settingsVisible}
          settings={settings}
          updateSettings={updateSettings}
          onClose={() => setSettingsVisible(false)}
          onReset={resetSettings}
          showReaderTypography
        >
          <div className="button-row">
            <button className="ghost" onClick={() => fileInputRef.current?.click()}>Открыть другой файл</button>
            <button className="ghost" onClick={() => void handleClearFile()}>Убрать файл</button>
            <button className="ghost" onClick={handleExit}>Выход в меню</button>
          </div>
          <div className="notice">Позиция чтения сохраняется автоматически и восстановится после повторного открытия.</div>
        </SettingsPanel>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.fb2,.txt,.docx,.html,.htm,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,application/xml,text/xml"
          className="hidden-input"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
}
