import type { VRSettings } from "../types";
import {
  fragmentWebGL1,
  fragmentWebGL2,
  vertexWebGL1,
  vertexWebGL2
} from "./shaders";

type GLContext = WebGLRenderingContext | WebGL2RenderingContext;

type UniformLocations = {
  texture: WebGLUniformLocation | null;
  contrast: WebGLUniformLocation | null;
  brightness: WebGLUniformLocation | null;
  gamma: WebGLUniformLocation | null;
  highlights: WebGLUniformLocation | null;
  shadows: WebGLUniformLocation | null;
  temperature: WebGLUniformLocation | null;
  scale: WebGLUniformLocation | null;
  offset: WebGLUniformLocation | null;
  separation: WebGLUniformLocation | null;
  eyeSign: WebGLUniformLocation | null;
  videoAspect: WebGLUniformLocation | null;
  magnifyEnabled: WebGLUniformLocation | null;
  magnifyZoom: WebGLUniformLocation | null;
  magnifySize: WebGLUniformLocation | null;
  sphereStrength: WebGLUniformLocation | null;
  sphereRadius: WebGLUniformLocation | null;
  filterMode: WebGLUniformLocation | null;
  texel: WebGLUniformLocation | null;
  k1: WebGLUniformLocation | null;
  k2: WebGLUniformLocation | null;
  distortEnabled: WebGLUniformLocation | null;
  calibrate: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
};

type AttributeLocations = {
  position: number;
  uv: number;
};

