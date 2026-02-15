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
uniform float uScale;
uniform vec2 uOffset;
uniform float uSeparation;
uniform float uEyeSign;
uniform float uVideoAspect;
uniform float uMagnifyEnabled;
uniform float uMagnifyZoom;
uniform float uK1;
uniform float uK2;
uniform float uDistortEnabled;
uniform float uCalibrate;
uniform vec2 uResolution;

vec3 applyColor(vec3 color) {
  color = (color - 0.5) * uContrast + 0.5;
  color += uBrightness;
  color = clamp(color, 0.0, 1.0);
  color = pow(color, vec3(1.0 / max(uGamma, 0.001)));
  return clamp(color, 0.0, 1.0);
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

  vec3 color = applyColor(texture2D(uTexture, warped).rgb);

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
    float thickness = px * 2.0;

    float grid = max(lineMask(vUV.x, 6.0, thickness), lineMask(vUV.y, 6.0, thickness));
    float crossX = 1.0 - smoothstep(0.0, thickness * 1.6, abs(vUV.x - 0.5));
    float crossY = 1.0 - smoothstep(0.0, thickness * 1.6, abs(vUV.y - 0.5));
    float cross = max(crossX, crossY);

    float r = length(vUV - 0.5);
    float ring1 = 1.0 - smoothstep(thickness, thickness * 3.0, abs(r - 0.25));
    float ring2 = 1.0 - smoothstep(thickness, thickness * 3.0, abs(r - 0.4));

    float overlay = max(grid, max(cross, max(ring1, ring2)));
    vec3 overlayColor = mix(vec3(0.12, 1.0, 0.7), vec3(1.0, 0.7, 0.25), cross);
    color = mix(color, overlayColor, overlay * 0.55);
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
uniform float uScale;
uniform vec2 uOffset;
uniform float uSeparation;
uniform float uEyeSign;
uniform float uVideoAspect;
uniform float uMagnifyEnabled;
uniform float uMagnifyZoom;
uniform float uK1;
uniform float uK2;
uniform float uDistortEnabled;
uniform float uCalibrate;
uniform vec2 uResolution;

out vec4 outColor;

vec3 applyColor(vec3 color) {
  color = (color - 0.5) * uContrast + 0.5;
  color += uBrightness;
  color = clamp(color, 0.0, 1.0);
  color = pow(color, vec3(1.0 / max(uGamma, 0.001)));
  return clamp(color, 0.0, 1.0);
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

  vec3 color = applyColor(texture(uTexture, warped).rgb);

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
    float thickness = px * 2.0;

    float grid = max(lineMask(vUV.x, 6.0, thickness), lineMask(vUV.y, 6.0, thickness));
    float crossX = 1.0 - smoothstep(0.0, thickness * 1.6, abs(vUV.x - 0.5));
    float crossY = 1.0 - smoothstep(0.0, thickness * 1.6, abs(vUV.y - 0.5));
    float cross = max(crossX, crossY);

    float r = length(vUV - 0.5);
    float ring1 = 1.0 - smoothstep(thickness, thickness * 3.0, abs(r - 0.25));
    float ring2 = 1.0 - smoothstep(thickness, thickness * 3.0, abs(r - 0.4));

    float overlay = max(grid, max(cross, max(ring1, ring2)));
    vec3 overlayColor = mix(vec3(0.12, 1.0, 0.7), vec3(1.0, 0.7, 0.25), cross);
    color = mix(color, overlayColor, overlay * 0.55);
  }

  outColor = vec4(color, 1.0);
}
`;
