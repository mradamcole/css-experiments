const canvas = document.getElementById("energy-canvas");
const fallbackMessage = document.querySelector("[data-fallback]");
const controlsPanel = document.querySelector("[data-controls-panel]");
const controlsList = document.querySelector("[data-controls-list]");
const controlStatus = document.querySelector("[data-control-status]");

const STORAGE_KEY = "electric-orb-webgl-tuner-params-v1";

const DEFAULT_PARAMS = {
  renderer: {
    maxDpr: 1.85, // Max device pixel ratio for rendering quality/perf balance. Default: 1.85.
    maxTrailPoints: 20, // Number of sampled trail points behind the orb. Default: 20.
    powerPreference: "high-performance", // WebGL power hint passed to the browser. Default: "high-performance".
  },
  orb: {
    radius: 0.0075, // Base orb size in shader scene units. Default: 0.036.
    motionRadiusBoost: 0.004, // Extra orb size added at high motion. Default: 0.018.
    glowRadius: 2.5, // Main glow falloff radius around the orb. Default: 12.
    wideGlowRadius: 8, // Outer atmospheric halo radius multiplier. Default: 46.
    distantGlowRadius: 0.04, // Soft ambient glow spread around the orb. Default: 0.26.
    distantGlowIntensity: 0.018, // Brightness of the soft ambient glow. Default: 0.18.
    outerGlowIntensity: 0.022, // Brightness of the main bloom around the orb. Default: 0.22.
    wideGlowIntensity: 0.006, // Brightness of the widest halo around the orb. Default: 0.08.
    wideGlowVioletIntensity: 0.002, // Brightness of the violet tint in the outer halo. Default: 0.025.
    plasmaShellIntensity: 0.16, // Brightness of the main cyan body around the core. Default: 0.4.
    hotShellIntensity: 0.07, // Brightness of the hotter shell wrapped around the orb. Default: 0.2.
    coronaIntensity: 0.09, // Brightness of the main electric corona arcs. Default: 0.28.
    coronaVioletIntensity: 0.035, // Brightness of the violet corona tint. Default: 0.12.
    arcIntensity: 0.09, // Brightness of sharp electric ripple lines on the rim. Default: 0.34.
    coreIntensity: 0.58, // Brightness of the white-hot orb core. Default: 1.0.
    highlightIntensity: 0.08, // Brightness of the glossy highlight on the orb. Default: 0.3.
    vaporIntensity: 0.015, // Brightness of the faint vapor ring around the orb. Default: 0.08.
  },
  motion: {
    speedNormalization: 1400, // Speed value that maps to "full motion" in the shader. Default: 1400.
    visualSpeedClamp: 1800, // Caps extreme mouse-speed spikes before visual effects react. Default: 1800.
    velocitySmoothing: 8, // Smoothing strength for raw pointer velocity. Default: 8.
    velocitySmoothingMin: 0.08, // Minimum blend amount for pointer velocity smoothing. Default: 0.08.
    velocitySmoothingMax: 0.22, // Maximum blend amount for pointer velocity smoothing. Default: 0.22.
    visualMotionSmoothing: 7, // Smoothing strength for the glow/tail motion response. Default: 7.
    visualMotionSmoothingMin: 0.08, // Minimum blend amount for visual motion smoothing. Default: 0.08.
    visualMotionSmoothingMax: 0.2, // Maximum blend amount for visual motion smoothing. Default: 0.2.
  },
  idle: {
    xFrequency: 0.72, // Horizontal idle drift speed when the pointer leaves. Default: 0.72.
    yFrequency: 0.96, // Vertical idle drift speed when the pointer leaves. Default: 0.96.
    xAmplitude: 0.08, // Horizontal idle drift distance as a fraction of viewport width. Default: 0.08.
    yAmplitude: 0.06, // Vertical idle drift distance as a fraction of viewport height. Default: 0.06.
  },
  follow: {
    stiffness: 20, // Spring pull strength during idle follow behavior. Default: 20.
    damping: 8.6, // Spring damping during idle follow behavior. Default: 8.6.
  },
  trail: {
    headResponseBase: 0.31, // Base amount the front of the tail chases the orb each frame. Default: 0.31.
    headResponseMotionBoost: 0.16, // Extra head response added as motion increases. Default: 0.16.
    headResponseDtScale: 8.5, // Frame-rate compensation for head response. Default: 8.5.
    headResponseMin: 0.16, // Minimum allowed head response. Default: 0.16.
    headResponseMax: 0.54, // Maximum allowed head response. Default: 0.54.
    segmentDelayBase: 0.18, // Base follow amount for each later trail segment. Default: 0.18.
    segmentDelayIndexFalloff: 0.0045, // How much each farther segment lags more than the previous one. Default: 0.0045.
    segmentDelayMotionBoost: 0.05, // Extra trail catch-up added at higher motion. Default: 0.05.
    segmentDelayDtScale: 6.4, // Frame-rate compensation for segment follow. Default: 6.4.
    segmentDelayMin: 0.048, // Minimum allowed follow amount for trail segments. Default: 0.048.
    segmentDelayMax: 0.28, // Maximum allowed follow amount for trail segments. Default: 0.28.
    motionScale: 950, // Speed scale used to convert motion into trail intensity. Default: 950.
    widthMin: 0.004, // Minimum trail ribbon width in shader scene units. Default: 0.004.
    widthMax: 0.098, // Maximum trail ribbon width in shader scene units. Default: 0.098.
    idleVisibility: 0.08, // Minimum trail visibility when the orb is barely moving. Default: 0.08.
    pointRadiusMin: 0.004, // Minimum radius of trail glow points in shader scene units. Default: 0.004.
    pointRadiusMax: 0.02, // Maximum radius of trail glow points in shader scene units. Default: 0.02.
  },
};

