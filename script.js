const canvas = document.getElementById("energy-canvas");
const ctx = canvas.getContext("2d");

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
    radius: 26,
  },
  trail: [],
  particles: [],
  sparks: [],
  trailClock: 0,
  particleClock: 0,
  sparkClock: 0,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;

  canvas.width = Math.round(state.width * state.dpr);
  canvas.height = Math.round(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  if (!state.pointer.active) {
    state.pointer.x = state.width * 0.5;
    state.pointer.y = state.height * 0.5;
    state.orb.x = state.pointer.x;
    state.orb.y = state.pointer.y;
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
}

function addTrailPoint(x, y, speed) {
  const motion = clamp(speed / 900, 0, 1);

  state.trail.push({
    x,
    y,
    age: 0,
    life: 0.12 + motion * 0.42,
    radius: 10 + motion * 34,
  });

  if (state.trail.length > 44) {
    state.trail.shift();
  }
}

function emitParticle(speed, dirX, dirY) {
  const lateralX = -dirY;
  const lateralY = dirX;
  const spread = (Math.random() - 0.5) * 2;
  const speedScale = 0.24 + Math.random() * 0.18;

  state.particles.push({
    x: state.orb.x - dirX * (10 + Math.random() * 12),
    y: state.orb.y - dirY * (10 + Math.random() * 12),
    vx: -dirX * speed * speedScale + lateralX * spread * 45,
    vy: -dirY * speed * speedScale + lateralY * spread * 45,
    age: 0,
    life: 0.35 + Math.random() * 0.55,
    radius: 10 + Math.random() * 26,
    twinkle: Math.random() * Math.PI * 2,
    hue: 190 + Math.random() * 55,
  });
}

function emitSpark(speed) {
  const angle = Math.random() * Math.PI * 2;
  const burst = 40 + Math.random() * (65 + speed * 0.12);

  state.sparks.push({
    x: state.orb.x + Math.cos(angle) * (6 + Math.random() * 8),
    y: state.orb.y + Math.sin(angle) * (6 + Math.random() * 8),
    vx: Math.cos(angle) * burst,
    vy: Math.sin(angle) * burst,
    age: 0,
    life: 0.16 + Math.random() * 0.18,
    radius: 1.5 + Math.random() * 2,
    alpha: 0.4 + Math.random() * 0.45,
  });
}

function update(dt) {
  state.time += dt;

  const idleX = state.width * 0.5 + Math.cos(state.time * 0.72) * state.width * 0.08;
  const idleY = state.height * 0.5 + Math.sin(state.time * 0.95) * state.height * 0.06;
  const targetX = state.pointer.active ? state.pointer.x : idleX;
  const targetY = state.pointer.active ? state.pointer.y : idleY;

  const stiffness = 22;
  const damping = 8.5;
  const dx = targetX - state.orb.x;
  const dy = targetY - state.orb.y;

  state.orb.vx += (dx * stiffness - state.orb.vx * damping) * dt;
  state.orb.vy += (dy * stiffness - state.orb.vy * damping) * dt;
  state.orb.x += state.orb.vx * dt;
  state.orb.y += state.orb.vy * dt;

  const speed = Math.hypot(state.orb.vx, state.orb.vy);
  const dirX = speed > 0.001 ? state.orb.vx / speed : 1;
  const dirY = speed > 0.001 ? state.orb.vy / speed : 0;
  const motion = clamp(speed / 900, 0, 1);

  state.trailClock += dt * (4 + motion * 88);
  while (state.trailClock >= 1) {
    addTrailPoint(state.orb.x, state.orb.y, speed);
    state.trailClock -= 1;
  }

  state.particleClock += dt * (1 + motion * 56);
  while (state.particleClock >= 1) {
    emitParticle(speed, dirX, dirY);
    state.particleClock -= 1;
  }

  state.sparkClock += dt * (4 + motion * 18);
  while (state.sparkClock >= 1) {
    emitSpark(speed);
    state.sparkClock -= 1;
  }

  state.trail = state.trail.filter((point) => {
    point.age += dt;
    return point.age < point.life;
  });

  state.particles = state.particles.filter((particle) => {
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.992;
    particle.vy *= 0.992;
    return particle.age < particle.life;
  });

  state.sparks = state.sparks.filter((spark) => {
    spark.age += dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vx *= 0.94;
    spark.vy *= 0.94;
    return spark.age < spark.life;
  });
}

function drawBackground() {
  ctx.clearRect(0, 0, state.width, state.height);

  const backdrop = ctx.createLinearGradient(0, 0, 0, state.height);
  backdrop.addColorStop(0, "#030612");
  backdrop.addColorStop(0.55, "#070516");
  backdrop.addColorStop(1, "#11031e");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, state.width, state.height);

  const ambient = ctx.createRadialGradient(
    state.orb.x,
    state.orb.y,
    0,
    state.orb.x,
    state.orb.y,
    Math.max(state.width, state.height) * 0.6
  );
  ambient.addColorStop(0, "rgba(35, 120, 255, 0.16)");
  ambient.addColorStop(0.25, "rgba(74, 26, 191, 0.12)");
  ambient.addColorStop(0.55, "rgba(8, 14, 34, 0.03)");
  ambient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, state.width, state.height);

  const vignette = ctx.createRadialGradient(
    state.width * 0.5,
    state.height * 0.5,
    Math.min(state.width, state.height) * 0.15,
    state.width * 0.5,
    state.height * 0.5,
    Math.max(state.width, state.height) * 0.75
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, state.width, state.height);
}

