import { useEffect, useRef } from "react";
import { GLRenderer, type RenderSource } from "../gl/renderer";
import type { VRSettings } from "../types";

type VRCanvasProps = {
  getSource: () => RenderSource | null;
  settings: VRSettings;
  className?: string;
};

export default function VRCanvas({ getSource, settings, className }: VRCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GLRenderer | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    try {
      rendererRef.current = new GLRenderer(
        canvas,
        () => getSource(),
        () => settingsRef.current
      );
      rendererRef.current.start();
    } catch (error) {
      console.error(error);
    }

    return () => {
      rendererRef.current?.stop();
      rendererRef.current = null;
    };
  }, [getSource]);

  return <canvas ref={canvasRef} className={className} />;
}