const PARAMS = cloneParams(DEFAULT_PARAMS);

const TUNER_SECTIONS = [
  {
    title: "Orb Size And Halo",
    fields: [
      { path: "orb.radius", label: "Orb radius", min: 0.002, max: 0.04, step: 0.0005 },
      { path: "orb.motionRadiusBoost", label: "Motion size boost", min: 0.0, max: 0.03, step: 0.0005 },
      { path: "orb.glowRadius", label: "Main glow radius", min: 0.25, max: 16, step: 0.05 },
      { path: "orb.wideGlowRadius", label: "Wide glow radius", min: 0.5, max: 60, step: 0.1 },
      { path: "orb.distantGlowRadius", label: "Ambient glow radius", min: 0.001, max: 0.3, step: 0.001 },
      { path: "orb.distantGlowIntensity", label: "Ambient glow brightness", min: 0.0, max: 0.25, step: 0.001 },
      { path: "orb.outerGlowIntensity", label: "Main bloom brightness", min: 0.0, max: 0.35, step: 0.001 },
      { path: "orb.wideGlowIntensity", label: "Wide halo brightness", min: 0.0, max: 0.16, step: 0.001 },
      { path: "orb.wideGlowVioletIntensity", label: "Wide halo violet", min: 0.0, max: 0.08, step: 0.001 },
      { path: "orb.plasmaShellIntensity", label: "Plasma shell brightness", min: 0.0, max: 0.6, step: 0.001 },
      { path: "orb.hotShellIntensity", label: "Hot shell brightness", min: 0.0, max: 0.35, step: 0.001 },
      { path: "orb.coronaIntensity", label: "Corona brightness", min: 0.0, max: 0.45, step: 0.001 },
      { path: "orb.coronaVioletIntensity", label: "Corona violet", min: 0.0, max: 0.2, step: 0.001 },
      { path: "orb.arcIntensity", label: "Arc brightness", min: 0.0, max: 0.45, step: 0.001 },
      { path: "orb.coreIntensity", label: "Core brightness", min: 0.0, max: 1.4, step: 0.001 },
      { path: "orb.highlightIntensity", label: "Highlight brightness", min: 0.0, max: 0.5, step: 0.001 },
      { path: "orb.vaporIntensity", label: "Vapor ring brightness", min: 0.0, max: 0.2, step: 0.001 },
    ],
  },
  {
    title: "Trail Values",
    fields: [
      { path: "trail.widthMin", label: "Trail width min", min: 0.001, max: 0.02, step: 0.0005 },
      { path: "trail.widthMax", label: "Trail width max", min: 0.01, max: 0.2, step: 0.001 },
      { path: "trail.idleVisibility", label: "Trail idle visibility", min: 0.0, max: 0.35, step: 0.001 },
      { path: "trail.pointRadiusMin", label: "Trail point radius min", min: 0.001, max: 0.02, step: 0.0005 },
      { path: "trail.pointRadiusMax", label: "Trail point radius max", min: 0.005, max: 0.06, step: 0.001 },
    ],
  },
];

loadSavedParams();

const gl = canvas.getContext("webgl", {
  alpha: false,
  antialias: true,
  depth: false,
  stencil: false,
  powerPreference: PARAMS.renderer.powerPreference,
  premultipliedAlpha: false,
});

if (!gl) {
  fallbackMessage.hidden = false;
  throw new Error("WebGL is not available in this browser.");
}

const MAX_TRAIL_POINTS = PARAMS.renderer.maxTrailPoints;
const FLOATS_PER_POINT = 4;

