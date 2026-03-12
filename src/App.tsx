import { useCallback, useEffect, useMemo, useState } from "react";
import HomePage from "./HomePage";
import CameraPage from "./camera/CameraPage";
import BooksPage from "./books/BooksPage";
import MoviesPage from "./movies/MoviesPage";
import OrientationGate from "./components/OrientationGate";
import { useSharedSettings } from "./settings/useSharedSettings";

type AppRoute = "home" | "camera" | "books" | "movies";

const parseRouteFromHash = (): AppRoute => {
  if (typeof window === "undefined") {
    return "home";
  }

  const raw = window.location.hash.replace(/^#\/?/, "").trim().toLowerCase();

  if (raw === "camera") return "camera";
  if (raw === "books") return "books";
  if (raw === "movies") return "movies";
  return "home";
};

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseRouteFromHash());
  const { settings, updateSettings, resetSettings } = useSharedSettings();

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseRouteFromHash());
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    if (typeof window === "undefined") {
      return;
    }

    if (next === "home") {
      if (window.location.hash) {
        window.location.hash = "";
      }
      setRoute("home");
      return;
    }

    window.location.hash = `/${next}`;
  }, []);

  const page = useMemo(() => {
    if (route === "home") {
      return (
        <HomePage
          onOpenCamera={() => navigate("camera")}
          onOpenBooks={() => navigate("books")}
          onOpenMovies={() => navigate("movies")}
        />
      );
    }

    if (route === "camera") {
      return (
        <OrientationGate>
          <CameraPage onBack={() => navigate("home")} />
        </OrientationGate>
      );
    }

    if (route === "books") {
      return (
        <OrientationGate>
          <BooksPage
            settings={settings}
            updateSettings={updateSettings}
            resetSettings={resetSettings}
            onBack={() => navigate("home")}
          />
        </OrientationGate>
      );
    }

    return (
      <OrientationGate>
        <MoviesPage
          settings={settings}
          updateSettings={updateSettings}
          resetSettings={resetSettings}
          onBack={() => navigate("home")}
        />
      </OrientationGate>
    );
  }, [navigate, resetSettings, route, settings, updateSettings]);

  return page;
}
