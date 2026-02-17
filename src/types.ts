export type VRSettings = {
  leftOffsetX: number;
  leftOffsetY: number;
  rightOffsetX: number;
  rightOffsetY: number;
  scale: number;
  separation: number;
  contrast: number;
  brightness: number;
  gamma: number;
  highlights: number;
  shadows: number;
  temperature: number;
  distortionEnabled: boolean;
  k1: number;
  k2: number;
  sphereStrength: number;
  sphereDiameter: number;
  filterMode: "none" | "amber" | "deepblue" | "edge";
  magnifierEnabled: boolean;
  magnifierZoom: number;
  magnifierSize: number;
  calibration: boolean;
};

export const defaultSettings: VRSettings = {
  leftOffsetX: 0,
  leftOffsetY: 0,
  rightOffsetX: 0,
  rightOffsetY: 0,
  scale: 1.0,
  separation: 0.02,
  contrast: 1.0,
  brightness: 0.0,
  gamma: 1.0,
  highlights: 0.0,
  shadows: 0.0,
  temperature: 0.0,
  distortionEnabled: true,
  k1: 35,
  k2: 20,
  sphereStrength: 0,
  sphereDiameter: 100,
  filterMode: "none",
  magnifierEnabled: false,
  magnifierZoom: 1.6,
  magnifierSize: 0.44,
  calibration: false
};