function parseCssColorToVec3(colorValue, fallback) {
  const value = colorValue.trim();

  if (value.startsWith("#")) {
    let hex = value.slice(1);

    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((digit) => digit + digit)
        .join("");
    }

    if (hex.length === 6) {
      const intValue = Number.parseInt(hex, 16);

      if (Number.isFinite(intValue)) {
        return new Float32Array([
          ((intValue >> 16) & 255) / 255,
          ((intValue >> 8) & 255) / 255,
          (intValue & 255) / 255,
        ]);
      }
    }
  }

  const match = value.match(/rgba?\(([^)]+)\)/i);

  if (match) {
    const [red = "0", green = "0", blue = "0"] = match[1]
      .split(/[,\s/]+/)
      .filter(Boolean);

    return new Float32Array([
      clamp(Number.parseFloat(red), 0, 255) / 255,
      clamp(Number.parseFloat(green), 0, 255) / 255,
      clamp(Number.parseFloat(blue), 0, 255) / 255,
    ]);
  }

  return fallback;
}

function readBackgroundColors() {
  const styles = window.getComputedStyle(document.documentElement);

  return {
    top: parseCssColorToVec3(styles.getPropertyValue("--bg-top"), new Float32Array([0.007, 0.011, 0.03])),
    bottom: parseCssColorToVec3(styles.getPropertyValue("--bg-bottom"), new Float32Array([0.02, 0.01, 0.055])),
  };
}