export class GLRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly video: HTMLVideoElement;
  private readonly gl: GLContext;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly buffer: WebGLBuffer;
  private readonly attributes: AttributeLocations;
  private readonly uniforms: UniformLocations;
  private readonly isWebGL2: boolean;
  private rafId = 0;
  private readonly getSettings: () => VRSettings;

  constructor(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    getSettings: () => VRSettings
  ) {
    this.canvas = canvas;
    this.video = video;
    this.getSettings = getSettings;

    const gl2 = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false
    });
    const gl1 = gl2
      ? null
      : canvas.getContext("webgl", {
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: false
        });

    if (!gl2 && !gl1) {
      throw new Error("WebGL is not supported on this device.");
    }

    this.gl = (gl2 ?? gl1) as GLContext;
    this.isWebGL2 = Boolean(gl2);

    this.program = this.createProgram(
      this.isWebGL2 ? vertexWebGL2 : vertexWebGL1,
      this.isWebGL2 ? fragmentWebGL2 : fragmentWebGL1
    );

    this.attributes = {
      position: this.gl.getAttribLocation(this.program, "aPosition"),
      uv: this.gl.getAttribLocation(this.program, "aUV")
    };

    this.uniforms = {
      texture: this.gl.getUniformLocation(this.program, "uTexture"),
      contrast: this.gl.getUniformLocation(this.program, "uContrast"),
      brightness: this.gl.getUniformLocation(this.program, "uBrightness"),
      gamma: this.gl.getUniformLocation(this.program, "uGamma"),
      highlights: this.gl.getUniformLocation(this.program, "uHighlights"),
      shadows: this.gl.getUniformLocation(this.program, "uShadows"),
      temperature: this.gl.getUniformLocation(this.program, "uTemperature"),
      scale: this.gl.getUniformLocation(this.program, "uScale"),
      offset: this.gl.getUniformLocation(this.program, "uOffset"),
      separation: this.gl.getUniformLocation(this.program, "uSeparation"),
      eyeSign: this.gl.getUniformLocation(this.program, "uEyeSign"),
      videoAspect: this.gl.getUniformLocation(this.program, "uVideoAspect"),
      magnifyEnabled: this.gl.getUniformLocation(this.program, "uMagnifyEnabled"),
      magnifyZoom: this.gl.getUniformLocation(this.program, "uMagnifyZoom"),
      magnifySize: this.gl.getUniformLocation(this.program, "uMagnifySize"),
      sphereStrength: this.gl.getUniformLocation(this.program, "uSphereStrength"),
      sphereRadius: this.gl.getUniformLocation(this.program, "uSphereRadius"),
      filterMode: this.gl.getUniformLocation(this.program, "uFilterMode"),
      texel: this.gl.getUniformLocation(this.program, "uTexel"),
      k1: this.gl.getUniformLocation(this.program, "uK1"),
      k2: this.gl.getUniformLocation(this.program, "uK2"),
      distortEnabled: this.gl.getUniformLocation(this.program, "uDistortEnabled"),
      calibrate: this.gl.getUniformLocation(this.program, "uCalibrate"),
      resolution: this.gl.getUniformLocation(this.program, "uResolution")
    };

    const buffer = this.gl.createBuffer();
    const texture = this.gl.createTexture();
    if (!buffer || !texture) {
      throw new Error("Failed to allocate WebGL resources.");
    }

    this.buffer = buffer;
    this.texture = texture;

    this.initBuffers();
    this.initTexture();

    this.gl.useProgram(this.program);
    if (this.uniforms.texture) {
      this.gl.uniform1i(this.uniforms.texture, 0);
    }

    this.gl.clearColor(0, 0, 0, 1);
  }

  start() {
    if (this.rafId) {
      return;
    }
    this.render();
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private initBuffers() {
    const vertices = new Float32Array([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1,
      1, 1, 1, 1
    ]);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;

    if (this.attributes.position >= 0) {
      this.gl.enableVertexAttribArray(this.attributes.position);
      this.gl.vertexAttribPointer(
        this.attributes.position,
        2,
        this.gl.FLOAT,
        false,
        stride,
        0
      );
    }

    if (this.attributes.uv >= 0) {
      this.gl.enableVertexAttribArray(this.attributes.uv);
      this.gl.vertexAttribPointer(
        this.attributes.uv,
        2,
        this.gl.FLOAT,
        false,
        stride,
        2 * Float32Array.BYTES_PER_ELEMENT
      );
    }
  }

  private initTexture() {
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    const placeholder = new Uint8Array([0, 0, 0, 255]);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      1,
      1,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      placeholder
    );
  }

  private createShader(type: number, source: string) {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error("Failed to create shader.");
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader) ?? "Unknown shader error.";
      this.gl.deleteShader(shader);
      throw new Error(info);
    }

    return shader;
  }

  private createProgram(vertexSource: string, fragmentSource: string) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error("Failed to create program.");
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program) ?? "Unknown program error.";
      this.gl.deleteProgram(program);
      throw new Error(info);
    }

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }

  private resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const displayHeight = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
  }

  private updateVideoTexture() {
    if (this.video.readyState < this.video.HAVE_CURRENT_DATA) {
      return;
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      this.video
    );
  }

  private setUniform1f(location: WebGLUniformLocation | null, value: number) {
    if (location) {
      this.gl.uniform1f(location, value);
    }
  }

  private setUniform2f(location: WebGLUniformLocation | null, x: number, y: number) {
    if (location) {
      this.gl.uniform2f(location, x, y);
    }
  }

  private drawEye(
    eyeSign: number,
    viewportX: number,
    viewportY: number,
    viewportWidth: number,
    viewportHeight: number,
    offsetX: number,
    offsetY: number,
    videoAspect: number,
    settings: VRSettings
  ) {
    this.gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);

    this.setUniform1f(this.uniforms.contrast, settings.contrast);
    this.setUniform1f(this.uniforms.brightness, settings.brightness);
    this.setUniform1f(this.uniforms.gamma, settings.gamma);
    this.setUniform1f(this.uniforms.highlights, settings.highlights);
    this.setUniform1f(this.uniforms.shadows, settings.shadows);
    this.setUniform1f(this.uniforms.temperature, settings.temperature);
    this.setUniform1f(this.uniforms.scale, settings.scale);
    this.setUniform2f(this.uniforms.offset, offsetX, offsetY);
    this.setUniform1f(this.uniforms.separation, settings.separation);
    this.setUniform1f(this.uniforms.eyeSign, eyeSign);
    this.setUniform1f(this.uniforms.videoAspect, videoAspect);
    this.setUniform1f(
      this.uniforms.magnifyEnabled,
      settings.magnifierEnabled ? 1 : 0
    );
    this.setUniform1f(this.uniforms.magnifyZoom, settings.magnifierZoom);
    this.setUniform1f(this.uniforms.magnifySize, settings.magnifierSize);
    this.setUniform1f(this.uniforms.sphereStrength, settings.sphereStrength / 100);
    const sphereRadius = 0.5 * (settings.sphereDiameter / 100);
    this.setUniform1f(this.uniforms.sphereRadius, sphereRadius);
    const filterIndex =
      settings.filterMode === "amber"
        ? 1
        : settings.filterMode === "deepblue"
          ? 2
          : settings.filterMode === "edge"
            ? 3
            : 0;
    this.setUniform1f(this.uniforms.filterMode, filterIndex);
    const distortionScale = 0.1;
    this.setUniform1f(this.uniforms.k1, settings.k1 * distortionScale);
    this.setUniform1f(this.uniforms.k2, settings.k2 * distortionScale);
    this.setUniform1f(this.uniforms.distortEnabled, settings.distortionEnabled ? 1 : 0);
    this.setUniform1f(this.uniforms.calibrate, settings.calibration ? 1 : 0);
    this.setUniform2f(this.uniforms.resolution, viewportWidth, viewportHeight);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private render = () => {
    this.resizeCanvas();
    this.gl.useProgram(this.program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);

    if (this.attributes.position >= 0) {
      this.gl.enableVertexAttribArray(this.attributes.position);
      this.gl.vertexAttribPointer(
        this.attributes.position,
        2,
        this.gl.FLOAT,
        false,
        4 * Float32Array.BYTES_PER_ELEMENT,
        0
      );
    }

    if (this.attributes.uv >= 0) {
      this.gl.enableVertexAttribArray(this.attributes.uv);
      this.gl.vertexAttribPointer(
        this.attributes.uv,
        2,
        this.gl.FLOAT,
        false,
        4 * Float32Array.BYTES_PER_ELEMENT,
        2 * Float32Array.BYTES_PER_ELEMENT
      );
    }

    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.updateVideoTexture();

    const width = this.canvas.width;
    const height = this.canvas.height;
    const squareSize = Math.min(height, Math.floor(width / 2));
    const totalWidth = squareSize * 2;
    const offsetX = Math.max(0, Math.floor((width - totalWidth) / 2));
    const offsetY = Math.max(0, Math.floor((height - squareSize) / 2));

    const settings = this.getSettings();
    const videoWidth = this.video.videoWidth || 1;
    const videoHeight = this.video.videoHeight || 1;
    const videoAspect = videoWidth / videoHeight;
    this.setUniform2f(this.uniforms.texel, 1 / videoWidth, 1 / videoHeight);

    this.drawEye(
      -1,
      offsetX,
      offsetY,
      squareSize,
      squareSize,
      settings.leftOffsetX,
      settings.leftOffsetY,
      videoAspect,
      settings
    );
    this.drawEye(
      1,
      offsetX + squareSize,
      offsetY,
      squareSize,
      squareSize,
      settings.rightOffsetX,
      settings.rightOffsetY,
      videoAspect,
      settings
    );

    this.rafId = requestAnimationFrame(this.render);
  };
}