function drawTrailRibbon() {
  if (state.trail.length < 2) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 1; i < state.trail.length; i += 1) {
    const prev = state.trail[i - 1];
    const point = state.trail[i];
    const freshness = i / (state.trail.length - 1);
    const width = 3 + freshness * 22;
    const glowWidth = width * 2.6;
    const alpha = 0.025 + freshness * 0.14;

    ctx.strokeStyle = `hsla(${196 + freshness * 34}, 100%, ${66 + freshness * 12}%, ${alpha})`;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = glowWidth;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${186 + freshness * 24}, 100%, 78%, ${alpha * 2.1})`;
    ctx.lineWidth = Math.max(1.25, width * 0.45);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  state.trail.forEach((point, index) => {
    const freshness = index / state.trail.length;
    const radius = point.radius * (0.28 + freshness * 0.72);
    const blob = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    blob.addColorStop(0, `rgba(146, 240, 255, ${0.08 + freshness * 0.08})`);
    blob.addColorStop(0.5, `rgba(65, 126, 255, ${0.05 + freshness * 0.06})`);
    blob.addColorStop(1, "rgba(15, 25, 68, 0)");
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  state.particles.forEach((particle) => {
    const lifeRatio = 1 - particle.age / particle.life;
    const radius = particle.radius * lifeRatio;
    const flicker = 0.7 + Math.sin(state.time * 20 + particle.twinkle) * 0.18;
    const gradient = ctx.createRadialGradient(
      particle.x,
      particle.y,
      0,
      particle.x,
      particle.y,
      radius
    );

    gradient.addColorStop(0, `hsla(${particle.hue}, 100%, 86%, ${0.17 * lifeRatio * flicker})`);
    gradient.addColorStop(0.45, `hsla(${particle.hue + 18}, 100%, 60%, ${0.12 * lifeRatio})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  state.sparks.forEach((spark) => {
    const lifeRatio = 1 - spark.age / spark.life;
    ctx.strokeStyle = `rgba(196, 241, 255, ${spark.alpha * lifeRatio})`;
    ctx.lineWidth = spark.radius * lifeRatio;
    ctx.beginPath();
    ctx.moveTo(spark.x, spark.y);
    ctx.lineTo(spark.x - spark.vx * 0.012, spark.y - spark.vy * 0.012);
    ctx.stroke();
  });

  ctx.restore();
}

