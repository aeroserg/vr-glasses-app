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
  distortionEnabled: boolean;
  k1: number;
  k2: number;
  magnifierEnabled: boolean;
  magnifierZoom: number;
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
  distortionEnabled: true,
  k1: 35,
  k2: 20,
  magnifierEnabled: false,
  magnifierZoom: 1.6,
  calibration: false
};
