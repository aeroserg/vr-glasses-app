import { useEffect, useMemo, useState } from "react";

export const useIsApplePlatform = (): boolean => {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;

    const ua = navigator.userAgent ?? "";
    const platform = (navigator.platform ?? "") as string;
    const maxTouchPoints = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0;
    const chPlatform = (navigator as Navigator & {
      userAgentData?: { platform?: string };
    }).userAgentData?.platform;

    if (chPlatform) return chPlatform === "macOS" || chPlatform === "iOS" || chPlatform === "iPadOS";

    if (/Windows NT/i.test(ua) || /^Win/i.test(platform)) return false;
    if (/Android/i.test(ua)) return false;

    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    if (platform === "MacIntel" && maxTouchPoints > 1) return true;
    if (/^Mac/i.test(platform)) return true;
    if (/Macintosh/i.test(ua) && !/Mobile/i.test(ua)) return true;

    return false;
  }, []);
};

const detectLandscape = () => {
  if (typeof window === "undefined") {
    return true;
  }
  const mq = window.matchMedia?.("(orientation: landscape)");
  if (mq && typeof mq.matches === "boolean") {
    return mq.matches;
  }
  return window.innerWidth >= window.innerHeight;
};

export const useIsLandscape = () => {
  const [isLandscape, setIsLandscape] = useState<boolean>(() => detectLandscape());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mq = window.matchMedia?.("(orientation: landscape)");
    const onChange = () => setIsLandscape(detectLandscape());

    onChange();
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);

    if (mq) {
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onChange);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(onChange);
      }
    }

    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      if (mq) {
        if (typeof mq.removeEventListener === "function") {
          mq.removeEventListener("change", onChange);
        } else if (typeof mq.removeListener === "function") {
          mq.removeListener(onChange);
        }
      }
    };
  }, []);

  return isLandscape;
};