function drawElectricArcs(radius, speed) {
  ctx.save();
  ctx.translate(state.orb.x, state.orb.y);
  ctx.globalCompositeOperation = "lighter";

  const arcCount = 4;

  for (let arcIndex = 0; arcIndex < arcCount; arcIndex += 1) {
    const startAngle = state.time * (1.6 + arcIndex * 0.18) + arcIndex * (Math.PI / 2);
    const span = 0.8 + Math.sin(state.time * 2.1 + arcIndex) * 0.15;
    const segments = 12;

    ctx.strokeStyle = `rgba(182, 235, 255, ${0.22 + Math.min(speed * 0.0005, 0.12)})`;
    ctx.lineWidth = 1.15 + arcIndex * 0.18;
    ctx.beginPath();

    for (let step = 0; step <= segments; step += 1) {
      const progress = step / segments;
      const angle = startAngle + progress * span;
      const warp = Math.sin(progress * 18 - state.time * 12 + arcIndex * 1.7) * 3.5;
      const pulse = Math.sin(state.time * 10 + progress * 14 + arcIndex) * 2.5;
      const arcRadius = radius + warp + pulse;
      const x = Math.cos(angle) * arcRadius;
      const y = Math.sin(angle) * arcRadius;

      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  ctx.restore();
}

function drawDirectionalWake(radius, speed) {
  if (speed < 10) {
    return;
  }

  const dirX = state.orb.vx / speed;
  const dirY = state.orb.vy / speed;
  const length = Math.min(220, 50 + speed * 0.07);
  const spread = radius * 1.75;
  const tailEndX = state.orb.x - dirX * length;
  const tailEndY = state.orb.y - dirY * length;
  const tangentX = -dirY;
  const tangentY = dirX;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const wake = ctx.createLinearGradient(state.orb.x, state.orb.y, tailEndX, tailEndY);
  wake.addColorStop(0, "rgba(160, 240, 255, 0.34)");
  wake.addColorStop(0.3, "rgba(85, 182, 255, 0.22)");
  wake.addColorStop(1, "rgba(50, 60, 200, 0)");

  ctx.fillStyle = wake;
  ctx.beginPath();
  ctx.moveTo(state.orb.x + tangentX * radius * 0.6, state.orb.y + tangentY * radius * 0.6);
  ctx.quadraticCurveTo(
    state.orb.x - dirX * length * 0.33 + tangentX * spread,
    state.orb.y - dirY * length * 0.33 + tangentY * spread,
    tailEndX,
    tailEndY
  );
  ctx.quadraticCurveTo(
    state.orb.x - dirX * length * 0.33 - tangentX * spread,
    state.orb.y - dirY * length * 0.33 - tangentY * spread,
    state.orb.x - tangentX * radius * 0.6,
    state.orb.y - tangentY * radius * 0.6
  );
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(214, 246, 255, 0.22)";
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  ctx.beginPath();
  ctx.moveTo(state.orb.x, state.orb.y);
  ctx.quadraticCurveTo(
    state.orb.x - dirX * length * 0.42 + tangentX * 10,
    state.orb.y - dirY * length * 0.42 + tangentY * 10,
    tailEndX,
    tailEndY
  );
  ctx.stroke();

  ctx.restore();
}

function drawOrb() {
  const speed = Math.hypot(state.orb.vx, state.orb.vy);
  const pulse = 0.5 + 0.5 * Math.sin(state.time * 6.5);
  const radius = state.orb.radius + pulse * 3 + Math.min(speed * 0.004, 8);

  drawDirectionalWake(radius, speed);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const halo = ctx.createRadialGradient(
    state.orb.x,
    state.orb.y,
    0,
    state.orb.x,
    state.orb.y,
    radius * 5.2
  );
  halo.addColorStop(0, "rgba(157, 230, 255, 0.36)");
  halo.addColorStop(0.2, "rgba(67, 182, 255, 0.24)");
  halo.addColorStop(0.48, "rgba(94, 77, 255, 0.16)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(state.orb.x, state.orb.y, radius * 5.2, 0, Math.PI * 2);
  ctx.fill();

  const corona = ctx.createRadialGradient(
    state.orb.x,
    state.orb.y,
    radius * 0.18,
    state.orb.x,
    state.orb.y,
    radius * 1.8
  );
  corona.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  corona.addColorStop(0.22, "rgba(165, 243, 255, 0.92)");
  corona.addColorStop(0.5, "rgba(65, 176, 255, 0.58)");
  corona.addColorStop(0.78, "rgba(88, 70, 255, 0.24)");
  corona.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(state.orb.x, state.orb.y, radius * 1.8, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(
    state.orb.x - radius * 0.16,
    state.orb.y - radius * 0.16,
    radius * 0.15,
    state.orb.x,
    state.orb.y,
    radius
  );
  core.addColorStop(0, "rgba(255, 255, 255, 0.98)");
  core.addColorStop(0.3, "rgba(205, 250, 255, 0.98)");
  core.addColorStop(0.66, "rgba(85, 191, 255, 0.84)");
  core.addColorStop(1, "rgba(43, 56, 223, 0.12)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(state.orb.x, state.orb.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(190, 239, 255, ${0.35 + pulse * 0.18})`;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(state.orb.x, state.orb.y, radius * 1.1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + pulse * 0.08})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(state.orb.x - radius * 1.8, state.orb.y);
  ctx.lineTo(state.orb.x + radius * 1.8, state.orb.y);
  ctx.moveTo(state.orb.x, state.orb.y - radius * 1.8);
  ctx.lineTo(state.orb.x, state.orb.y + radius * 1.8);
  ctx.stroke();

  ctx.restore();

  drawElectricArcs(radius * 1.2, speed);
}

function render() {
  drawBackground();
  drawTrailRibbon();
  drawParticles();
  drawOrb();
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

bindEvents();
resize();
window.requestAnimationFrame(animate);
