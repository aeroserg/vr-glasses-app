export const vertexWebGL1 = `
attribute vec2 aPosition;
attribute vec2 aUV;

varying vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const fragmentWebGL1 = `
precision mediump float;

varying vec2 vUV;

uniform sampler2D uTexture;
uniform float uContrast;
uniform float uBrightness;
uniform float uGamma;
uniform float uHighlights;
uniform float uShadows;
uniform float uScale;
uniform vec2 uOffset;
uniform float uSeparation;
uniform float uEyeSign;
uniform float uVideoAspect;
uniform float uMagnifyEnabled;
uniform float uMagnifyZoom;
uniform float uSphereStrength;
uniform float uSphereRadius;
uniform float uK1;
uniform float uK2;
uniform float uDistortEnabled;
uniform float uCalibrate;
uniform vec2 uResolution;
uniform float uFilterMode;
uniform vec2 uTexel;

vec3 applyColor(vec3 color) {
  color = (color - 0.5) * uContrast + 0.5;
  color += uBrightness;
  color = clamp(color, 0.0, 1.0);
  color = pow(color, vec3(1.0 / max(uGamma, 0.001)));
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float shadowMask = 1.0 - smoothstep(0.2, 0.55, lum);
  float highlightMask = smoothstep(0.55, 0.9, lum);
  color += shadowMask * uShadows * 0.35;
  color += highlightMask * uHighlights * 0.35;
  return clamp(color, 0.0, 1.0);
}

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float sobelEdge(vec2 uv) {
  vec2 t = uTexel;
  float tl = luminance(texture2D(uTexture, uv + vec2(-t.x, -t.y)).rgb);
  float tc = luminance(texture2D(uTexture, uv + vec2(0.0, -t.y)).rgb);
  float tr = luminance(texture2D(uTexture, uv + vec2(t.x, -t.y)).rgb);
  float ml = luminance(texture2D(uTexture, uv + vec2(-t.x, 0.0)).rgb);
  float mr = luminance(texture2D(uTexture, uv + vec2(t.x, 0.0)).rgb);
  float bl = luminance(texture2D(uTexture, uv + vec2(-t.x, t.y)).rgb);
  float bc = luminance(texture2D(uTexture, uv + vec2(0.0, t.y)).rgb);
  float br = luminance(texture2D(uTexture, uv + vec2(t.x, t.y)).rgb);

  float gx = -tl + tr + -2.0 * ml + 2.0 * mr + -bl + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = sqrt(gx * gx + gy * gy);
  return step(0.1, edge);
}

vec2 applyDistortion(vec2 uv, vec2 center) {
  float enabled = step(0.5, uDistortEnabled);
  vec2 d = uv - center;
  float r2 = dot(d, d);
  float factor = 1.0 + uK1 * r2 + uK2 * r2 * r2;
  vec2 warped = center + d * factor;
  return mix(uv, warped, enabled);
}

float lineMask(float v, float count, float thickness) {
  float cell = abs(fract(v * count) - 0.5);
  return 1.0 - smoothstep(0.0, thickness, cell);
}

