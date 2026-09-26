import * as THREE from "three";
import { ParticleSystem } from "./particles";

/** Soft round dot sprite shared by every ambience system. */
function makeDot(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d")!;
  const rad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  rad.addColorStop(0, "rgba(255,255,255,1)");
  rad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/* ============================================================ WEATHER */

export type WeatherKind = "none" | "rain" | "snow" | "storm";

const WEATHER_N = 300;
const WEATHER_H = 13;

/**
 * Purely decorative weather. Never touches gameplay or collision.
 * Small particles, low opacity — the snake stays perfectly readable.
 */
export class Weather {
  readonly group = new THREE.Group();
  private points!: THREE.Points;
  private mat!: THREE.PointsMaterial;
  private pos = new Float32Array(WEATHER_N * 3);
  private vel = new Float32Array(WEATHER_N * 3);
  private geo!: THREE.BufferGeometry;
  private tex = makeDot();

  private kind: WeatherKind = "none";
  private timer = 0;
  private mix = 0;
  private target = 0;
  private flashT = 0;
  private spread: number;
  lightning = 0;

  constructor(spread: number) {
    this.spread = spread;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.mat = new THREE.PointsMaterial({
      size: 0.12,
      map: this.tex,
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.group.visible = false;
    for (let i = 0; i < WEATHER_N; i++) this.seed(i, true);
  }

  private seed(i: number, anywhere: boolean) {
    const i3 = i * 3;
    const r = this.spread + 4;
    this.pos[i3] = (Math.random() * 2 - 1) * r;
    this.pos[i3 + 1] = anywhere ? Math.random() * WEATHER_H : WEATHER_H;
    this.pos[i3 + 2] = (Math.random() * 2 - 1) * r;
  }

  start(kind: Exclude<WeatherKind, "none">, duration: number) {
    this.kind = kind;
    this.timer = duration;
    this.target = 1;
    this.group.visible = true;
    if (kind === "rain") {
      this.mat.color.set(0x9fd8ff);
      this.mat.size = 0.11;
    } else if (kind === "snow") {
      this.mat.color.set(0xffffff);
      this.mat.size = 0.17;
    } else {
      this.mat.color.set(0xb9c9ff);
      this.mat.size = 0.12;
    }
  }

  stop() {
    this.target = 0;
    this.timer = 0;
  }

  get active() {
    return this.kind !== "none";
  }

  get current() {
    return this.kind;
  }

  update(dt: number) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.kind = "none";
        this.target = 0;
      }
    }
    this.mix += (this.target - this.mix) * (1 - Math.exp(-dt * 1.6));
    if (this.mix < 0.004 && this.target === 0) {
      this.mix = 0;
      this.group.visible = false;
      this.lightning = 0;
      return;
    }
    this.group.visible = true;

    const rain = this.kind === "rain";
    const storm = this.kind === "storm";
    const fall = rain ? 20 : storm ? 26 : 1.7;
    const wind = storm ? 3.4 : rain ? 1.1 : 0.5;
    const sway = this.kind === "snow" ? 0.9 : 0;

    for (let i = 0; i < WEATHER_N; i++) {
      const i3 = i * 3;
      this.vel[i3] = wind;
      this.vel[i3 + 1] = -fall;
      this.vel[i3 + 2] = wind * 0.4;
      this.pos[i3] += (this.vel[i3] + Math.sin(this.pos[i3 + 1] * 0.6 + i) * sway) * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0) this.seed(i, false);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    const baseOpacity = this.kind === "snow" ? 0.7 : 0.5;
    this.mat.opacity = baseOpacity * this.mix;

    // occasional lightning during a storm
    if (storm) {
      if (this.flashT > 0) {
        this.flashT -= dt;
        this.lightning = Math.max(0, this.flashT / 0.16) * this.mix;
      } else {
        this.lightning = 0;
        if (Math.random() < dt * 0.4) this.flashT = 0.16;
      }
    } else {
      this.lightning = 0;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

/* ============================================================ SPACE STAGE */

export class SpaceStage {
  readonly group = new THREE.Group();
  private points!: THREE.Points;
  private mat!: THREE.PointsMaterial;
  private geo!: THREE.BufferGeometry;
  private tex = makeDot();
  private mix = 0;
  private target = 0;
  private t = 0;
  private drift: Float32Array;

  constructor() {
    const N = 420;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    this.drift = new Float32Array(N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 26 + Math.random() * 22;
      const y = -8 + Math.random() * 30;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r;
      c.setHSL(0.55 + Math.random() * 0.16, 0.55, 0.72 + Math.random() * 0.28);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      this.drift[i] = 0.06 + Math.random() * 0.18;
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.9,
      map: this.tex,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.group.visible = false;
  }

  setActive(v: boolean) {
    this.target = v ? 1 : 0;
  }

  get level() {
    return this.mix;
  }

  update(dt: number) {
    this.mix += (this.target - this.mix) * (1 - Math.exp(-dt * 1.5));
    if (this.mix < 0.004 && this.target === 0) {
      this.mix = 0;
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.t += dt;
    this.group.rotation.y += dt * 0.012;
    this.mat.opacity = this.mix * (0.75 + Math.sin(this.t * 1.4) * 0.12);
    // gentle twinkle
    const p = this.geo.attributes.position as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    for (let i = 0; i < this.drift.length; i++) {
      arr[i * 3 + 1] += Math.sin(this.t * this.drift[i] * 3 + i) * dt * 0.12;
    }
    p.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

/* ============================================================ LAVA STAGE */

export class LavaStage {
  readonly group = new THREE.Group();
  private lava!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private embers!: THREE.Points;
  private emberMat!: THREE.PointsMaterial;
  private emberPos!: Float32Array;
  private emberVel!: Float32Array;
  private emberGeo!: THREE.BufferGeometry;
  private tex = makeDot();
  private mix = 0;
  private target = 0;
  private t = 0;
  private emberN = 90;

  constructor(grid: number) {
    // lava sits just under the board level, so only the ring outside shows
    const size = grid + 16;
    this.lava = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({
        color: 0xff5a1e,
        emissive: 0xff3b00,
        emissiveIntensity: 0,
        roughness: 0.55,
        metalness: 0.1,
      })
    );
    this.lava.rotation.x = -Math.PI / 2;
    this.lava.position.y = -0.06;
    this.group.add(this.lava);

    // rising embers
    this.emberPos = new Float32Array(this.emberN * 3);
    this.emberVel = new Float32Array(this.emberN * 3);
    for (let i = 0; i < this.emberN; i++) this.seedEmber(i, true);
    this.emberGeo = new THREE.BufferGeometry();
    this.emberGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.emberPos, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.emberMat = new THREE.PointsMaterial({
      size: 0.3,
      map: this.tex,
      color: 0xffa23c,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.embers = new THREE.Points(this.emberGeo, this.emberMat);
    this.embers.frustumCulled = false;
    this.group.add(this.embers);
    this.group.visible = false;
  }

  private seedEmber(i: number, anywhere: boolean) {
    const i3 = i * 3;
    const a = Math.random() * Math.PI * 2;
    const r = 9 + Math.random() * 9;
    this.emberPos[i3] = Math.cos(a) * r;
    this.emberPos[i3 + 1] = anywhere ? Math.random() * 8 : 0.2;
    this.emberPos[i3 + 2] = Math.sin(a) * r;
    this.emberVel[i3] = (Math.random() - 0.5) * 0.35;
    this.emberVel[i3 + 1] = 0.8 + Math.random() * 1.5;
    this.emberVel[i3 + 2] = (Math.random() - 0.5) * 0.35;
  }

  setActive(v: boolean) {
    this.target = v ? 1 : 0;
  }

  get level() {
    return this.mix;
  }

  update(dt: number) {
    this.mix += (this.target - this.mix) * (1 - Math.exp(-dt * 1.5));
    if (this.mix < 0.004 && this.target === 0) {
      this.mix = 0;
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.t += dt;
    this.lava.material.emissiveIntensity = this.mix * (1.1 + Math.sin(this.t * 2) * 0.28);
    this.emberMat.opacity = this.mix * 0.85;
    for (let i = 0; i < this.emberN; i++) {
      const i3 = i * 3;
      this.emberPos[i3] += this.emberVel[i3] * dt;
      this.emberPos[i3 + 1] += this.emberVel[i3 + 1] * dt;
      this.emberPos[i3 + 2] += this.emberVel[i3 + 2] * dt;
      if (this.emberPos[i3 + 1] > 8) this.seedEmber(i, false);
    }
    (this.emberGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.lava.geometry.dispose();
    this.lava.material.dispose();
    this.emberGeo.dispose();
    this.emberMat.dispose();
    this.tex.dispose();
  }
}

/* ============================================================ SPARK TRAIL */

const SPARK_COLORS = ["#7df9ff", "#ffffff", "#4fd4ff", "#c9f7ff", "#a8f0ff"];

/**
 * Electric spark trail (never fire). Emitted along the snake body while active.
 * Fully pooled — no per-frame allocations, no unbounded growth.
 */
export class SparkTrail {
  readonly points: THREE.Points;
  private ps = new ParticleSystem();
  private level = 0;
  private target = 0;
  private emitT = 0;

  constructor() {
    this.points = this.ps.points;
  }

  /** 0 = off, 1 = full sparks (Fever pushes it higher). */
  setActive(v: boolean, level = 1) {
    this.target = v ? level : 0;
  }

  /** Call once per frame while active, with the head world position. */
  trail(x: number, y: number, z: number, dt: number) {
    this.level += (this.target - this.level) * (1 - Math.exp(-dt * 3.6));
    if (this.level < 0.02) return;
    this.emitT -= dt;
    if (this.emitT > 0) return;
    // faster emission at higher intensity, capped so it stays lightweight
    this.emitT = 0.055 / Math.max(0.35, this.level);
    this.ps.burst(x, y, z, {
      count: this.level > 0.7 ? 4 : 2,
      colors: SPARK_COLORS,
      speed: 1.6,
      up: 0.9,
      gravity: 2.2,
      drag: 0.88,
      size: [0.16, 0.42],
      life: [0.22, 0.5],
    });
  }

  update(dt: number) {
    this.ps.update(dt);
  }

  dispose() {
    this.ps.dispose();
  }
}
