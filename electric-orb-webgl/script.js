const canvas = document.getElementById("energy-canvas");
const fallbackMessage = document.querySelector("[data-fallback]");

const gl = canvas.getContext("webgl", {
  alpha: false,
  antialias: true,
  depth: false,
  stencil: false,
  powerPreference: "high-performance",
  premultipliedAlpha: false,
});

if (!gl) {
  fallbackMessage.hidden = false;
  throw new Error("WebGL is not available in this browser.");
}

const MAX_TRAIL_POINTS = 20;
const FLOATS_PER_POINT = 4;

const vertexShaderSource = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

const int MAX_TRAIL = ${MAX_TRAIL_POINTS};

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uOrb;
uniform vec2 uVelocity;
uniform float uSpeed;
uniform vec4 uTrail[MAX_TRAIL];

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

  vec3 color = mix(vec3(0.007, 0.011, 0.03), vec3(0.02, 0.01, 0.055), vUv.y);

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
  float speedNorm = saturate(uSpeed / 1400.0);
  vec2 direction = normalize(velocityScene + vec2(0.0001, 0.0));
  vec2 tangent = vec2(-direction.y, direction.x);
  vec2 relative = scene - orbScene;

  float distantGlow = exp(-dot(relative, relative) / 0.26);
  color += vec3(0.01, 0.025, 0.06) * distantGlow;

  vec3 tailColor = vec3(0.0);
  float tailMist = 0.0;

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

    float width = mix(0.004, 0.098, pow(freshness, 1.1));
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
    float segmentEnergy = active * density * breakup;

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
    float pointRadius = mix(0.008, 0.06, freshness);
    float pointGlow = exp(-(pointDistance * pointDistance) / max(pointRadius * pointRadius, 0.00001));

    tailColor += vec3(0.02, 0.08, 0.2) * pointGlow * active * 0.4;
    tailColor += vec3(0.05, 0.23, 0.68) * pointGlow * active * freshness * 0.42;
  }

  vec2 stretched = vec2(
    dot(relative, direction) / mix(1.0, 1.36, speedNorm),
    dot(relative, tangent) / mix(1.0, 0.84, speedNorm)
  );

  float radius = mix(0.034, 0.052, speedNorm);
  float plasmaNoise = fbm(stretched * 12.5 + direction * (uTime * 1.4) + vec2(0.0, -uTime * 0.32));
  float shellNoise = fbm(stretched * 21.0 - direction * (uTime * 1.8) + tangent * uTime * 0.9);
  float surfaceNoise = mix(plasmaNoise, shellNoise, 0.55);
  float shellDistortion = (surfaceNoise - 0.5) * radius * 0.42;

  float radialDistance = length(stretched);
  float core = falloff(radialDistance, radius * 0.02, radius * 0.62);
  float plasmaShell = falloff(radialDistance - shellDistortion * 0.2, radius * 0.12, radius * 1.14 + shellDistortion);
  float hotShell = falloff(abs(radialDistance - radius * (0.78 + shellDistortion * 1.1)), 0.0, radius * 0.36);
  float outerBloom = exp(-(radialDistance * radialDistance) / max(radius * radius * 12.0, 0.00001));
  float wideBloom = exp(-(radialDistance * radialDistance) / max(radius * radius * 46.0, 0.00001));

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
  orbColor += vec3(0.04, 0.13, 0.32) * wideBloom * 1.2;
  orbColor += vec3(0.16, 0.14, 0.52) * wideBloom * 0.42;
  orbColor += vec3(0.07, 0.24, 0.58) * outerBloom * 1.25;
  orbColor += vec3(0.14, 0.58, 1.05) * plasmaShell * 0.9;
  orbColor += vec3(0.55, 0.8, 1.4) * hotShell * 0.48;
  orbColor += vec3(0.24, 0.2, 0.9) * corona * 0.34;
  orbColor += vec3(0.7, 0.92, 1.5) * corona * 0.75;
  orbColor += vec3(0.9, 0.97, 1.35) * arcs * 0.95;
  orbColor += vec3(0.95, 1.0, 1.0) * core * 1.18;
  orbColor += vec3(1.2, 1.24, 1.3) * highlight * 0.72;

  float vaporBand = falloff(abs(radialDistance - radius * (1.34 + plasmaNoise * 0.22)), 0.0, radius * 0.5);
  orbColor += vec3(0.18, 0.32, 0.8) * vaporBand * 0.28;

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

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

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