const vertexShaderSource = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function createFragmentShaderSource(params) {
  return `
precision highp float;

const int MAX_TRAIL = ${MAX_TRAIL_POINTS};

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uOrb;
uniform vec2 uVelocity;
uniform float uSpeed;
uniform vec4 uTrail[MAX_TRAIL];
uniform vec3 uBgTop;
uniform vec3 uBgBottom;

varying vec2 vUv;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 78.233);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 basis = mat2(1.6, 1.2, -1.2, 1.6);

  for (int i = 0; i < 5; i += 1) {
    value += amplitude * noise(p);
    p = basis * p;
    amplitude *= 0.5;
  }

  return value;
}

float falloff(float distanceValue, float inner, float outer) {
  return 1.0 - smoothstep(inner, outer, distanceValue);
}

vec2 toScene(vec2 pixelPoint) {
  return (pixelPoint - 0.5 * uResolution.xy) / uResolution.y;
}

float segmentProjection(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float denominator = max(dot(ba, ba), 0.00001);
  return clamp(dot(p - a, ba) / denominator, 0.0, 1.0);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float denominator = max(dot(ba, ba), 0.00001);
  float h = clamp(dot(pa, ba) / denominator, 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 scene = toScene(frag);
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 centeredUv = vUv - 0.5;

  vec3 color = mix(uBgTop, uBgBottom, vUv.y);

  float fieldNoise = fbm(scene * 4.5 + vec2(0.0, uTime * 0.025));
  float aurora = fbm(vec2(scene.x * 3.8, scene.y * 2.1 + uTime * 0.06));
  color += vec3(0.004, 0.01, 0.02) * fieldNoise;
  color += vec3(0.004, 0.008, 0.02) * aurora * 0.65;

  float starLayerA = pow(saturate(noise(frag * 0.02 + 14.0) - 0.84), 7.0);
  float starLayerB = pow(saturate(noise(frag * 0.038 + 91.0) - 0.885), 10.0);
  color += vec3(0.08, 0.14, 0.24) * starLayerA * 0.35;
  color += vec3(0.25, 0.45, 0.8) * starLayerB * 0.18;

  vec2 orbScene = toScene(uOrb);
  vec2 velocityScene = uVelocity / uResolution.y;
  float speedNorm = saturate(uSpeed / ${params.motion.speedNormalization.toFixed(4)});
  vec2 direction = normalize(velocityScene + vec2(0.0001, 0.0));
  vec2 tangent = vec2(-direction.y, direction.x);
  vec2 relative = scene - orbScene;

  float distantGlow = exp(-dot(relative, relative) / ${params.orb.distantGlowRadius.toFixed(4)});
  color += vec3(0.007, 0.016, 0.038) * distantGlow * ${params.orb.distantGlowIntensity.toFixed(4)};

  vec3 tailColor = vec3(0.0);
  float tailMist = 0.0;
  float tailVisibility = mix(${params.trail.idleVisibility.toFixed(4)}, 1.0, speedNorm);

  for (int i = 1; i < MAX_TRAIL; i += 1) {
    vec4 tailPoint = uTrail[i];
    vec4 headPoint = uTrail[i - 1];
    float active = step(0.001, tailPoint.z * headPoint.z);

    vec2 a = toScene(tailPoint.xy);
    vec2 b = toScene(headPoint.xy);
    float age = tailPoint.w;
    float freshness = 1.0 - age;
    float projection = segmentProjection(scene, a, b);
    float distanceToSegment = sdSegment(scene, a, b);

    float segmentNoise = fbm(
      scene * mix(8.0, 18.0, freshness) +
      vec2(age * 16.0, -uTime * 0.8 - age * 13.0)
    );

    float width = mix(${params.trail.widthMin.toFixed(4)}, ${params.trail.widthMax.toFixed(4)}, pow(freshness, 1.1));
    width *= mix(0.88, 1.22, segmentNoise);
    width *= mix(0.8, 1.32, speedNorm);

    float density = mix(0.32, 1.28, freshness);
    density *= mix(0.88, 1.1, projection);

    float plume = exp(-(distanceToSegment * distanceToSegment) / max(width * width, 0.00001));
    float innerThread = falloff(
      distanceToSegment + (segmentNoise - 0.5) * width * 0.45,
      0.0,
      width * 0.48
    );
    float edgeSpark = falloff(abs(distanceToSegment - width * (0.28 + segmentNoise * 0.3)), 0.0, width * 0.18);
    float breakup = mix(0.72, 1.18, segmentNoise);
    float segmentEnergy = active * density * breakup * tailVisibility;

    tailColor += vec3(0.028, 0.09, 0.23) * plume * segmentEnergy * 0.85;
    tailColor += vec3(0.05, 0.32, 0.85) * plume * segmentEnergy * 0.95;
    tailColor += vec3(0.12, 0.46, 1.05) * plume * segmentEnergy * pow(freshness, 1.55) * 0.38;
    tailColor += vec3(0.15, 0.82, 1.55) * innerThread * segmentEnergy * mix(0.26, 1.15, freshness);
    tailColor += vec3(0.85, 0.96, 1.45) * edgeSpark * segmentEnergy * freshness * 0.22;
    tailMist += plume * segmentEnergy;
  }

  for (int i = 0; i < MAX_TRAIL; i += 1) {
    vec4 point = uTrail[i];
    float active = step(0.001, point.z);
    float age = point.w;
    float freshness = 1.0 - age;
    vec2 pointScene = toScene(point.xy);
    float pointDistance = length(scene - pointScene);
    float pointRadius = mix(${params.trail.pointRadiusMin.toFixed(4)}, ${params.trail.pointRadiusMax.toFixed(4)}, freshness);
    float pointGlow = exp(-(pointDistance * pointDistance) / max(pointRadius * pointRadius, 0.00001));

    tailColor += vec3(0.02, 0.08, 0.2) * pointGlow * active * tailVisibility * 0.4;
    tailColor += vec3(0.05, 0.23, 0.68) * pointGlow * active * freshness * tailVisibility * 0.42;
  }

  vec2 stretched = vec2(
    dot(relative, direction) / mix(1.0, 1.36, speedNorm),
    dot(relative, tangent) / mix(1.0, 0.84, speedNorm)
  );

  float radius = mix(${params.orb.radius.toFixed(4)}, ${(params.orb.radius + params.orb.motionRadiusBoost).toFixed(4)}, speedNorm);
  float plasmaNoise = fbm(stretched * 12.5 + direction * (uTime * 1.4) + vec2(0.0, -uTime * 0.32));
  float shellNoise = fbm(stretched * 21.0 - direction * (uTime * 1.8) + tangent * uTime * 0.9);
  float surfaceNoise = mix(plasmaNoise, shellNoise, 0.55);
  float shellDistortion = (surfaceNoise - 0.5) * radius * 0.42;

  float radialDistance = length(stretched);
  float core = falloff(radialDistance, radius * 0.02, radius * 0.62);
  float plasmaShell = falloff(radialDistance - shellDistortion * 0.2, radius * 0.12, radius * 1.14 + shellDistortion);
  float hotShell = falloff(abs(radialDistance - radius * (0.78 + shellDistortion * 1.1)), 0.0, radius * 0.36);
  float outerBloom = exp(-(radialDistance * radialDistance) / max(radius * radius * ${params.orb.glowRadius.toFixed(4)}, 0.000001));
  float wideBloom = exp(-(radialDistance * radialDistance) / max(radius * radius * ${params.orb.wideGlowRadius.toFixed(4)}, 0.000001));

  float angle = atan(stretched.y, stretched.x);
  float arcPattern = sin(angle * 9.0 - uTime * 7.8 + shellNoise * 8.0) * 0.5 + 0.5;
  float coronaBand = abs(radialDistance - radius * (1.02 + (surfaceNoise - 0.5) * 0.75));
  float corona = falloff(coronaBand, 0.0, radius * 0.26) * pow(arcPattern, 2.0);

  float electricRipples = sin((dot(stretched, direction) * 78.0) - uTime * 16.0 + plasmaNoise * 10.0) * 0.5 + 0.5;
  float electricRim = falloff(abs(radialDistance - radius * (0.92 + shellNoise * 0.08)), 0.0, radius * 0.14);
  float arcs = electricRim * pow(electricRipples, 4.0) * mix(0.55, 1.0, speedNorm);

  vec2 highlightOffset = vec2(-0.32, -0.28) * radius;
  float highlight = exp(-dot(stretched - highlightOffset, stretched - highlightOffset) / max(radius * radius * 0.24, 0.00001));

  vec3 orbColor = vec3(0.0);
  orbColor += vec3(0.04, 0.13, 0.32) * wideBloom * ${params.orb.wideGlowIntensity.toFixed(4)};
  orbColor += vec3(0.16, 0.14, 0.52) * wideBloom * ${params.orb.wideGlowVioletIntensity.toFixed(4)};
  orbColor += vec3(0.07, 0.24, 0.58) * outerBloom * ${params.orb.outerGlowIntensity.toFixed(4)};
  orbColor += vec3(0.14, 0.58, 1.05) * plasmaShell * ${params.orb.plasmaShellIntensity.toFixed(4)};
  orbColor += vec3(0.55, 0.8, 1.4) * hotShell * ${params.orb.hotShellIntensity.toFixed(4)};
  orbColor += vec3(0.24, 0.2, 0.9) * corona * ${params.orb.coronaVioletIntensity.toFixed(4)};
  orbColor += vec3(0.7, 0.92, 1.5) * corona * ${params.orb.coronaIntensity.toFixed(4)};
  orbColor += vec3(0.9, 0.97, 1.35) * arcs * ${params.orb.arcIntensity.toFixed(4)};
  orbColor += vec3(0.95, 1.0, 1.0) * core * ${params.orb.coreIntensity.toFixed(4)};
  orbColor += vec3(1.2, 1.24, 1.3) * highlight * ${params.orb.highlightIntensity.toFixed(4)};

  float vaporBand = falloff(abs(radialDistance - radius * (1.34 + plasmaNoise * 0.22)), 0.0, radius * 0.5);
  orbColor += vec3(0.18, 0.32, 0.8) * vaporBand * ${params.orb.vaporIntensity.toFixed(4)};

  color += tailColor;
  color += orbColor;
  color += vec3(0.012, 0.036, 0.08) * tailMist;

  float vignette = 1.0 - smoothstep(0.18, 0.95, length(centeredUv * vec2(aspect, 1.0)));
  color *= mix(0.6, 1.0, vignette);

  color = 1.0 - exp(-color);
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}
`;
}