void main() {
  vec2 uv = vUV;
  if (uVideoAspect > 1.0) {
    uv.x = (uv.x - 0.5) / uVideoAspect + 0.5;
  } else {
    uv.y = (uv.y - 0.5) * uVideoAspect + 0.5;
  }

  uv = (uv - 0.5) / uScale + 0.5;
  vec2 eyeShift = vec2(uEyeSign * uSeparation, 0.0);
  uv += uOffset + eyeShift;

  vec2 center = vec2(0.5) + uOffset + eyeShift;
  vec2 warped = applyDistortion(uv, center);

  float sphereStrength = clamp(uSphereStrength, 0.0, 1.0);
  float sphereRadius = max(uSphereRadius, 0.00001);
  vec2 screenDelta = vUV - 0.5;
  float screenR = length(screenDelta);
  float normR = screenR / sphereRadius;
  if (sphereStrength > 0.001) {
    float clampedR = clamp(normR, 0.0, 1.0);
    float sphereNorm = asin(clampedR) / 1.57079632679;
    vec2 dir = screenR > 0.00001 ? screenDelta / screenR : vec2(0.0, 0.0);
    vec2 sphereDelta = dir * (sphereNorm * sphereRadius) / uScale;
    vec2 sphereUV = center + sphereDelta;
    float feather = mix(0.45, 0.0, sphereStrength);
    float mask = feather > 0.0001
      ? (1.0 - smoothstep(1.0 - feather, 1.0, normR))
      : step(normR, 1.0);

    warped = mix(warped, sphereUV, mask);
  }

  vec3 color = applyColor(texture2D(uTexture, warped).rgb);

  if (uFilterMode > 0.5 && uFilterMode < 1.5) {
    float lum = luminance(color);
    float mask = step(0.52, lum);
    vec3 a = vec3(0.03, 0.03, 0.02);
    vec3 b = vec3(1.0, 0.82, 0.12);
    color = mix(a, b, mask);
  } else if (uFilterMode > 1.5 && uFilterMode < 2.5) {
    float lum = luminance(color);
    float mask = step(0.52, lum);
    vec3 a = vec3(0.04, 0.06, 0.18);
    vec3 b = vec3(0.92, 0.96, 1.0);
    color = mix(a, b, mask);
  } else if (uFilterMode > 2.5) {
    float edge = sobelEdge(warped);
    color = mix(color, vec3(0.0), edge * 0.3);
  }

  float magnify = step(0.5, uMagnifyEnabled);
  if (magnify > 0.5) {
    float zoom = max(uMagnifyZoom, 1.0);
    vec2 zoomUV = center + (warped - center) / zoom;

    vec2 p = vUV - 0.5;
    vec2 box = vec2(0.22);
    float radius = 0.06;
    vec2 q = abs(p) - box + radius;
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    float edge = 0.012;
    float mask = 1.0 - smoothstep(0.0, edge, dist);

    vec3 zoomColor = applyColor(texture2D(uTexture, zoomUV).rgb);
    color = mix(color, zoomColor, mask);
  }

  float cal = step(0.5, uCalibrate);
  if (cal > 0.5) {
    float px = 1.0 / max(1.0, min(uResolution.x, uResolution.y));
    float gridThickness = px * 6.0;
    float ringThickness = px * 1.6;

    vec2 gridUV = clamp(warped, 0.0, 1.0);
    float grid = max(
      lineMask(gridUV.x, 6.0, gridThickness),
      lineMask(gridUV.y, 6.0, gridThickness)
    );
    float crossX = 1.0 - smoothstep(0.0, gridThickness * 1, abs(vUV.x - 0.5));
    float crossY = 1.0 - smoothstep(0.0, gridThickness * 1, abs(vUV.y - 0.5));
    float cross = max(crossX, crossY);

    float r = length(vUV - 0.5);
    float ring1 = 1.0 - smoothstep(ringThickness, ringThickness * 3.0, abs(r - 0.25));
    float ring2 = 1.0 - smoothstep(ringThickness, ringThickness * 3.0, abs(r - 0.4));
    float ringScale = 0.45;

    float gridAlpha = grid * 0.8;
    vec3 gridColor = vec3(0.08, 0.92, 1.0);
    color = mix(color, gridColor, gridAlpha);

    float overlay = max(cross, max(ring1, ring2) * ringScale);
    vec3 overlayColor = mix(vec3(0.12, 1.0, 0.7), vec3(1.0, 0.7, 0.25), cross);
    color = mix(color, overlayColor, overlay * 0.45);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

export const vertexWebGL2 = `#version 300 es
in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;

void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const fragmentWebGL2 = `#version 300 es
precision mediump float;

in vec2 vUV;

uniform sampler2D uTexture;
uniform float uContrast;
uniform float uBrightness;
uniform float uGamma;
uniform float uHighlights;
uniform float uShadows;
uniform float uScale;
uniform vec2 uOffset;
uniform float uSeparation;
uniform float uEyeSign;
uniform float uVideoAspect;
uniform float uMagnifyEnabled;
uniform float uMagnifyZoom;
uniform float uSphereStrength;
uniform float uSphereRadius;
uniform float uK1;
uniform float uK2;
uniform float uDistortEnabled;
uniform float uCalibrate;
uniform vec2 uResolution;
uniform float uFilterMode;
uniform vec2 uTexel;

out vec4 outColor;

vec3 applyColor(vec3 color) {
  color = (color - 0.5) * uContrast + 0.5;
  color += uBrightness;
  color = clamp(color, 0.0, 1.0);
  color = pow(color, vec3(1.0 / max(uGamma, 0.001)));
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float shadowMask = 1.0 - smoothstep(0.2, 0.55, lum);
  float highlightMask = smoothstep(0.55, 0.9, lum);
  color += shadowMask * uShadows * 0.35;
  color += highlightMask * uHighlights * 0.35;
  return clamp(color, 0.0, 1.0);
}

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float sobelEdge(vec2 uv) {
  vec2 t = uTexel;
  float tl = luminance(texture(uTexture, uv + vec2(-t.x, -t.y)).rgb);
  float tc = luminance(texture(uTexture, uv + vec2(0.0, -t.y)).rgb);
  float tr = luminance(texture(uTexture, uv + vec2(t.x, -t.y)).rgb);
  float ml = luminance(texture(uTexture, uv + vec2(-t.x, 0.0)).rgb);
  float mr = luminance(texture(uTexture, uv + vec2(t.x, 0.0)).rgb);
  float bl = luminance(texture(uTexture, uv + vec2(-t.x, t.y)).rgb);
  float bc = luminance(texture(uTexture, uv + vec2(0.0, t.y)).rgb);
  float br = luminance(texture(uTexture, uv + vec2(t.x, t.y)).rgb);

  float gx = -tl + tr + -2.0 * ml + 2.0 * mr + -bl + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = sqrt(gx * gx + gy * gy);
  return step(0.6, edge);
}

vec2 applyDistortion(vec2 uv, vec2 center) {
  float enabled = step(0.5, uDistortEnabled);
  vec2 d = uv - center;
  float r2 = dot(d, d);
  float factor = 1.0 + uK1 * r2 + uK2 * r2 * r2;
  vec2 warped = center + d * factor;
  return mix(uv, warped, enabled);
}

float lineMask(float v, float count, float thickness) {
  float cell = abs(fract(v * count) - 0.5);
  return 1.0 - smoothstep(0.0, thickness, cell);
}

void main() {
  vec2 uv = vUV;
  if (uVideoAspect > 1.0) {
    uv.x = (uv.x - 0.5) / uVideoAspect + 0.5;
  } else {
    uv.y = (uv.y - 0.5) * uVideoAspect + 0.5;
  }

  uv = (uv - 0.5) / uScale + 0.5;
  vec2 eyeShift = vec2(uEyeSign * uSeparation, 0.0);
  uv += uOffset + eyeShift;

  vec2 center = vec2(0.5) + uOffset + eyeShift;
  vec2 warped = applyDistortion(uv, center);

  float sphereStrength = clamp(uSphereStrength, 0.0, 1.0);
  float sphereRadius = max(uSphereRadius, 0.00001);
  vec2 screenDelta = vUV - 0.5;
  float screenR = length(screenDelta);
  float normR = screenR / sphereRadius;
  if (sphereStrength > 0.001) {
    float clampedR = clamp(normR, 0.0, 1.0);
    float sphereNorm = asin(clampedR) / 1.57079632679;
    vec2 dir = screenR > 0.00001 ? screenDelta / screenR : vec2(0.0, 0.0);
    vec2 sphereDelta = dir * (sphereNorm * sphereRadius) / uScale;
    vec2 sphereUV = center + sphereDelta;
    float feather = mix(0.45, 0.0, sphereStrength);
    float mask = feather > 0.0001
      ? (1.0 - smoothstep(1.0 - feather, 1.0, normR))
      : step(normR, 1.0);

    warped = mix(warped, sphereUV, mask);
  }

  vec3 color = applyColor(texture(uTexture, warped).rgb);

  if (uFilterMode > 0.5 && uFilterMode < 1.5) {
    float lum = luminance(color);
    float mask = step(0.52, lum);
    vec3 a = vec3(0.03, 0.03, 0.02);
    vec3 b = vec3(1.0, 0.82, 0.12);
    color = mix(a, b, mask);
  } else if (uFilterMode > 1.5 && uFilterMode < 2.5) {
    float lum = luminance(color);
    float mask = step(0.52, lum);
    vec3 a = vec3(0.04, 0.06, 0.18);
    vec3 b = vec3(0.92, 0.96, 1.0);
    color = mix(a, b, mask);
  } else if (uFilterMode > 2.5) {
    float edge = sobelEdge(warped);
    color = mix(color, vec3(0.0), edge);
  }

  float magnify = step(0.5, uMagnifyEnabled);
  if (magnify > 0.5) {
    float zoom = max(uMagnifyZoom, 1.0);
    vec2 zoomUV = center + (warped - center) / zoom;

    vec2 p = vUV - 0.5;
    vec2 box = vec2(0.22);
    float radius = 0.06;
    vec2 q = abs(p) - box + radius;
    float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
    float edge = 0.012;
    float mask = 1.0 - smoothstep(0.0, edge, dist);

    vec3 zoomColor = applyColor(texture(uTexture, zoomUV).rgb);
    color = mix(color, zoomColor, mask);
  }

  float cal = step(0.5, uCalibrate);
  if (cal > 0.5) {
    float px = 1.0 / max(1.0, min(uResolution.x, uResolution.y));
    float gridThickness = px * 6.0;
    float ringThickness = px * 1.6;

    vec2 gridUV = clamp(warped, 0.0, 1.0);
    float grid = max(
      lineMask(gridUV.x, 6.0, gridThickness),
      lineMask(gridUV.y, 6.0, gridThickness)
    );
    float crossX = 1.0 - smoothstep(0.0, gridThickness * 1.4, abs(vUV.x - 0.5));
    float crossY = 1.0 - smoothstep(0.0, gridThickness * 1.4, abs(vUV.y - 0.5));
    float cross = max(crossX, crossY);

    float r = length(vUV - 0.5);
    float ring1 = 1.0 - smoothstep(ringThickness, ringThickness * 3.0, abs(r - 0.25));
    float ring2 = 1.0 - smoothstep(ringThickness, ringThickness * 3.0, abs(r - 0.4));
    float ringScale = 0.45;

    float gridAlpha = grid * 0.8;
    vec3 gridColor = vec3(0.08, 0.92, 1.0);
    color = mix(color, gridColor, gridAlpha);

    float overlay = max(cross, max(ring1, ring2) * ringScale);
    vec3 overlayColor = mix(vec3(0.12, 1.0, 0.7), vec3(1.0, 0.7, 0.25), cross);
    color = mix(color, overlayColor, overlay * 0.45);
  }

  outColor = vec4(color, 1.0);
}
`;