const uniforms = {
  resolution: gl.getUniformLocation(program, "uResolution"),
  time: gl.getUniformLocation(program, "uTime"),
  orb: gl.getUniformLocation(program, "uOrb"),
  velocity: gl.getUniformLocation(program, "uVelocity"),
  speed: gl.getUniformLocation(program, "uSpeed"),
  trail: gl.getUniformLocation(program, "uTrail[0]"),
};

const positionLocation = gl.getAttribLocation(program, "aPosition");

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
  lastDirection: {
    x: 1,
    y: 0,
  },
  trail: [],
};

const trailUniformData = new Float32Array(MAX_TRAIL_POINTS * FLOATS_PER_POINT);

function initializeTrail() {
  state.trail = Array.from({ length: MAX_TRAIL_POINTS }, () => ({
    x: state.orb.x,
    y: state.orb.y,
  }));
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 1.85);
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
}

function updateTrail(dt, motion) {
  const headResponse = clamp(0.31 + motion * 0.16 + dt * 8.5, 0.16, 0.54);
  state.trail[0].x = lerp(state.trail[0].x, state.orb.x, headResponse);
  state.trail[0].y = lerp(state.trail[0].y, state.orb.y, headResponse);

  for (let index = 1; index < state.trail.length; index += 1) {
    const previous = state.trail[index - 1];
    const point = state.trail[index];
    const delay = clamp(0.18 - index * 0.0045 + motion * 0.05 + dt * 6.4, 0.048, 0.28);

    point.x = lerp(point.x, previous.x, delay);
    point.y = lerp(point.y, previous.y, delay);
  }
}

function update(dt) {
  state.time += dt;

  const idleX = state.width * 0.5 + Math.cos(state.time * 0.72) * state.width * 0.08;
  const idleY = state.height * 0.5 + Math.sin(state.time * 0.96) * state.height * 0.06;
  const targetX = state.pointer.active ? state.pointer.x : idleX;
  const targetY = state.pointer.active ? state.pointer.y : idleY;
  const previousX = state.orb.x;
  const previousY = state.orb.y;

  if (state.pointer.active) {
    state.orb.x = targetX;
    state.orb.y = targetY;

    const velocityBlend = clamp(1 - Math.exp(-dt * 20), 0.18, 0.6);
    const instantVx = (state.orb.x - previousX) / Math.max(dt, 0.0001);
    const instantVy = (state.orb.y - previousY) / Math.max(dt, 0.0001);

    state.orb.vx = lerp(state.orb.vx, instantVx, velocityBlend);
    state.orb.vy = lerp(state.orb.vy, instantVy, velocityBlend);
  } else {
    const stiffness = 20;
    const damping = 8.6;
    const dx = targetX - state.orb.x;
    const dy = targetY - state.orb.y;

    state.orb.vx += (dx * stiffness - state.orb.vx * damping) * dt;
    state.orb.vy += (dy * stiffness - state.orb.vy * damping) * dt;
    state.orb.x += state.orb.vx * dt;
    state.orb.y += state.orb.vy * dt;
  }

  const speed = Math.hypot(state.orb.vx, state.orb.vy);

  if (speed > 0.001) {
    state.lastDirection.x = state.orb.vx / speed;
    state.lastDirection.y = state.orb.vy / speed;
  }

  const motion = clamp(speed / 950, 0, 1);
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
  gl.uniform2f(uniforms.velocity, state.orb.vx * state.dpr, state.orb.vy * state.dpr);
  gl.uniform1f(uniforms.speed, Math.hypot(state.orb.vx, state.orb.vy) * state.dpr);
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

resize();

if (state.trail.length === 0) {
  initializeTrail();
}

bindEvents();
window.requestAnimationFrame(animate);
