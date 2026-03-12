import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import SettingsPanel from "../components/SettingsPanel";
import VRCanvas from "../components/VRCanvas";
import { drawBookPageToCanvas, parseBookFile, type BookContent } from "./bookUtils";
import { clearFileFromStore, loadFileFromStore, saveFileToStore } from "../storage/fileStore";
import type { VRSettings } from "../types";

const BOOK_SLOT = "book";
const BOOK_PAGE_KEY = "book-viewer-page";

type BooksPageProps = {
  settings: VRSettings;
  updateSettings: (patch: Partial<VRSettings>) => void;
  resetSettings: () => void;
  onBack: () => void;
};

const loadLastPage = () => {
  if (typeof window === "undefined") {
    return 1;
  }
  const raw = window.localStorage.getItem(BOOK_PAGE_KEY);
  const page = Number(raw);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
};

const toCssFilter = (settings: VRSettings) => {
  const brightness = Math.max(0.2, 1 + settings.brightness);
  const contrast = Math.max(0.2, settings.contrast);
  const grayscale = settings.filterMode === "none" ? 0 : settings.filterMode === "edge" ? 1 : 0;

  return [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `grayscale(${grayscale})`
  ].join(" ");
};

export default function BooksPage({
  settings,
  updateSettings,
  resetSettings,
  onBack
}: BooksPageProps) {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [bookContent, setBookContent] = useState<BookContent | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [page, setPage] = useState<number>(() => loadLastPage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!sourceCanvasRef.current && typeof document !== "undefined") {
    sourceCanvasRef.current = document.createElement("canvas");
  }

  const openBookFile = useCallback(async (file: File, persist: boolean, resetPage = true) => {
    setError(null);

    const parsed = await parseBookFile(file);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (parsed.kind === "pdf") {
      objectUrlRef.current = parsed.objectUrl;
    }

    if (persist) {
      await saveFileToStore(BOOK_SLOT, file, file.name, file.type);
    }

    setFileName(file.name);
    setBookContent(parsed);
    if (resetPage) {
      setPage(1);
    }
  }, []);

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
        await openBookFile(restoredFile, false, false);
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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [openBookFile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(BOOK_PAGE_KEY, String(page));
  }, [page]);

  useEffect(() => {
    if (!bookContent || bookContent.kind !== "text" || !sourceCanvasRef.current) {
      return;
    }

    const pageCount = Math.max(1, bookContent.pages.length);
    const clampedPage = Math.min(pageCount, Math.max(1, page));
    if (clampedPage !== page) {
      setPage(clampedPage);
      return;
    }

    const pageText = bookContent.pages[clampedPage - 1] ?? "";
    drawBookPageToCanvas(sourceCanvasRef.current, pageText, fileName, clampedPage, pageCount);
  }, [bookContent, fileName, page]);

  const getSource = useCallback(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || !bookContent || bookContent.kind !== "text") {
      return null;
    }

    return {
      element: canvas,
      width: canvas.width || 1,
      height: canvas.height || 1,
      ready: true
    };
  }, [bookContent]);

  const pageCount = useMemo(() => {
    if (!bookContent || bookContent.kind !== "text") {
      return null;
    }
    return Math.max(1, bookContent.pages.length);
  }, [bookContent]);

  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        setLoading(true);
        await openBookFile(file, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось открыть файл");
      } finally {
        setLoading(false);
        event.target.value = "";
      }
    },
    [openBookFile]
  );

  const handleCloseFile = useCallback(async () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setBookContent(null);
    setFileName("");
    setPage(1);
    setError(null);
    await clearFileFromStore(BOOK_SLOT);
  }, []);

  const cssFilter = useMemo(() => toCssFilter(settings), [settings]);

  if (!bookContent) {
    return (
      <div className="app">
        <div className="media-empty-screen">
          <div className="media-empty-card">
            <h2>Книги</h2>
            <p>Загрузите файл в формате PDF, FB2 или HTML.</p>
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
              accept=".pdf,.fb2,.html,.htm,application/pdf,text/html,application/xml,text/xml"
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
      <div className="stage">
        <div className="hud media-controls">
          <button className="ghost" onClick={onBack}>Меню</button>
          <button className="ghost" onClick={() => setPage((current) => Math.max(1, current - 1))}>◀</button>
          <span className="media-page-label">
            {page}
            {pageCount ? ` / ${pageCount}` : ""}
          </span>
          <button
            className="ghost"
            onClick={() =>
              setPage((current) =>
                pageCount ? Math.min(pageCount, current + 1) : current + 1
              )
            }
          >
            ▶
          </button>
          <button
            className={settingsVisible ? "settings-button toggle-active" : "settings-button"}
            onClick={() => setSettingsVisible((current) => !current)}
          >
            Настройки
          </button>
          <button className="ghost" onClick={() => void handleCloseFile()}>Выйти</button>
        </div>

        {bookContent.kind === "text" ? (
          <div className="canvas-wrap">
            <VRCanvas getSource={getSource} settings={settings} />
          </div>
        ) : (
          <div className="split-fallback" style={{ filter: cssFilter }}>
            <iframe
              title="book-left"
              src={`${bookContent.objectUrl}#page=${page}&view=FitH`}
              className="split-fallback-frame"
            />
            <iframe
              title="book-right"
              src={`${bookContent.objectUrl}#page=${page}&view=FitH`}
              className="split-fallback-frame"
            />
          </div>
        )}

        <SettingsPanel
          visible={settingsVisible}
          settings={settings}
          updateSettings={updateSettings}
          onClose={() => setSettingsVisible(false)}
          onReset={resetSettings}
        />
      </div>
    </div>
  );
}