function createShader(context, type, source) {
  const shader = context.createShader(type);
  context.shaderSource(shader, source);
  context.compileShader(shader);

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const info = context.getShaderInfoLog(shader);
    context.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${info}`);
  }

  return shader;
}

function createProgram(context, vertexSource, fragmentSource) {
  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentSource);
  const program = context.createProgram();

  context.attachShader(program, vertexShader);
  context.attachShader(program, fragmentShader);
  context.linkProgram(program);

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    const info = context.getProgramInfoLog(program);
    context.deleteProgram(program);
    context.deleteShader(vertexShader);
    context.deleteShader(fragmentShader);
    throw new Error(`Program link failed: ${info}`);
  }

  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);

  return program;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

function easeInOutSine(value) {
  return -(Math.cos(Math.PI * value) - 1) * 0.5;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function cloneParams(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeKnown(target, source) {
  Object.keys(source).forEach((key) => {
    if (!(key in target)) {
      return;
    }

    const nextValue = source[key];
    const currentValue = target[key];

    if (
      nextValue &&
      typeof nextValue === "object" &&
      !Array.isArray(nextValue) &&
      currentValue &&
      typeof currentValue === "object" &&
      !Array.isArray(currentValue)
    ) {
      mergeKnown(currentValue, nextValue);
      return;
    }

    if (typeof currentValue === "number" && typeof nextValue === "number") {
      target[key] = nextValue;
    } else if (typeof currentValue === "string" && typeof nextValue === "string") {
      target[key] = nextValue;
    }
  });
}

function getValueByPath(root, path) {
  return path.split(".").reduce((value, part) => value[part], root);
}

function setValueByPath(root, path, nextValue) {
  const parts = path.split(".");
  const finalKey = parts.pop();
  const parent = parts.reduce((value, part) => value[part], root);
  parent[finalKey] = nextValue;
}

function formatValue(value, step) {
  const decimals = Math.max(0, (String(step).split(".")[1] || "").length);
  return Number(value).toFixed(Math.min(decimals, 4));
}

function loadSavedParams() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return;
    }

    mergeKnown(PARAMS, JSON.parse(saved));
  } catch {
    // Ignore bad or unavailable persisted values.
  }
}

function persistParams() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(PARAMS));
  } catch {
    // Ignore storage failures.
  }
}

let program = null;
let uniforms = null;
let positionLocation = null;
let rebuildHandle = 0;
const backgroundColors = readBackgroundColors();

function rebuildProgram() {
  const nextProgram = createProgram(gl, vertexShaderSource, createFragmentShaderSource(PARAMS));

  if (program) {
    gl.deleteProgram(program);
  }

  program = nextProgram;
  uniforms = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    orb: gl.getUniformLocation(program, "uOrb"),
    velocity: gl.getUniformLocation(program, "uVelocity"),
    speed: gl.getUniformLocation(program, "uSpeed"),
    trail: gl.getUniformLocation(program, "uTrail[0]"),
    bgTop: gl.getUniformLocation(program, "uBgTop"),
    bgBottom: gl.getUniformLocation(program, "uBgBottom"),
  };
  positionLocation = gl.getAttribLocation(program, "aPosition");
}

function scheduleRebuild() {
  if (rebuildHandle) {
    return;
  }

  rebuildHandle = window.requestAnimationFrame(() => {
    rebuildHandle = 0;
    rebuildProgram();
    setStatus("Shader rebuilt with current slider values.");
  });
}

const quadBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
  ]),
  gl.STATIC_DRAW
);

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  time: 0,
  lastTime: 0,
  pointer: {
    active: false,
    x: 0,
    y: 0,
  },
  orb: {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  },
  visualMotion: {
    vx: 0,
    vy: 0,
    speed: 0,
  },
  demo: {
    active: false,
    phase: "idle",
    timer: 0,
    duration: 0,
    fromX: 0,
    fromY: 0,
    targetX: 0,
    targetY: 0,
  },
  trail: [],
};

const trailUniformData = new Float32Array(MAX_TRAIL_POINTS * FLOATS_PER_POINT);
const controlBindings = new Map();

function setStatus(message) {
  if (controlStatus) {
    controlStatus.textContent = message;
  }
}

function initializeTrail() {
  state.trail = Array.from({ length: MAX_TRAIL_POINTS }, () => ({
    x: state.orb.x,
    y: state.orb.y,
  }));
}

function isInsideControlPanel(x, y, margin = 36) {
  if (!controlsPanel) {
    return false;
  }

  const bounds = controlsPanel.getBoundingClientRect();

  return (
    x >= bounds.left - margin &&
    x <= bounds.right + margin &&
    y >= bounds.top - margin &&
    y <= bounds.bottom + margin
  );
}

function pickDemoTarget() {
  const padding = 80;
  const fallback = {
    x: state.width * 0.72,
    y: state.height * 0.45,
  };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = randomBetween(padding, Math.max(padding, state.width - padding));
    const y = randomBetween(padding, Math.max(padding, state.height - padding));

    if (!isInsideControlPanel(x, y)) {
      return { x, y };
    }
  }

  return fallback;
}

function beginDemoMove() {
  const target = pickDemoTarget();

  state.demo.phase = "move";
  state.demo.timer = 0;
  state.demo.duration = randomBetween(1.1, 2.8);
  state.demo.fromX = state.orb.x;
  state.demo.fromY = state.orb.y;
  state.demo.targetX = target.x;
  state.demo.targetY = target.y;
}

function beginDemoPause() {
  state.demo.phase = "pause";
  state.demo.timer = 0;
  state.demo.duration = randomBetween(1.2, 2.4);
  state.demo.fromX = state.orb.x;
  state.demo.fromY = state.orb.y;
  state.demo.targetX = state.orb.x;
  state.demo.targetY = state.orb.y;
}

function enableDemoMode() {
  if (state.demo.active) {
    return;
  }

  state.demo.active = true;
  beginDemoMove();
  setStatus("Autopilot active while the mouse is over the control panel.");
}

function disableDemoMode() {
  if (!state.demo.active) {
    return;
  }

  state.demo.active = false;
  state.demo.phase = "idle";
  state.demo.timer = 0;
  setStatus("Live tuning ready.");
}

function updateDemoMotion(dt, previousX, previousY) {
  state.demo.timer += dt;

  if (state.demo.phase === "pause") {
    state.orb.x = state.demo.targetX;
    state.orb.y = state.demo.targetY;
    state.orb.vx = lerp(state.orb.vx, 0, clamp(dt * 6, 0.08, 0.3));
    state.orb.vy = lerp(state.orb.vy, 0, clamp(dt * 6, 0.08, 0.3));

    if (state.demo.timer >= state.demo.duration) {
      beginDemoMove();
    }

    return;
  }

  const progress = clamp(state.demo.timer / Math.max(state.demo.duration, 0.0001), 0, 1);
  const eased = easeInOutSine(progress);

  state.orb.x = lerp(state.demo.fromX, state.demo.targetX, eased);
  state.orb.y = lerp(state.demo.fromY, state.demo.targetY, eased);
  state.orb.vx = (state.orb.x - previousX) / Math.max(dt, 0.0001);
  state.orb.vy = (state.orb.y - previousY) / Math.max(dt, 0.0001);

  if (progress >= 1) {
    beginDemoPause();
  }
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, PARAMS.renderer.maxDpr);
  state.width = window.innerWidth;
  state.height = window.innerHeight;

  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);

  if (!state.pointer.active && state.orb.x === 0 && state.orb.y === 0) {
    state.pointer.x = state.width * 0.5;
    state.pointer.y = state.height * 0.5;
    state.orb.x = state.pointer.x;
    state.orb.y = state.pointer.y;
    initializeTrail();
  }
}

function bindEvents() {
  window.addEventListener("resize", resize);

  window.addEventListener("pointermove", (event) => {
    state.pointer.active = true;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
  });

  window.addEventListener("pointerleave", () => {
    state.pointer.active = false;
  });

  window.addEventListener("pointerdown", (event) => {
    state.pointer.active = true;
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
  });

  controlsPanel?.addEventListener("pointerenter", () => {
    enableDemoMode();
  });

  controlsPanel?.addEventListener("pointerleave", () => {
    disableDemoMode();
  });
}

function updateTrail(dt, motion) {
  const headResponse = clamp(
    PARAMS.trail.headResponseBase +
      motion * PARAMS.trail.headResponseMotionBoost +
      dt * PARAMS.trail.headResponseDtScale,
    PARAMS.trail.headResponseMin,
    PARAMS.trail.headResponseMax
  );

  state.trail[0].x = lerp(state.trail[0].x, state.orb.x, headResponse);
  state.trail[0].y = lerp(state.trail[0].y, state.orb.y, headResponse);

  for (let index = 1; index < state.trail.length; index += 1) {
    const previous = state.trail[index - 1];
    const point = state.trail[index];
    const delay = clamp(
      PARAMS.trail.segmentDelayBase -
        index * PARAMS.trail.segmentDelayIndexFalloff +
        motion * PARAMS.trail.segmentDelayMotionBoost +
        dt * PARAMS.trail.segmentDelayDtScale,
      PARAMS.trail.segmentDelayMin,
      PARAMS.trail.segmentDelayMax
    );

    point.x = lerp(point.x, previous.x, delay);
    point.y = lerp(point.y, previous.y, delay);
  }
}

function update(dt) {
  state.time += dt;

  const idleX = state.width * 0.5 + Math.cos(state.time * PARAMS.idle.xFrequency) * state.width * PARAMS.idle.xAmplitude;
  const idleY = state.height * 0.5 + Math.sin(state.time * PARAMS.idle.yFrequency) * state.height * PARAMS.idle.yAmplitude;
  const targetX = state.pointer.active ? state.pointer.x : idleX;
  const targetY = state.pointer.active ? state.pointer.y : idleY;
  const previousX = state.orb.x;
  const previousY = state.orb.y;

  if (state.demo.active) {
    updateDemoMotion(dt, previousX, previousY);
  } else if (state.pointer.active) {
    state.orb.x = targetX;
    state.orb.y = targetY;

    const velocityBlend = clamp(
      1 - Math.exp(-dt * PARAMS.motion.velocitySmoothing),
      PARAMS.motion.velocitySmoothingMin,
      PARAMS.motion.velocitySmoothingMax
    );

    const instantVx = (state.orb.x - previousX) / Math.max(dt, 0.0001);
    const instantVy = (state.orb.y - previousY) / Math.max(dt, 0.0001);
    const instantSpeed = Math.hypot(instantVx, instantVy);
    const limitedSpeed = Math.min(instantSpeed, PARAMS.motion.visualSpeedClamp);
    const scale = instantSpeed > 0 ? limitedSpeed / instantSpeed : 1;

    state.orb.vx = lerp(state.orb.vx, instantVx * scale, velocityBlend);
    state.orb.vy = lerp(state.orb.vy, instantVy * scale, velocityBlend);
  } else {
    const dx = targetX - state.orb.x;
    const dy = targetY - state.orb.y;

    state.orb.vx += (dx * PARAMS.follow.stiffness - state.orb.vx * PARAMS.follow.damping) * dt;
    state.orb.vy += (dy * PARAMS.follow.stiffness - state.orb.vy * PARAMS.follow.damping) * dt;
    state.orb.x += state.orb.vx * dt;
    state.orb.y += state.orb.vy * dt;
  }

  const speed = Math.hypot(state.orb.vx, state.orb.vy);
  const motionBlend = clamp(
    1 - Math.exp(-dt * PARAMS.motion.visualMotionSmoothing),
    PARAMS.motion.visualMotionSmoothingMin,
    PARAMS.motion.visualMotionSmoothingMax
  );

  state.visualMotion.vx = lerp(state.visualMotion.vx, state.orb.vx, motionBlend);
  state.visualMotion.vy = lerp(state.visualMotion.vy, state.orb.vy, motionBlend);
  state.visualMotion.speed = lerp(state.visualMotion.speed, speed, motionBlend);

  const motion = clamp(state.visualMotion.speed / PARAMS.trail.motionScale, 0, 1);
  updateTrail(dt, motion);
}

function uploadTrail() {
  for (let index = 0; index < MAX_TRAIL_POINTS; index += 1) {
    const point = state.trail[index];
    const offset = index * FLOATS_PER_POINT;
    const age = index / Math.max(MAX_TRAIL_POINTS - 1, 1);
    const strength = Math.pow(1 - age, 1.2);

    trailUniformData[offset] = point.x * state.dpr;
    trailUniformData[offset + 1] = point.y * state.dpr;
    trailUniformData[offset + 2] = strength;
    trailUniformData[offset + 3] = age;
  }
}

function render() {
  uploadTrail();

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.time, state.time);
  gl.uniform2f(uniforms.orb, state.orb.x * state.dpr, state.orb.y * state.dpr);
  gl.uniform3fv(uniforms.bgTop, backgroundColors.top);
  gl.uniform3fv(uniforms.bgBottom, backgroundColors.bottom);
  gl.uniform2f(uniforms.velocity, state.visualMotion.vx * state.dpr, state.visualMotion.vy * state.dpr);
  gl.uniform1f(uniforms.speed, state.visualMotion.speed * state.dpr);
  gl.uniform4fv(uniforms.trail, trailUniformData);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function animate(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.033);
  state.lastTime = timestamp;

  update(dt);
  render();
  window.requestAnimationFrame(animate);
}

function syncControlValues() {
  controlBindings.forEach((binding, path) => {
    const currentValue = getValueByPath(PARAMS, path);
    binding.input.value = String(currentValue);
    binding.value.textContent = formatValue(currentValue, binding.step);
  });
}

function buildControls() {
  if (!controlsPanel || !controlsList) {
    return;
  }

  controlsList.innerHTML = "";

  TUNER_SECTIONS.forEach((section) => {
    const wrapper = document.createElement("section");
    wrapper.className = "control-section";

    const title = document.createElement("h2");
    title.textContent = section.title;
    wrapper.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "control-grid";

    section.fields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "control-row";

      const meta = document.createElement("div");
      meta.className = "control-row__meta";

      const label = document.createElement("label");
      label.className = "control-row__label";
      label.textContent = field.label;

      const value = document.createElement("span");
      value.className = "control-row__value";

      meta.append(label, value);

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(getValueByPath(PARAMS, field.path));

      input.addEventListener("input", () => {
        const nextValue = Number(input.value);
        setValueByPath(PARAMS, field.path, nextValue);
        value.textContent = formatValue(nextValue, field.step);
        persistParams();
        scheduleRebuild();
      });

      value.textContent = formatValue(Number(input.value), field.step);
      controlBindings.set(field.path, { input, value, step: field.step });

      row.append(meta, input);
      grid.appendChild(row);
    });

    wrapper.appendChild(grid);
    controlsList.appendChild(wrapper);
  });

  const resetButton = controlsPanel.querySelector('[data-action="reset"]');
  const copyButton = controlsPanel.querySelector('[data-action="copy"]');

  resetButton?.addEventListener("click", () => {
    mergeKnown(PARAMS, cloneParams(DEFAULT_PARAMS));
    syncControlValues();
    persistParams();
    scheduleRebuild();
    setStatus("Reset to the saved defaults from this file.");
  });

  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(PARAMS, null, 2));
      setStatus("Copied current PARAMS JSON to the clipboard.");
    } catch {
      setStatus("Clipboard copy failed. Try using the page on localhost.");
    }
  });
}

rebuildProgram();
buildControls();
resize();

if (state.trail.length === 0) {
  initializeTrail();
}

bindEvents();
window.requestAnimationFrame(animate);
