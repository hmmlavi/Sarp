import * as THREE from "three";
import { ParticleSystem } from "./particles";
import { sfx } from "./audio";
import { randomSkin, type Skin } from "./skins";
import { WorldFx } from "./worldfx";
import type { WeatherKind } from "./ambience";

export const GRID = 21; // bigger board (was 17) — room for Sarp + mini snakes
const HALF = (GRID - 1) / 2; // cell -> world offset
const BASE_TICK = 152;
const MIN_TICK = 76;

/* ---------- arcade extras tuning ---------- */
const COMBO_WINDOW = 3.4; // seconds to eat the next apple and keep the combo
const FEVER_COMBO = 5; // combo needed to trigger Fever Mode
const FEVER_DURATION = 9;
const FEVER_SPEED_MULT = 0.84;
const FEVER_MULT_BONUS = 0.35;
const GOLDEN_MULT = 5;
const GOLDEN_MIN_T = 14;
const GOLDEN_MAX_T = 24;
const GOLDEN_CHANCE = 0.22;
const MAGNET_DURATION = 8;
const MAGNET_RADIUS = 6.5; // cells
const MAGNET_PULL = 2.8; // world units per second
const SPARK_DURATION = 8;
const NEAR_MISS_COOLDOWN = 1.6;

/* ---------- Rainbow Apple / Rainbow Mode tuning ---------- */
const RAINBOW_FIRST = 10; // first milestone (normal apples eaten)
const RAINBOW_STEP = 15; // 10, 25, 40, 55, 70, 85, 100 ...
export const RAINBOW_DURATION = 10; // seconds of Rainbow Mode
const RAINBOW_SPEED_MULT = 0.62; // tick multiplier at full boost
const RAINBOW_MIN_TICK = 50; // hard floor so controls stay usable
const RAINBOW_APPLE_COUNT = 10; // apples alive at once during Rainbow Mode
const RAINBOW_BONUS = 50; // score for eating the Rainbow Apple
const RAINBOW_QUEUE_DELAY = 2.5; // pause before a queued rainbow apple spawns
const RAINBOW_COLORS = [
  "#ff4040",
  "#ff9d3c",
  "#ffe14d",
  "#5cff8f",
  "#4fd4ff",
  "#8f7bff",
  "#ff6ad5",
];



export type DirName = "up" | "down" | "left" | "right";
export const DIRVEC: Record<DirName, { x: number; z: number }> = {
  up: { x: 0, z: -1 },
  down: { x: 0, z: 1 },
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 },
};
const OPPOSITE: Record<DirName, DirName> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
const ALL_DIRS: DirName[] = ["up", "down", "left", "right"];

export type EngineEvent =
  | { type: "eat"; score: number; gained: number; apples: number; streak: number; speedPct: number; mult: number }
  | { type: "rainbowspawn" }
  | { type: "rainboweat"; score: number; gained: number }
  | { type: "rainbowstart"; duration: number }
  | { type: "rainbowend" }
  | { type: "golden"; score: number; gained: number }
  | { type: "magnetstart"; duration: number }
  | { type: "magnetend" }
  | { type: "sparkstart"; duration: number }
  | { type: "combo"; combo: number }
  | { type: "feverstart"; duration: number }
  | { type: "feverend" }
  | { type: "achievement"; id: string }
  | { type: "nearmiss" }
  | { type: "weather"; kind: WeatherKind; duration: number }
  | { type: "stage"; kind: "space" | "lava"; duration: number }
  | { type: "skin"; name: string }
  | { type: "gameover"; score: number; apples: number; length: number };

type State = "idle" | "demo" | "run" | "paused" | "dead" | "over";

interface Cell {
  x: number;
  z: number;
}

/** Pooled apple instance — used for the 10 temporary Rainbow Mode apples. */
interface ExtraApple {
  cell: Cell;
  group: THREE.Group;
  spawnT: number;
  alive: boolean;
  idx: number;
}

const DISCO_FLOOR_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DISCO_FLOOR_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 g = floor(vUv * 21.0);
  float check = mod(g.x + g.y, 2.0);
  vec2 ctr = (g + 0.5) / 21.0 - 0.5;
  float r = length(ctr) * 2.0;
  float hue = fract(g.x * 0.0618 + g.y * 0.0382 + uTime * 0.09 + check * 0.5);
  float wave = 0.5 + 0.5 * sin(uTime * 6.2831 + (g.x + g.y) * 0.9);
  float pulse = 0.4 + 0.6 * wave * wave;
  vec3 col = hsv2rgb(vec3(hue, 0.72, 1.0));
  float vign = smoothstep(1.2, 0.12, r);
  float a = uOpacity * mix(0.16, 0.82, check) * pulse * vign;
  gl_FragColor = vec4(col * a, a);
}
`;

export class SnakeEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private onEvent: (e: EngineEvent) => void;
  private destroyed = false;

  // snake
  private cells: Cell[] = [];
  private prevCells: Cell[] = [];
  private dirName: DirName = "right";
  private queue: DirName[] = [];
  private pendingGrowth = 0;
  private segMeshes: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>[] = [];
  private segGeo = new THREE.SphereGeometry(0.5, 20, 14);
  private headGroup = new THREE.Group();
  private headAngle = Math.PI / 2;
  private headPop = 0;
  private lastLen = -1;
  /** rendered bead count (cell centres + half-step fillers) */

  // timing
  private state: State = "idle";
  private isDemo = false;
  private tickMs = BASE_TICK;
  private acc = 0;
  private tGlobal = 0;
  private hitstop = 0;
  private slowmoT = 0;
  private deadT = 0;
  private overFired = false;
  private lastEatAt = -1e9;
  private pulseT = 99;

  // scoring
  private score = 0;
  private apples = 0;
  private streak = 0;

  // apple (the classic single apple)
  private apple: Cell = { x: 12, z: 8 };
  private appleGroup = new THREE.Group();
  private appleLight: THREE.PointLight;
  private appleSpawnT = 1;
  private appleBodyMat!: THREE.MeshStandardMaterial;
  private primaryHidden = false;
  private primaryFade = 1;

  /* ---------- Rainbow Apple + Rainbow Mode ---------- */
  private rainbowNextAt = RAINBOW_FIRST;
  private rainbowQueued = false;
  private rainbowQueueT = 0;
  private rainbowActive = false;
  private rainbowT = 0;
  // lets the snake clear its own body before self-collision switches back on
  private rainbowGraceT = 0;
  private boostVal = 0;
  private boostTarget = 0;
  private curTick = BASE_TICK;
  private extras: ExtraApple[] = [];
  private extraBodyMat!: THREE.MeshStandardMaterial;
  private rainbowObj: { cell: Cell; spawnT: number; active: boolean } = {
    cell: { x: 0, z: 0 },
    spawnT: 1,
    active: false,
  };
  private rainbowDustT = 0;

  // rainbow apple visuals
  private rainbowGroup = new THREE.Group();
  private rainbowBody!: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private rainbowHalo!: THREE.Sprite;
  private rainbowBeam!: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  private rainbowSparkles!: THREE.Points;
  private sparklePos!: Float32Array;
  private sparkleCol!: Float32Array;
  private rainbowLight!: THREE.PointLight;

  /* ---------- Disco Stage (transformation of the existing stage) ---------- */
  private discoMix = 0;
  private discoTarget = 0;
  private discoT = 0;
  private beat = 0;
  private discoDirty = false;
  private discoFloor!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private discoLights: THREE.PointLight[] = [];
  private discoBall = new THREE.Group();
  private ballBeams: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>[] = [];
  private boardMat!: THREE.MeshStandardMaterial;
  private postMat!: THREE.MeshStandardMaterial;
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private discoWallColor = new THREE.Color();
  private baseHemiSky = new THREE.Color(0xbfe8c8);
  private baseHemiGround = new THREE.Color(0x0a2418);
  private discoHemiSky = new THREE.Color(0xffd7f2);
  private discoHemiGround = new THREE.Color(0x2a1040);
  private baseDirColor = new THREE.Color(0xfff3d6);
  private discoDirColor = new THREE.Color(0xffe9a8);
  private baseClearColor = new THREE.Color(0x04120c);
  private tmpColor = new THREE.Color();
  private radialTex!: THREE.CanvasTexture;

  /* ---------- arcade extras ---------- */
  private world!: WorldFx;
  private skin: Skin = randomSkin();
  private headMat!: THREE.MeshPhongMaterial;

  // combo + fever (this.streak IS the combo counter)
  private feverActive = false;
  private feverT = 0;
  private feverVal = 0;

  // golden apple
  private goldenObj: { cell: Cell; spawnT: number; active: boolean } = {
    cell: { x: 0, z: 0 },
    spawnT: 1,
    active: false,
  };
  private goldenGroup = new THREE.Group();
  private goldenLight!: THREE.PointLight;
  private goldenTimer = GOLDEN_MIN_T;

  // magnet apple
  private magnetObj: { cell: Cell; spawnT: number; active: boolean } = {
    cell: { x: 0, z: 0 },
    spawnT: 1,
    active: false,
  };
  private magnetApple = new THREE.Group();
  private magnetAura!: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private magnetActive = false;
  private magnetT = 0;
  private magnetVal = 0;
  /** live world positions of apples being pulled (key: -1 primary, else extra index) */
  private pull = new Map<number, THREE.Vector3>();

  // feedback + bookkeeping
  private nearMissCd = 0;
  private lastStage: "none" | "space" | "lava" = "none";
  private lastWeather: WeatherKind = "none";

  // fx
  private particles = new ParticleSystem();
  private rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private shakeAmp = 0;
  private shakeDur = 1;
  private shakeT = 0;
  private wallMats: THREE.MeshStandardMaterial[] = [];
  private wallFlash = 0;
  private wallBaseEmissive = new THREE.Color("#16c97a");
  private wallRedEmissive = new THREE.Color("#ff2e22");
  private fireflies!: THREE.Points;
  private fireflyMat!: THREE.PointsMaterial;

  // death physics
  private deathVel: THREE.Vector3[] = [];
  private deathSpin: THREE.Vector3[] = [];
  private deathBodies: THREE.Object3D[] = [];

  // camera
  private camBase = new THREE.Vector3();
  private follow = new THREE.Vector3();
  private followTarget = new THREE.Vector3();

  private raf = 0;
  private last = performance.now();

  constructor(canvas: HTMLCanvasElement, onEvent: (e: EngineEvent) => void) {
    this.onEvent = onEvent;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.8 : 2));
    this.renderer.setClearColor(0x04120c);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
    this.scene.fog = new THREE.FogExp2(0x04120c, 0.012);

    this.radialTex = SnakeEngine.makeRadialTex();
    this.buildLights();
    this.buildBoard();
    this.buildWalls();
    this.buildApple();
    this.buildExtraApples();
    this.buildRainbowApple();
    this.buildGoldenApple();
    this.buildMagnetApple();
    this.buildDisco();
    this.buildHead();
    this.buildFireflies();
    this.scene.add(this.particles.points);
    this.world = new WorldFx(GRID, HALF);
    this.scene.add(this.world.group);
    this.buildRings();

    this.appleLight = this.appleGroup.children.find(
      (c) => (c as THREE.PointLight).isPointLight
    ) as THREE.PointLight;

    this.resize(window.innerWidth, window.innerHeight);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ------------------------------------------------- scene building */

  private static makeRadialTex(): THREE.CanvasTexture {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g = cv.getContext("2d")!;
    const rad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    rad.addColorStop(0, "rgba(255,255,255,1)");
    rad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  private buildLights() {
    this.hemiLight = new THREE.HemisphereLight(0xbfe8c8, 0x0a2418, 0.85);
    this.scene.add(this.hemiLight);
    this.dirLight = new THREE.DirectionalLight(0xfff3d6, 1.15);
    this.dirLight.position.set(9, 16, 7);
    this.scene.add(this.dirLight);
  }

  private buildBoard() {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1024;
    const g = cv.getContext("2d")!;
    const px = cv.width / GRID;
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        g.fillStyle = (x + z) % 2 === 0 ? "#0d3423" : "#0a2a1c";
        g.fillRect(x * px, z * px, px, px);
      }
    }
    // faint grid lines
    g.strokeStyle = "rgba(46,232,141,0.07)";
    g.lineWidth = 2;
    for (let i = 0; i <= GRID; i++) {
      g.beginPath();
      g.moveTo(i * px, 0);
      g.lineTo(i * px, cv.width);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * px);
      g.lineTo(cv.width, i * px);
      g.stroke();
    }
    // center emblem
    g.strokeStyle = "rgba(255,201,60,0.14)";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cv.width / 2, cv.height / 2, px * 2.2, 0, Math.PI * 2);
    g.stroke();
    // edge vignette
    const vg = g.createRadialGradient(512, 512, 260, 512, 512, 760);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(2,12,8,0.55)");
    g.fillStyle = vg;
    g.fillRect(0, 0, cv.width, cv.height);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.boardMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.93,
      metalness: 0,
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID), this.boardMat);
    board.rotation.x = -Math.PI / 2;
    this.scene.add(board);

    // under-glow
    const gcv = document.createElement("canvas");
    gcv.width = gcv.height = 256;
    const gg = gcv.getContext("2d")!;
    const rad = gg.createRadialGradient(128, 128, 8, 128, 128, 128);
    rad.addColorStop(0, "rgba(26,205,128,0.5)");
    rad.addColorStop(1, "rgba(26,205,128,0)");
    gg.fillStyle = rad;
    gg.fillRect(0, 0, 256, 256);
    const gtex = new THREE.CanvasTexture(gcv);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(54, 54),
      new THREE.MeshBasicMaterial({
        map: gtex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.08;
    this.scene.add(glow);
  }

  private buildWalls() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a2c1f,
      roughness: 0.6,
      metalness: 0.15,
      emissive: this.wallBaseEmissive.clone(),
      emissiveIntensity: 0.38,
    });
    const L = GRID + 1.7;
    const mk = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), mat);
      m.position.set(x, 0.22, z);
      this.scene.add(m);
    };
    const off = HALF + 0.85;
    mk(L, 0.55, 0, -off);
    mk(L, 0.55, 0, off);
    mk(0.55, L, -off, 0);
    mk(0.55, L, off, 0);
    this.wallMats.push(mat);

    // gold corner posts
    this.postMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a12,
      roughness: 0.35,
      metalness: 0.55,
      emissive: 0xffc93c,
      emissiveIntensity: 0.42,
    });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.72), this.postMat);
        p.position.set(sx * off, 0.42, sz * off);
        this.scene.add(p);
      }
    }
  }

  private buildApple() {
    this.appleBodyMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      roughness: 0.25,
      metalness: 0.05,
      emissive: 0x5c0a06,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), this.appleBodyMat);
    body.scale.y = 0.92;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.055, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 })
    );
    stem.position.set(0.02, 0.44, 0);
    stem.rotation.z = 0.22;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x37d165, roughness: 0.6, emissive: 0x0a4d22 })
    );
    leaf.scale.set(1.15, 0.32, 0.62);
    leaf.position.set(0.17, 0.5, 0);
    leaf.rotation.z = -0.55;
    const light = new THREE.PointLight(0xff6a4d, 1.25, 5.5, 2);
    light.position.set(0, 0.7, 0);
    this.appleGroup.add(body, stem, leaf, light);
    this.scene.add(this.appleGroup);
  }

  /** Pool of apple instances reused by the Rainbow Mode apple system. */
  private buildExtraApples() {
    const bodyGeo = new THREE.SphereGeometry(0.38, 18, 14);
    this.extraBodyMat = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      roughness: 0.25,
      metalness: 0.05,
      emissive: 0x5c0a06,
    });
    const stemGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const leafGeo = new THREE.SphereGeometry(0.14, 10, 6);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x37d165,
      roughness: 0.6,
      emissive: 0x0a4d22,
    });
    for (let i = 0; i < RAINBOW_APPLE_COUNT + 2; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, this.extraBodyMat);
      body.scale.y = 0.92;
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(0.02, 0.4, 0);
      stem.rotation.z = 0.22;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.scale.set(1.15, 0.32, 0.62);
      leaf.position.set(0.15, 0.44, 0);
      leaf.rotation.z = -0.55;
      group.add(body, stem, leaf);
      group.visible = false;
      this.scene.add(group);
      this.extras.push({ cell: { x: 0, z: 0 }, group, spawnT: 1, alive: false, idx: i });
    }
  }

  /** The rare Rainbow Apple power-up. */
  private buildRainbowApple() {
    // rainbow gradient wrapped around the sphere
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 8;
    const g = cv.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 256, 0);
    const stops = ["#ff4040", "#ff9d3c", "#ffe14d", "#5cff8f", "#4fd4ff", "#8f7bff", "#ff6ad5", "#ff4040"];
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 8);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;

    this.rainbowBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 24, 18),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.35,
      })
    );
    this.rainbowBody.scale.y = 0.94;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.055, 0.28, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfff3c4,
        roughness: 0.4,
        metalness: 0.5,
        emissive: 0x3a2f05,
      })
    );
    stem.position.set(0.02, 0.48, 0);
    stem.rotation.z = 0.22;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 8),
      new THREE.MeshStandardMaterial({
        color: 0x7dffd0,
        roughness: 0.35,
        metalness: 0.2,
        emissive: 0x0d5c3c,
      })
    );
    leaf.scale.set(1.2, 0.34, 0.62);
    leaf.position.set(0.19, 0.53, 0);
    leaf.rotation.z = -0.55;

    this.rainbowHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.radialTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rainbowHalo.scale.setScalar(2.5);

    // vertical light shaft so it reads instantly as a power-up
    this.rainbowBeam = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 6, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.rainbowBeam.rotation.x = Math.PI; // apex down at the apple
    this.rainbowBeam.position.y = 3.0;

    // orbiting sparkles
    const N = 18;
    this.sparklePos = new Float32Array(N * 3);
    this.sparkleCol = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.sparklePos, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
      "color",
      new THREE.BufferAttribute(this.sparkleCol, 3).setUsage(THREE.DynamicDrawUsage)
    );
    this.rainbowSparkles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.28,
        map: this.radialTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rainbowSparkles.frustumCulled = false;

    this.rainbowGroup.add(
      this.rainbowBody,
      stem,
      leaf,
      this.rainbowHalo,
      this.rainbowBeam,
      this.rainbowSparkles
    );
    this.rainbowGroup.visible = false;
    this.scene.add(this.rainbowGroup);

    // light lives directly in the scene (intensity 0) so the light count never changes
    this.rainbowLight = new THREE.PointLight(0xffffff, 0, 7, 2);
    this.rainbowLight.position.set(0, 0.9, 0);
    this.scene.add(this.rainbowLight);
  }

  /** Disco transformation of the existing stage (all effects scale by discoMix). */
  private buildDisco() {
    this.discoFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID, GRID),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: DISCO_FLOOR_VERT,
        fragmentShader: DISCO_FLOOR_FRAG,
      })
    );
    this.discoFloor.rotation.x = -Math.PI / 2;
    this.discoFloor.position.y = 0.04;
    this.discoFloor.visible = false;
    this.discoFloor.renderOrder = 1;
    this.scene.add(this.discoFloor);

    // orbiting party lights (intensity 0 until disco starts)
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 17, 2);
      l.position.set(0, 5, 0);
      this.scene.add(l);
      this.discoLights.push(l);
    }

    // mirror ball with rotating beams
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, 2),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.12,
        metalness: 0.95,
        emissive: 0x0a0a0a,
      })
    );
    this.discoBall.add(ball);
    const ballGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.radialTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ballGlow.scale.setScalar(6);
    this.discoBall.add(ballGlow);

    const beamGeo = new THREE.ConeGeometry(0.5, 8.5, 10, 1, true);
    beamGeo.translate(0, -4.25, 0); // apex at the ball, body extends outward
    const down = new THREE.Vector3(0, -1, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), -0.9, Math.sin(a)).normalize();
      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      beam.quaternion.setFromUnitVectors(down, dir);
      this.discoBall.add(beam);
      this.ballBeams.push(beam);
    }
    this.discoBall.position.set(0, 8.2, 0);
    this.discoBall.visible = false;
    this.scene.add(this.discoBall);
  }

  private buildHead() {
    this.headMat = new THREE.MeshPhongMaterial({
      color: this.skin.head,
      shininess: this.skin.headShine,
      specular: this.skin.headSpec,
      emissive: this.skin.headEmissive,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.56, 26, 20), this.headMat);
    head.scale.y = 0.86;
    const eyeGeo = new THREE.SphereGeometry(0.125, 12, 10);
    const eyeMat = new THREE.MeshPhongMaterial({ color: 0xf6fff2, shininess: 140 });
    const pupilGeo = new THREE.SphereGeometry(0.062, 10, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0b1410 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0.21 * s, 0.22, 0.38);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0.235 * s, 0.23, 0.485);
      this.headGroup.add(eye, pupil);
    }
    this.headGroup.add(head);
    this.scene.add(this.headGroup);
  }

  private buildFireflies() {
    const N = 80;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const cGold = new THREE.Color("#ffd23f");
    const cGreen = new THREE.Color("#6bffb4");
    for (let i = 0; i < N; i++) {
      const r = 11 + Math.random() * 8;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.4 + Math.random() * 5.4;
      pos[i * 3 + 2] = Math.sin(a) * r;
      const c = Math.random() < 0.5 ? cGold : cGreen;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

    this.fireflyMat = new THREE.PointsMaterial({
      size: 0.24,
      map: this.radialTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
  }

  private buildRings() {
    const geo = new THREE.RingGeometry(0.82, 1, 48);
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd23f,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.06;
      mesh.visible = false;
      this.scene.add(mesh);
      this.rings.push({ mesh, mat, t: 1 });
    }
  }

  private spawnRing(x: number, z: number, color: number) {
    const slot = this.rings.find((r) => r.t >= 1) ?? this.rings[0];
    slot.t = 0;
    slot.mesh.visible = true;
    slot.mesh.position.set(x, 0.06, z);
    slot.mat.color.set(color);
  }

  /* ------------------------------------------------- public API */

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    const aspect = Math.max(0.2, w / h);
    const fov = aspect < 0.75 ? 62 : aspect < 1.1 ? 55 : 48;
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    const tanF = Math.tan((fov * Math.PI) / 360);
    // scale the fit with the board so the arena always fills the same screen space
    const half = HALF + 1.7;
    const distW = half / (tanF * aspect);
    const distH = (half * 0.92) / tanF;
    const dist = Math.max(distW, distH, 16);
    this.camBase.set(0, 0.8, 0.62).normalize().multiplyScalar(dist);
    this.camera.updateProjectionMatrix();
  }

  startRun(demo = false) {
    this.isDemo = demo;
    this.score = 0;
    this.apples = 0;
    this.streak = 0;
    this.lastEatAt = -1e9;
    this.tickMs = BASE_TICK;
    this.acc = 0;
    this.curTick = BASE_TICK;
    this.pendingGrowth = 0;
    this.queue = [];
    this.dirName = "right";
    this.headAngle = Math.PI / 2;
    this.overFired = false;
    this.hitstop = 0;
    this.slowmoT = 0;
    this.pulseT = 99;
    this.headPop = 0;
    this.wallFlash = 0;

    // arcade extras — full reset so nothing leaks between runs
    this.feverActive = false;
    this.feverT = 0;
    this.feverVal = 0;
    this.magnetActive = false;
    this.magnetT = 0;
    this.magnetVal = 0;
    this.pull.clear();
    this.goldenObj.active = false;
    this.goldenObj.spawnT = 1;
    this.goldenTimer = GOLDEN_MIN_T;
    this.magnetObj.active = false;
    this.magnetObj.spawnT = 1;
    this.nearMissCd = 0;
    this.lastStage = "none";
    this.lastWeather = "none";
    this.world.reset();
    this.world.setActive(true);

    this.resetRainbow();
    this.resetSnake();
    this.ensureSegs(this.cells.length);
    this.headGroup.rotation.set(0, this.headAngle, 0);
    this.applySkin(randomSkin());
    this.state = demo ? "demo" : "run";
    this.placeApple(true);
  }

  startDemo() {
    this.startRun(true);
    this.tickMs = 128;
    this.follow.set(0, 0, 0);
  }

  pause() {
    if (this.state === "run") this.state = "paused";
  }

  resume() {
    if (this.state === "paused") this.state = "run";
  }

  isRunning() {
    return this.state === "run";
  }

  isRainbowActive() {
    return this.rainbowActive;
  }

  queueDir(d: DirName) {
    if (this.state !== "run") return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dirName;
    if (d === last || d === OPPOSITE[last]) return;
    if (this.queue.length < 3) {
      this.queue.push(d);
      sfx.turn();
    }
  }

  dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.particles.dispose();
    this.world.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else if (m) m.dispose();
    });
    this.renderer.dispose();
  }

  /* ------------------------------------------------- game logic */

  private resetSnake() {
    const c = Math.floor(GRID / 2);
    this.cells = [
      { x: c, z: c },
      { x: c - 1, z: c },
      { x: c - 2, z: c },
      { x: c - 3, z: c },
    ];
    this.prevCells = this.cells.slice();
    this.deathVel = [];
    this.deathSpin = [];
    this.headGroup.visible = true;
  }

  /** Cells that are free of the snake and of every apple currently on the board. */
  private freeCells(): Cell[] {
    const occ = new Set<number>();
    for (const c of this.cells) occ.add(c.x + c.z * GRID);
    if (!this.primaryHidden) occ.add(this.apple.x + this.apple.z * GRID);
    for (const e of this.extras) if (e.alive) occ.add(e.cell.x + e.cell.z * GRID);
    if (this.rainbowObj.active) occ.add(this.rainbowObj.cell.x + this.rainbowObj.cell.z * GRID);
    if (this.goldenObj.active) occ.add(this.goldenObj.cell.x + this.goldenObj.cell.z * GRID);
    if (this.magnetObj.active) occ.add(this.magnetObj.cell.x + this.magnetObj.cell.z * GRID);
    const free: Cell[] = [];
    for (let x = 0; x < GRID; x++)
      for (let z = 0; z < GRID; z++)
        if (!occ.has(x + z * GRID)) free.push({ x, z });
    return free;
  }

  private placeApple(first: boolean) {
    const free = this.freeCells();
    if (!free.length) {
      // board full — treat as game-over win
      if (this.state === "run") {
        this.state = "dead";
        this.startDeath(false);
      }
      return;
    }
    let pick = free[(Math.random() * free.length) | 0];
    if (first) {
      const head = this.cells[0];
      for (let i = 0; i < 60; i++) {
        const cand = free[(Math.random() * free.length) | 0];
        const d = Math.abs(cand.x - head.x) + Math.abs(cand.z - head.z);
        if (d >= 3 && d <= 6) {
          pick = cand;
          break;
        }
      }
    }
    this.apple = pick;
    this.appleSpawnT = 0;
  }

  /* ---------------- rainbow apple spawning ---------------- */

  private checkRainbowMilestone() {
    if (this.isDemo) return;
    if (this.apples < this.rainbowNextAt) return;
    this.rainbowNextAt += RAINBOW_STEP; // each milestone fires exactly once
    if (this.rainbowActive || this.rainbowObj.active) {
      // one rainbow apple at a time — remember this milestone for later
      this.rainbowQueued = true;
      this.rainbowQueueT = RAINBOW_QUEUE_DELAY;
      return;
    }
    this.spawnRainbowApple();
  }

  private spawnRainbowApple() {
    const head = this.cells[0];
    const free = this.freeCells();
    if (!free.length) return;
    let pick = free[(Math.random() * free.length) | 0];
    for (let i = 0; i < 90; i++) {
      const cand = free[(Math.random() * free.length) | 0];
      const d = Math.abs(cand.x - head.x) + Math.abs(cand.z - head.z);
      if (d >= 3 && d <= 8) {
        pick = cand;
        break;
      }
    }
    this.rainbowObj.cell = pick;
    this.rainbowObj.spawnT = 0;
    this.rainbowObj.active = true;
    const wx = pick.x - HALF;
    const wz = pick.z - HALF;
    this.spawnRing(wx, wz, 0xffffff);
    this.particles.burst(wx, 0.5, wz, {
      count: 22,
      colors: RAINBOW_COLORS,
      speed: 5,
      up: 3.2,
      gravity: 8,
      drag: 0.93,
      size: [0.3, 0.7],
      life: [0.4, 0.9],
    });
    if (!this.isDemo) {
      sfx.rainbowSpawn();
      this.onEvent({ type: "rainbowspawn" });
    }
  }

  /** Spread `n` apples around the arena, away from the snake head and each other. */
  private spawnExtraApples(n: number) {
    const head = this.cells[0];
    const free = this.freeCells();
    for (let i = free.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = free[i];
      free[i] = free[j];
      free[j] = t;
    }
    const taken: Cell[] = [];
    let placed = 0;
    for (const e of this.extras) {
      if (placed >= n) break;
      if (e.alive) continue;
      let pick: Cell | null = null;
      for (const c of free) {
        if (Math.abs(c.x - head.x) + Math.abs(c.z - head.z) < 2) continue;
        let ok = true;
        for (const t of taken) {
          if (Math.abs(t.x - c.x) + Math.abs(t.z - c.z) < 3) {
            ok = false;
            break;
          }
        }
        if (ok) {
          pick = c;
          break;
        }
      }
      if (!pick) {
        for (const c of free) {
          if (Math.abs(c.x - head.x) + Math.abs(c.z - head.z) < 1) continue;
          pick = c;
          break;
        }
      }
      if (!pick) break;
      const at = free.indexOf(pick);
      if (at >= 0) free.splice(at, 1);
      e.cell = pick;
      e.spawnT = 0;
      e.alive = true;
      e.group.visible = true;
      taken.push(pick);
      placed++;
    }
  }

  /** Replace an eaten Rainbow Mode apple so ~10 stay available. */
  private respawnExtra(e: ExtraApple) {
    const free = this.freeCells();
    if (!free.length) {
      e.alive = false;
      e.group.visible = false;
      return;
    }
    const head = this.cells[0];
    let pick = free[(Math.random() * free.length) | 0];
    for (let i = 0; i < 40; i++) {
      const cand = free[(Math.random() * free.length) | 0];
      if (Math.abs(cand.x - head.x) + Math.abs(cand.z - head.z) >= 3) {
        pick = cand;
        break;
      }
    }
    e.cell = pick;
    e.spawnT = 0;
    e.alive = true;
    e.group.visible = true;
  }

  private removeExtraApples() {
    for (const e of this.extras) {
      e.alive = false;
      e.group.visible = false;
      e.spawnT = 1;
    }
  }

  /* ---------------- AI (attract mode) ---------------- */

  private aiDir(): DirName {
    const head = this.cells[0];
    const candidates = ALL_DIRS.filter((d) => d !== OPPOSITE[this.dirName]);
    const safe = candidates.filter((d) => {
      const v = DIRVEC[d];
      const nx = head.x + v.x;
      const nz = head.z + v.z;
      if (nx < 0 || nx >= GRID || nz < 0 || nz >= GRID) return false;
      for (let i = 0; i < this.cells.length - 1; i++)
        if (this.cells[i].x === nx && this.cells[i].z === nz) return false;
      return true;
    });
    if (!safe.length) return this.dirName;
    let best = safe[0];
    let bestScore = Infinity;
    for (const d of safe) {
      const v = DIRVEC[d];
      const nx = head.x + v.x;
      const nz = head.z + v.z;
      let s = Math.abs(nx - this.apple.x) + Math.abs(nz - this.apple.z) + Math.random() * 0.6;
      // look-ahead: avoid trapping ourselves
      const mx = nx + v.x;
      const mz = nz + v.z;
      if (mx < 0 || mx >= GRID || mz < 0 || mz >= GRID) s += 2.2;
      else
        for (let i = 0; i < this.cells.length - 1; i++)
          if (this.cells[i].x === mx && this.cells[i].z === mz) {
            s += 2.2;
            break;
          }
      if (s < bestScore) {
        bestScore = s;
        best = d;
      }
    }
    return best;
  }

  /** Direction used instead of dying when the immortal snake reaches a wall. */
  private pickImmortalDir(): DirName | null {
    const head = this.cells[0];
    const cands = ALL_DIRS.filter((d) => {
      if (d === OPPOSITE[this.dirName]) return false;
      const v = DIRVEC[d];
      const nx = head.x + v.x;
      const nz = head.z + v.z;
      return nx >= 0 && nx < GRID && nz >= 0 && nz < GRID;
    });
    if (!cands.length) return null;
    let best = cands[0];
    let bestScore = -Infinity;
    for (const d of cands) {
      const v = DIRVEC[d];
      const nx = head.x + v.x;
      const nz = head.z + v.z;
      let open = 0;
      for (let step = 1; step <= 3; step++) {
        const sx = nx + v.x * step;
        const sz = nz + v.z * step;
        if (sx >= 0 && sx < GRID && sz >= 0 && sz < GRID) open++;
        else break;
      }
      let s = open + Math.random() * 0.35;
      const near = this.nearestAppleCell(nx, nz);
      if (near) s -= (Math.abs(near.x - nx) + Math.abs(near.z - nz)) * 0.06;
      if (s > bestScore) {
        bestScore = s;
        best = d;
      }
    }
    return best;
  }

  private nearestAppleCell(x: number, z: number): Cell | null {
    let best: Cell | null = null;
    let bd = Infinity;
    const consider = (c: Cell) => {
      const d = Math.abs(c.x - x) + Math.abs(c.z - z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    };
    if (!this.primaryHidden) consider(this.apple);
    if (this.rainbowObj.active) consider(this.rainbowObj.cell);
    for (const e of this.extras) if (e.alive) consider(e.cell);
    return best;
  }

  /* ---------------- the tick ---------------- */

  private step() {
    if (this.state === "demo") this.queue = [this.aiDir()];
    if (this.queue.length) {
      const next = this.queue.shift()!;
      if (next !== OPPOSITE[this.dirName]) this.dirName = next;
    }
    const head = this.cells[0];
    let d = DIRVEC[this.dirName];
    let nh = { x: head.x + d.x, z: head.z + d.z };

    if (nh.x < 0 || nh.x >= GRID || nh.z < 0 || nh.z >= GRID) {
      if (this.rainbowActive) {
        // immortal: slide along the wall instead of dying
        const alt = this.pickImmortalDir();
        if (!alt) return; // completely boxed in — hold position, cannot die
        this.dirName = alt;
        this.queue = [];
        d = DIRVEC[alt];
        nh = { x: head.x + d.x, z: head.z + d.z };
        sfx.bounce();
      } else {
        this.die();
        return;
      }
    }

    const willGrow = this.pendingGrowth > 0;

    // self collision is off while immortal (plus a short grace window afterwards
    // so the snake can leave a body it is still overlapping when the mode ends)
    if (!this.rainbowActive && this.rainbowGraceT <= 0) {
      const checkLen = willGrow ? this.cells.length : this.cells.length - 1;
      for (let i = 0; i < checkLen; i++) {
        if (this.cells[i].x === nh.x && this.cells[i].z === nh.z) {
          this.die();
          return;
        }
      }
    }

    const prev = this.cells;
    this.cells = willGrow ? [nh, ...prev] : [nh, ...prev.slice(0, -1)];
    this.prevCells = prev;
    if (willGrow) this.pendingGrowth--;

    let ate = false;
    if (!this.primaryHidden && nh.x === this.apple.x && nh.z === this.apple.z) {
      this.consumeApple(this.apple);
      this.placeApple(false);
      ate = true;
    }
    if (
      !ate &&
      this.goldenObj.active &&
      nh.x === this.goldenObj.cell.x &&
      nh.z === this.goldenObj.cell.z
    ) {
      this.eatGolden();
      ate = true;
    }
    if (
      !ate &&
      this.magnetObj.active &&
      nh.x === this.magnetObj.cell.x &&
      nh.z === this.magnetObj.cell.z
    ) {
      this.eatMagnet();
      ate = true;
    }
    if (
      !ate &&
      this.rainbowObj.active &&
      nh.x === this.rainbowObj.cell.x &&
      nh.z === this.rainbowObj.cell.z
    ) {
      this.eatRainbow();
      ate = true;
    }
    if (!ate) {
      const hit = this.extras.find((a) => a.alive && a.cell.x === nh.x && a.cell.z === nh.z);
      if (hit) this.eatExtra(hit);
    }

    if (!this.demoLike()) this.checkNearMiss();
  }

  /** Shared scoring/feedback for eating any normal apple. */
  private consumeApple(cell: Cell) {
    const demo = this.state === "demo";
    this.apples++;
    if (this.tGlobal - this.lastEatAt < COMBO_WINDOW) this.streak++;
    else this.streak = 1;
    this.lastEatAt = this.tGlobal;
    const mult = this.comboMult();
    const gained = Math.round((10 + Math.min(Math.max(0, this.streak - 1), 6) * 5) * mult);
    this.score += gained;
    // combo rewards — sparks at x3, Fever at x5
    if (!demo) {
      if (this.streak === 3) {
        this.world.startSpark(SPARK_DURATION);
        this.onEvent({ type: "sparkstart", duration: SPARK_DURATION });
      }
      if (!this.feverActive && this.streak >= FEVER_COMBO) this.startFever();
      if (this.streak >= 3) this.world.hype(0.6);
    }
    this.pendingGrowth += 1;
    this.tickMs = Math.max(MIN_TICK, BASE_TICK - this.apples * 3.2);
    this.headPop = 0.38;
    this.pulseT = 0;

    const ax = cell.x - HALF;
    const az = cell.z - HALF;
    this.particles.burst(ax, 0.5, az, {
      count: this.rainbowActive ? 16 : 26,
      colors: this.rainbowActive ? RAINBOW_COLORS : ["#ffd23f", "#ffc93c", "#ff5340", "#ffe08a"],
      speed: 7,
      up: 3.6,
      gravity: 15,
      drag: 0.9,
      size: [0.5, 1.15],
      life: [0.35, 0.7],
    });
    this.particles.burst(ax, 0.4, az, {
      count: 12,
      colors: ["#2ee88d", "#6bffb4"],
      speed: 4,
      up: 2.2,
      gravity: 7,
      drag: 0.92,
      size: [0.35, 0.7],
      life: [0.4, 0.8],
    });
    this.spawnRing(ax, az, this.rainbowActive ? 0xff6ad5 : 0xffd23f);

    if (!demo) {
      // keep the flow going during the boost (no chunky hit-stop)
      this.hitstop = this.rainbowActive ? 0.018 : 0.045;
      this.shake(this.rainbowActive ? 0.2 : 0.3, 0.3);
      sfx.eat(this.streak);
      this.onEvent({
        type: "eat",
        score: this.score,
        gained,
        apples: this.apples,
        streak: this.streak,
        speedPct: this.speedPct(),
        mult,
      });
    } else {
      this.shake(0.12, 0.2);
    }
    this.checkRainbowMilestone();
  }

  private eatExtra(e: ExtraApple) {
    this.consumeApple(e.cell);
    if (this.rainbowActive) this.respawnExtra(e);
    else {
      e.alive = false;
      e.group.visible = false;
    }
  }

  private eatRainbow() {
    const cell = this.rainbowObj.cell;
    const wx = cell.x - HALF;
    const wz = cell.z - HALF;
    this.score += RAINBOW_BONUS;
    this.pendingGrowth += 1;
    this.headPop = 0.55;
    this.pulseT = 0;
    this.particles.burst(wx, 0.6, wz, {
      count: 64,
      colors: RAINBOW_COLORS,
      speed: 11,
      up: 7,
      gravity: 14,
      drag: 0.9,
      size: [0.45, 1.25],
      life: [0.5, 1.15],
    });
    this.spawnRing(wx, wz, 0xffffff);
    this.spawnRing(wx, wz, 0xff6ad5);
    this.startRainbowMode();
    this.onEvent({ type: "rainboweat", score: this.score, gained: RAINBOW_BONUS });
  }

  /* ---------------- rainbow mode lifecycle ---------------- */

  private startRainbowMode() {
    if (this.rainbowActive) return; // never two instances
    this.rainbowActive = true;
    this.rainbowT = RAINBOW_DURATION;
    this.boostTarget = 1;
    this.discoTarget = 1;
    this.primaryHidden = true; // the temporary apple system takes over
    this.rainbowObj.active = false;
    this.lastLen = -1; // recolour the body into the rainbow spectrum
    this.spawnExtraApples(RAINBOW_APPLE_COUNT);
    this.shake(0.55, 0.5);
    this.hitstop = 0.07;
    sfx.rainbowUp();
    this.onEvent({ type: "rainbowstart", duration: RAINBOW_DURATION });
  }

  private endRainbowMode(silent = false) {
    if (!this.rainbowActive) return;
    this.rainbowActive = false;
    this.rainbowT = 0;
    this.rainbowGraceT = 0.65;
    this.lastLen = -1; // restore the random skin colours
    this.boostTarget = 0;
    this.discoTarget = 0;
    this.removeExtraApples();
    this.primaryHidden = false;
    this.appleSpawnT = 0;
    if (this.state === "run" || this.state === "demo") this.placeApple(false);
    if (!silent) {
      sfx.rainbowDown();
      this.onEvent({ type: "rainbowend" });
    }
  }

  /** Full, instant reset — used on restart / return to menu. */
  private resetRainbow() {
    this.rainbowActive = false;
    this.rainbowT = 0;
    this.rainbowGraceT = 0;
    this.boostTarget = 0;
    this.boostVal = 0;
    this.discoTarget = 0;
    this.discoMix = 0;
    this.discoDirty = true; // force one restore pass
    this.rainbowQueued = false;
    this.rainbowQueueT = 0;
    this.rainbowNextAt = RAINBOW_FIRST;
    this.rainbowObj.active = false;
    this.rainbowObj.spawnT = 1;
    this.rainbowGroup.visible = false;
    this.rainbowLight.intensity = 0;
    this.removeExtraApples();
    this.primaryHidden = false;
    this.primaryFade = 1;
    this.appleSpawnT = 1;
    this.updateDisco(0);
  }

  /* ================= skins ================= */

  private applySkin(s: Skin) {
    this.skin = s;
    this.headMat.color.set(s.head);
    this.headMat.emissive.set(s.headEmissive);
    this.headMat.specular.set(s.headSpec);
    this.headMat.shininess = s.headShine;
    this.ensureSegs(this.cells.length);
    this.lastLen = -1; // force a body recolour on the next layout
    this.colorSegs(this.cells.length);
    if (!this.isDemo) {
      this.onEvent({ type: "skin", name: s.name });
    }
  }

  /* ================= golden + magnet apple builders ================= */

  private buildGoldenApple() {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 22, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffd23f,
        roughness: 0.12,
        metalness: 0.85,
        emissive: 0x6b4a06,
        emissiveIntensity: 1,
      })
    );
    body.scale.y = 0.93;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.055, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 })
    );
    stem.position.set(0.02, 0.45, 0);
    stem.rotation.z = 0.22;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x37d165, roughness: 0.6, emissive: 0x0a4d22 })
    );
    leaf.scale.set(1.15, 0.32, 0.62);
    leaf.position.set(0.17, 0.51, 0);
    leaf.rotation.z = -0.55;
    // light lives in the scene at 0 intensity so the light count never changes
    this.goldenLight = new THREE.PointLight(0xffc93c, 0, 6, 2);
    this.goldenLight.position.set(0, 0.9, 0);
    this.scene.add(this.goldenLight);
    this.goldenGroup.add(body, stem, leaf);
    this.goldenGroup.visible = false;
    this.scene.add(this.goldenGroup);
  }

  private buildMagnetApple() {
    const red = new THREE.MeshStandardMaterial({
      color: 0xff3b30,
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0x3a0503,
    });
    const silver = new THREE.MeshStandardMaterial({
      color: 0xd8dee9,
      roughness: 0.2,
      metalness: 0.95,
      emissive: 0x15181c,
    });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 10, 22, Math.PI), red);
    arc.rotation.z = Math.PI;
    arc.position.y = 0.1;
    const tipGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.18, 10);
    const tipL = new THREE.Mesh(tipGeo, silver);
    tipL.position.set(-0.3, -0.12, 0);
    const tipR = new THREE.Mesh(tipGeo, silver);
    tipR.position.set(0.3, -0.12, 0);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.radialTex,
        color: 0x7df9ff,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.setScalar(2.2);
    this.magnetApple.add(arc, tipL, tipR, glow);
    this.magnetApple.visible = false;
    this.scene.add(this.magnetApple);

    // aura ring that follows Sarp while the magnet is live
    this.magnetAura = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.05, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0x7df9ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.magnetAura.rotation.x = -Math.PI / 2;
    this.magnetAura.visible = false;
    this.scene.add(this.magnetAura);
  }

  /* ================= combo + fever ================= */

  /** Score multiplier from the current combo (higher during Fever). */
  private comboMult() {
    const fromCombo = 1 + Math.min(Math.max(0, this.streak - 1), 8) * 0.15;
    return fromCombo + (this.feverActive ? FEVER_MULT_BONUS : 0);
  }

  private startFever() {
    if (this.feverActive) return;
    this.feverActive = true;
    this.feverT = FEVER_DURATION;
    this.world.startSpark(FEVER_DURATION);
    this.shake(0.3, 0.4);
    sfx.rainbowUp();
    this.onEvent({ type: "feverstart", duration: FEVER_DURATION });
  }

  private endFever() {
    if (!this.feverActive) return;
    this.feverActive = false;
    this.feverT = 0;
    this.onEvent({ type: "feverend" });
  }

  /* ================= golden apple ================= */

  private pickSpot(minD: number, maxD: number): Cell | null {
    const free = this.freeCells();
    if (!free.length) return null;
    const head = this.cells[0];
    let pick = free[(Math.random() * free.length) | 0];
    for (let i = 0; i < 60; i++) {
      const c = free[(Math.random() * free.length) | 0];
      const d = Math.abs(c.x - head.x) + Math.abs(c.z - head.z);
      if (d >= minD && d <= maxD) {
        pick = c;
        break;
      }
    }
    return pick;
  }

  private spawnGolden() {
    const pick = this.pickSpot(4, 11);
    if (!pick) return;
    this.goldenObj.cell = pick;
    this.goldenObj.spawnT = 0;
    this.goldenObj.active = true;
    this.spawnRing(pick.x - HALF, pick.z - HALF, 0xffd23f);
  }

  private eatGolden() {
    const cell = this.goldenObj.cell;
    this.goldenObj.active = false;
    const gained = Math.round(
      (10 + Math.min(Math.max(0, this.streak - 1), 6) * 5) * this.comboMult() * GOLDEN_MULT
    );
    this.score += gained;
    this.pendingGrowth += 1;
    this.headPop = 0.5;
    this.pulseT = 0;
    const x = cell.x - HALF;
    const z = cell.z - HALF;
    this.particles.burst(x, 0.55, z, {
      count: 46,
      colors: ["#ffd23f", "#ffe08a", "#fff3c4", "#ff9d3c"],
      speed: 8,
      up: 5,
      gravity: 12,
      drag: 0.9,
      size: [0.4, 1.1],
      life: [0.45, 0.95],
    });
    this.spawnRing(x, z, 0xffd23f);
    this.shake(0.35, 0.35);
    this.hitstop = 0.05;
    sfx.best();
    this.world.hype(1);
    this.onEvent({ type: "golden", score: this.score, gained });
  }

  /* ================= magnet apple ================= */

  private eatMagnet() {
    const cell = this.magnetObj.cell;
    this.magnetObj.active = false;
    const x = cell.x - HALF;
    const z = cell.z - HALF;
    this.particles.burst(x, 0.55, z, {
      count: 34,
      colors: ["#7df9ff", "#4fd4ff", "#ffffff", "#c9f7ff"],
      speed: 7,
      up: 4,
      gravity: 10,
      drag: 0.9,
      size: [0.35, 0.9],
      life: [0.4, 0.85],
    });
    this.spawnRing(x, z, 0x7df9ff);
    this.shake(0.28, 0.32);
    this.hitstop = 0.05;
    sfx.rainbowUp();
    this.startMagnet();
  }

  private spawnMagnet() {
    const pick = this.pickSpot(4, 11);
    if (!pick) return;
    this.magnetObj.cell = pick;
    this.magnetObj.spawnT = 0;
    this.magnetObj.active = true;
    this.spawnRing(pick.x - HALF, pick.z - HALF, 0x7df9ff);
  }

  private startMagnet() {
    if (this.magnetActive) return;
    this.magnetActive = true;
    this.magnetT = MAGNET_DURATION;
    this.pull.clear();
    this.shake(0.25, 0.3);
    sfx.rainbowUp();
    this.onEvent({ type: "magnetstart", duration: MAGNET_DURATION });
  }

  private endMagnet() {
    if (!this.magnetActive) return;
    this.magnetActive = false;
    this.magnetT = 0;
    this.pull.clear();
    this.onEvent({ type: "magnetend" });
  }

  /** Drift nearby normal apples toward Sarp; eating them still works normally. */
  private updateMagnet(dt: number) {
    this.magnetVal += ((this.magnetActive ? 1 : 0) - this.magnetVal) * (1 - Math.exp(-dt * 4));

    const showAura = this.magnetVal > 0.02;
    this.magnetAura.visible = showAura;
    if (showAura && this.cells.length) {
      const h = this.cells[0];
      this.magnetAura.position.set(h.x - HALF, 0.22, h.z - HALF);
      this.magnetAura.scale.setScalar(1 + Math.sin(this.tGlobal * 4) * 0.09);
      this.magnetAura.material.opacity = this.magnetVal * (0.4 + Math.sin(this.tGlobal * 6) * 0.16);
      this.magnetAura.rotation.z += dt * 1.6;
    }
    if (!this.magnetActive || !this.cells.length) return;

    const head = this.cells[0];
    const hx = head.x - HALF;
    const hz = head.z - HALF;

    const pullOne = (key: number, cell: Cell, group: THREE.Object3D) => {
      if (Math.abs(cell.x - head.x) + Math.abs(cell.z - head.z) > MAGNET_RADIUS) return false;
      let v = this.pull.get(key);
      if (!v) {
        v = new THREE.Vector3(cell.x - HALF, 0.42, cell.z - HALF);
        this.pull.set(key, v);
      }
      const dx = hx - v.x;
      const dy = 0.42 - v.y;
      const dz = hz - v.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      const step = MAGNET_PULL * this.magnetVal * dt;
      v.x += (dx / dist) * step;
      v.y += (dy / dist) * step;
      v.z += (dz / dist) * step;
      group.position.copy(v);
      return dist < 0.55;
    };

    if (!this.primaryHidden) {
      if (pullOne(-1, this.apple, this.appleGroup)) {
        this.pull.delete(-1);
        this.consumeApple(this.apple);
        this.placeApple(false);
      }
    }
    for (const e of this.extras) {
      if (!e.alive) continue;
      if (pullOne(e.idx, e.cell, e.group)) {
        this.pull.delete(e.idx);
        this.eatExtra(e);
      }
    }
  }

  /** Animate the golden + magnet apple pickups. */
  private updatePickups(dt: number) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easeOut = (k: number) => 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);

    const g = this.goldenObj;
    if (g.active) {
      g.spawnT += dt;
      const e = easeOut(Math.min(1, g.spawnT / 0.4));
      const bob = Math.sin(this.tGlobal * 2.4) * 0.1;
      this.goldenGroup.visible = true;
      this.goldenGroup.position.set(g.cell.x - HALF, 0.46 + bob, g.cell.z - HALF);
      this.goldenGroup.scale.setScalar(Math.max(0.001, e));
      this.goldenGroup.rotation.y += dt * 1.1;
      this.goldenLight.intensity = 1.5 + Math.sin(this.tGlobal * 4) * 0.4;
      this.goldenLight.position.set(g.cell.x - HALF, 0.9 + bob, g.cell.z - HALF);
    } else {
      this.goldenGroup.visible = false;
      this.goldenLight.intensity = 0;
    }

    const m = this.magnetObj;
    if (m.active) {
      m.spawnT += dt;
      const e = easeOut(Math.min(1, m.spawnT / 0.4));
      const bob = Math.sin(this.tGlobal * 2.2 + 1) * 0.1;
      this.magnetApple.visible = true;
      this.magnetApple.position.set(m.cell.x - HALF, 0.5 + bob, m.cell.z - HALF);
      this.magnetApple.scale.setScalar(Math.max(0.001, e));
      this.magnetApple.rotation.y += dt * 1.3;
    } else {
      this.magnetApple.visible = false;
    }
  }

  /* ================= near miss (pure feedback) ================= */

  private checkNearMiss() {
    if (this.nearMissCd > 0 || !this.cells.length) return;
    const h = this.cells[0];
    let close = false;

    // hugging the boundary
    if (h.x === 0 || h.x === GRID - 1 || h.z === 0 || h.z === GRID - 1) close = true;

    // brushing its own body (ignore the few segments directly behind the head)
    if (!close) {
      for (let i = 4; i < this.cells.length; i++) {
        const c = this.cells[i];
        if (Math.abs(c.x - h.x) + Math.abs(c.z - h.z) === 1) {
          close = true;
          break;
        }
      }
    }



    if (!close) return;
    this.nearMissCd = NEAR_MISS_COOLDOWN;
    const x = h.x - HALF;
    const z = h.z - HALF;
    this.particles.burst(x, 0.5, z, {
      count: 8,
      colors: ["#ffffff", "#7df9ff", "#ffe08a"],
      speed: 3,
      up: 1.6,
      gravity: 6,
      drag: 0.9,
      size: [0.18, 0.42],
      life: [0.2, 0.4],
    });
    sfx.bounce();
    this.onEvent({ type: "nearmiss" });
  }

  /* ================= per-frame arcade bookkeeping ================= */

  private updateArcade(dt: number, gameDt: number) {
    // fever envelope + countdown
    this.feverVal += ((this.feverActive ? 1 : 0) - this.feverVal) * (1 - Math.exp(-dt * 4));
    if (this.feverActive) {
      this.feverT -= gameDt;
      if (this.feverT <= 0) {
        this.feverT = 0;
        this.endFever();
      }
    }

    // combo decays once the window lapses
    if (this.streak > 0 && this.tGlobal - this.lastEatAt > COMBO_WINDOW) {
      this.streak = 0;
      this.onEvent({ type: "combo", combo: 0 });
    }

    if (this.magnetActive) {
      this.magnetT -= gameDt;
      if (this.magnetT <= 0) {
        this.magnetT = 0;
        this.endMagnet();
      }
    }
    if (this.nearMissCd > 0) this.nearMissCd = Math.max(0, this.nearMissCd - dt);

    // occasional power-up pickups (never while the disco stage owns the board)
    const boardBusy =
      this.goldenObj.active || this.magnetObj.active || this.magnetActive || this.rainbowActive;
    if (!boardBusy) {
      this.goldenTimer -= gameDt;
      if (this.goldenTimer <= 0) {
        this.goldenTimer = GOLDEN_MIN_T + Math.random() * (GOLDEN_MAX_T - GOLDEN_MIN_T);
        const r = Math.random();
        if (r < GOLDEN_CHANCE) this.spawnGolden();
        else if (r < GOLDEN_CHANCE + 0.1) this.spawnMagnet();
      }
    }

    // announce ambience changes so music/UI can react
    const wk = this.world.weatherKind;
    if (wk !== this.lastWeather) {
      this.lastWeather = wk;
      if (wk !== "none") this.onEvent({ type: "weather", kind: wk, duration: 0 });
    }
    const sk = this.world.stageKind;
    if (sk !== this.lastStage) {
      this.lastStage = sk;
      if (sk !== "none") this.onEvent({ type: "stage", kind: sk, duration: 0 });
    }
  }

  private die() {
    const demo = this.state === "demo";
    this.startDeath(!demo);
    if (!demo) sfx.die();
  }

  private startDeath(fx: boolean) {
    if (this.rainbowActive) this.endRainbowMode(true);
    if (this.feverActive) this.endFever();
    if (this.magnetActive) this.endMagnet();
    this.state = "dead";
    this.deadT = 0;
    this.overFired = false;
    this.queue = [];

    // physics bodies = head + segments
    this.deathBodies = [this.headGroup, ...this.segMeshes.slice(0, this.cells.length)];
    this.deathVel = this.deathBodies.map((b) => {
      const p = b.position;
      const out = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(1.5 + Math.random() * 2);
      return new THREE.Vector3(
        out.x + (Math.random() - 0.5) * 4,
        5.5 + Math.random() * 5.5,
        out.z + (Math.random() - 0.5) * 4
      );
    });
    this.deathSpin = this.deathBodies.map(
      () =>
        new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        )
    );

    if (fx) {
      const hx = this.cells[0].x - HALF;
      const hz = this.cells[0].z - HALF;
      this.particles.burst(hx, 0.6, hz, {
        count: 55,
        colors: ["#2ee88d", "#ffc93c", "#ff5340", "#6bffb4"],
        speed: 9,
        up: 6,
        gravity: 17,
        drag: 0.9,
        size: [0.45, 1.1],
        life: [0.5, 1.0],
      });
      this.spawnRing(hx, hz, 0xff4040);
      this.shake(0.95, 0.65);
      this.hitstop = 0.12;
      this.slowmoT = 0.55;
      this.wallFlash = 1;
    }
  }

  private shake(amp: number, dur: number) {
    this.shakeAmp = amp;
    this.shakeDur = dur;
    this.shakeT = dur;
  }

  /* ------------------------------------------------- per-frame */

  private effectiveTick() {
    const mult =
      1 - (1 - RAINBOW_SPEED_MULT) * this.boostVal - (1 - FEVER_SPEED_MULT) * this.feverVal;
    return Math.max(RAINBOW_MIN_TICK, this.tickMs * Math.max(0.55, mult));
  }

  private speedPct() {
    return (BASE_TICK - this.curTick) / (BASE_TICK - MIN_TICK);
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.tGlobal += dt;

    let gdt = dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      gdt = 0;
    }
    if (this.slowmoT > 0) {
      this.slowmoT -= dt;
      gdt *= 0.35;
    }
    const playing = this.state === "run" || this.state === "demo";

    if (playing) {
      this.curTick = this.effectiveTick();
      this.acc += gdt * 1000;
      let guard = 0;
      while (this.acc >= this.curTick && guard++ < 6) {
        this.acc -= this.curTick;
        this.step();
        if (this.state !== "run" && this.state !== "demo") {
          this.acc = 0;
          break;
        }
        this.curTick = this.effectiveTick();
      }
    }

    if (playing || this.state === "paused") {
      this.layoutSnake(dt);
    } else if (this.state === "dead") {
      this.updateDeath(dt);
    }

    this.updateRainbow(dt, playing ? dt : 0);
    this.updateArcade(dt, playing ? dt : 0);
    this.particles.update(dt);
    this.updateRings(dt);
    this.updateApples(dt);
    this.updateMagnet(dt); // after updateApples so pulled positions win
    this.updatePickups(dt);
    this.world.update(dt, {
      head: this.headGroup.position,
      cells: this.cells,
      excitement: this.discoMix,
      fever: this.feverActive,
      rainbow: this.rainbowActive,
      running: this.state === "run",
    });
    this.updateDisco(dt);
    this.updateWalls(dt);
    // storm lightning flash — weather is purely atmospheric
    const lt = this.world.lightning;
    if (lt > 0) {
      this.hemiLight.intensity += lt * 1.8;
      this.dirLight.intensity += lt * 0.9;
    }
    this.updateCamera(dt);

    this.fireflies.rotation.y += dt * (0.022 + this.discoMix * 0.06);
    this.fireflyMat.opacity =
      0.38 + Math.sin(this.tGlobal * 1.6) * 0.14 + this.discoMix * 0.22;

    this.renderer.render(this.scene, this.camera);
  };

  private ensureSegs(n: number) {
    while (this.segMeshes.length < n) {
      const mat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 85,
        specular: 0x3fae7a,
        emissive: 0x06281a,
      });
      const mesh = new THREE.Mesh(this.segGeo, mat);
      this.scene.add(mesh);
      this.segMeshes.push(mesh);
    }
    for (let i = 0; i < this.segMeshes.length; i++) {
      const m = this.segMeshes[i];
      m.visible = i < n;
      if (i < n) m.scale.setScalar(0.001);
    }
  }

  private colorSegs(len: number) {
    const cA = new THREE.Color(this.skin.bodyA);
    const cB = new THREE.Color(this.skin.bodyB);
    const tmp = new THREE.Color();
    for (let i = 0; i < len; i++) {
      const seg = this.segMeshes[i];
      if (!seg) continue;
      if (this.rainbowActive && len > 1) {
        // Rainbow Mode overrides the skin with a full spectrum body
        tmp.setHSL((i / (len - 1)) * 0.85, 0.85, 0.6);
      } else {
        const t = len <= 1 ? 0 : i / (len - 1);
        tmp.lerpColors(cA, cB, Math.pow(t, 0.85));
      }
      const mat = seg.material;
      mat.color.copy(tmp);
      mat.emissive.copy(tmp).multiplyScalar(0.2);
    }
  }

  private layoutSnake(dt: number) {
    const n = this.cells.length;
    if (!n) return;
    this.ensureSegs(n);
    if (n !== this.lastLen) {
      this.colorSegs(n);
      this.lastLen = n;
    }
    this.pulseT += dt;

    const t = Math.min(1, this.acc / Math.max(1, this.curTick));
    const pulsePos = (this.pulseT / 0.5) * n * 0.85;
    const pulseDecay = Math.max(0, 1 - this.pulseT / 0.75);

    for (let i = 0; i < n; i++) {
      const to = this.cells[i];
      const from = this.prevCells[Math.max(0, i - 1)] ?? to;
      const wx = from.x + (to.x - from.x) * t - HALF;
      const wz = from.z + (to.z - from.z) * t - HALF;
      const taper = 1 - 0.42 * Math.pow(i / Math.max(1, n - 1), 1.35);
      const bump =
        1 +
        0.5 *
          Math.exp(-Math.pow(i - pulsePos, 2) / 2.5) *
          pulseDecay;
      const s = 0.95 * taper * bump;
      const bob = Math.sin(this.tGlobal * 6 - i * 0.55) * 0.028;
      const mesh = this.segMeshes[i];
      mesh.position.set(wx, 0.5 * 0.82 * s + 0.02 + bob, wz);
      mesh.scale.set(s, 0.82 * s, s);
    }

    // head
    const to = this.cells[0];
    const from = this.prevCells[0] ?? to;
    const hx = from.x + (to.x - from.x) * t - HALF;
    const hz = from.z + (to.z - from.z) * t - HALF;
    const bob = Math.sin(this.tGlobal * 6) * 0.03;
    this.headPop = Math.max(0, this.headPop - dt * 1.6);
    const hs = 1 + this.headPop;
    this.headGroup.position.set(hx, 0.5 + bob, hz);
    this.headGroup.scale.set(hs, 0.94 * hs + 0.06, hs);

    const dv = DIRVEC[this.dirName];
    const target = Math.atan2(dv.x, dv.z);
    let da = target - this.headAngle;
    da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.headAngle += da * Math.min(1, dt * 13);
    this.headGroup.rotation.y = this.headAngle;
  }

  private updateDeath(dt: number) {
    this.deadT += dt;
    const shrink = Math.max(0.001, 1 - Math.max(0, this.deadT - 0.6) * 1.6);
    for (let i = 0; i < this.deathBodies.length; i++) {
      const b = this.deathBodies[i];
      const v = this.deathVel[i];
      v.y -= 24 * dt;
      b.position.addScaledVector(v, dt);
      if (b.position.y < 0.2 && v.y < 0) {
        b.position.y = 0.2;
        v.y *= -0.35;
        v.x *= 0.7;
        v.z *= 0.7;
      }
      const sp = this.deathSpin[i];
      b.rotation.x += sp.x * dt;
      b.rotation.y += sp.y * dt;
      b.rotation.z += sp.z * dt;
      const base = i === 0 ? 1 : 0.9;
      b.scale.setScalar(Math.max(0.001, base * shrink));
    }
    if (this.state !== "dead") return;
    if (this.deadT > 0.95 && this.state === "dead" && this.demoLike()) {
      this.startDemo();
    }
    if (this.deadT > 1.25 && !this.overFired && !this.demoLike()) {
      this.overFired = true;
      this.state = "over";
      this.onEvent({
        type: "gameover",
        score: this.score,
        apples: this.apples,
        length: this.cells.length,
      });
    }
  }

  private demoLike() {
    return this.isDemo;
  }

  private updateRings(dt: number) {
    for (const r of this.rings) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt / 0.38);
      const e = 1 - Math.pow(1 - r.t, 3);
      r.mesh.scale.setScalar(0.4 + e * 2.8);
      r.mat.opacity = (1 - r.t) * 0.85;
      if (r.t >= 1) r.mesh.visible = false;
    }
  }

  /** Animates the classic apple, the Rainbow Mode apples and the Rainbow Apple. */
  private updateApples(dt: number) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easeOut = (k: number) => 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);

    // classic apple
    this.appleSpawnT += dt;
    const ease = easeOut(Math.min(1, this.appleSpawnT / 0.35));
    this.primaryFade += ((this.primaryHidden ? 0 : 1) - this.primaryFade) * (1 - Math.exp(-dt * 9));
    if (this.primaryFade < 0.002) this.primaryFade = 0;
    const bob = Math.sin(this.tGlobal * 3) * 0.09;
    const ax = this.apple.x - HALF;
    const az = this.apple.z - HALF;
    this.appleGroup.position.set(ax, 0.44 + bob * ease, az);
    this.appleGroup.scale.setScalar(Math.max(0.001, ease * this.primaryFade));
    this.appleGroup.visible = this.primaryFade > 0.01;
    this.appleGroup.rotation.y += dt * 1.4;
    if (this.appleLight) {
      this.appleLight.intensity = (1.15 + Math.sin(this.tGlobal * 5) * 0.35) * this.primaryFade;
      this.appleLight.position.set(0, 0.7 + bob, 0);
    }
    // apples stay readable on the disco floor
    const glow = 1 + this.discoMix * 1.6;
    this.appleBodyMat.emissiveIntensity = glow;
    this.extraBodyMat.emissiveIntensity = glow;

    // Rainbow Mode apples
    for (const e of this.extras) {
      if (!e.alive) continue;
      e.spawnT += dt;
      const ez = easeOut(Math.min(1, e.spawnT / 0.35));
      const b = Math.sin(this.tGlobal * 3.4 + e.idx * 0.9) * 0.08;
      e.group.position.set(e.cell.x - HALF, 0.42 + b * ez, e.cell.z - HALF);
      e.group.scale.setScalar(Math.max(0.001, ez));
      e.group.rotation.y += dt * (1.1 + (e.idx % 3) * 0.3);
    }

    this.updateRainbowApple(dt);
  }

  private updateRainbowApple(dt: number) {
    const r = this.rainbowObj;
    if (!r.active) {
      if (this.rainbowGroup.visible) this.rainbowGroup.visible = false;
      if (this.rainbowLight.intensity !== 0) this.rainbowLight.intensity = 0;
      return;
    }
    if (!this.rainbowGroup.visible) this.rainbowGroup.visible = true;
    r.spawnT += dt;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const k = Math.min(1, r.spawnT / 0.45);
    const ez = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
    const x = r.cell.x - HALF;
    const z = r.cell.z - HALF;
    const bob = Math.sin(this.tGlobal * 2.6) * 0.11;
    this.rainbowGroup.position.set(x, 0.46 + bob, z);
    this.rainbowGroup.scale.setScalar(Math.max(0.001, ez));
    this.rainbowGroup.rotation.y += dt * 1.9;

    // colour-shifting rainbow
    const hue = (this.tGlobal * 0.28) % 1;
    this.rainbowBody.material.emissiveIntensity = 1.15 + Math.sin(this.tGlobal * 6) * 0.35;
    this.rainbowHalo.material.color.setHSL(hue, 0.9, 0.62);
    this.rainbowHalo.material.opacity = 0.42 + Math.sin(this.tGlobal * 4) * 0.12;
    this.rainbowHalo.scale.setScalar(2.4 + Math.sin(this.tGlobal * 3) * 0.35);
    this.rainbowBeam.material.color.setHSL((hue + 0.3) % 1, 0.8, 0.6);
    this.rainbowBeam.material.opacity = 0.1 + Math.sin(this.tGlobal * 3) * 0.045;
    this.rainbowLight.color.setHSL(hue, 0.85, 0.62);
    this.rainbowLight.intensity = 1.7 + Math.sin(this.tGlobal * 5) * 0.5;
    this.rainbowLight.position.set(x, 0.9 + bob, z);

    // orbiting sparkles
    const N = this.sparklePos.length / 3;
    for (let i = 0; i < N; i++) {
      const a = this.tGlobal * 1.6 + (i / N) * Math.PI * 2;
      const rr = 0.72 + Math.sin(this.tGlobal * 2.2 + i) * 0.14;
      this.sparklePos[i * 3] = Math.cos(a) * rr;
      this.sparklePos[i * 3 + 1] = 0.35 + Math.sin(this.tGlobal * 2.6 + i * 1.3) * 0.34;
      this.sparklePos[i * 3 + 2] = Math.sin(a) * rr;
      this.tmpColor.setHSL((i / N + this.tGlobal * 0.35) % 1, 0.9, 0.68);
      this.sparkleCol[i * 3] = this.tmpColor.r;
      this.sparkleCol[i * 3 + 1] = this.tmpColor.g;
      this.sparkleCol[i * 3 + 2] = this.tmpColor.b;
    }
    (this.rainbowSparkles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.rainbowSparkles.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // gentle magic dust (pool-based, self-cleaning)
    this.rainbowDustT -= dt;
    if (this.rainbowDustT <= 0) {
      this.rainbowDustT = 0.11;
      this.particles.burst(x + (Math.random() - 0.5) * 1.5, 0.32, z + (Math.random() - 0.5) * 1.5, {
        count: 2,
        colors: RAINBOW_COLORS,
        speed: 0.6,
        up: 1.4,
        gravity: -1.2,
        drag: 0.97,
        size: [0.25, 0.5],
        life: [0.6, 1.1],
      });
    }
  }

  /** Rainbow Mode countdown, speed envelope and queued milestones. */
  private updateRainbow(dt: number, gameDt: number) {
    // smooth speed envelope (fast ramp in, gentler ramp out)
    const rate = this.boostTarget > this.boostVal ? 7 : 3.2;
    this.boostVal += (this.boostTarget - this.boostVal) * (1 - Math.exp(-dt * rate));
    if (Math.abs(this.boostTarget - this.boostVal) < 0.004) this.boostVal = this.boostTarget;

    if (this.rainbowActive) {
      this.rainbowT -= gameDt;
      if (this.rainbowT <= 0) {
        this.rainbowT = 0;
        this.endRainbowMode();
      }
    }

    if (this.rainbowGraceT > 0) {
      this.rainbowGraceT = Math.max(0, this.rainbowGraceT - dt);
    }

    if (this.rainbowQueued && !this.rainbowActive && !this.rainbowObj.active) {
      if (this.rainbowQueueT > 0) this.rainbowQueueT -= gameDt;
      else {
        this.rainbowQueued = false;
        this.spawnRainbowApple();
      }
    }
  }

  /** Disco Stage look — every value is a pure function of discoMix, so it restores exactly. */
  private updateDisco(dt: number) {
    const stageMix = Math.max(this.world.spaceLevel, this.world.lavaLevel);
    if (this.discoMix === 0 && this.discoTarget === 0 && stageMix < 0.004) {
      if (this.discoDirty) this.restoreStage();
      return;
    }
    this.discoDirty = true;
    const rate = this.discoTarget > this.discoMix ? 3.4 : 2.4;
    this.discoMix += (this.discoTarget - this.discoMix) * (1 - Math.exp(-dt * rate));
    if (Math.abs(this.discoTarget - this.discoMix) < 0.002) this.discoMix = this.discoTarget;

    const m = this.discoMix;
    this.discoT += dt;
    const phase = (this.discoT * (128 / 60)) % 1;
    this.beat = Math.pow(1 - phase, 3) * m;

    // dance floor
    const showFloor = m > 0.003;
    this.discoFloor.visible = showFloor;
    if (showFloor) {
      this.discoFloor.material.uniforms.uTime.value = this.discoT;
      this.discoFloor.material.uniforms.uOpacity.value = 0.9 * m;
    }
    this.boardMat.roughness = 0.93 - 0.5 * m;
    this.boardMat.metalness = 0.3 * m;

    // orbiting party lights
    for (let i = 0; i < this.discoLights.length; i++) {
      const l = this.discoLights[i];
      if (m < 0.003) {
        l.intensity = 0;
        continue;
      }
      const a = this.discoT * (0.9 + i * 0.28) + (i / this.discoLights.length) * Math.PI * 2;
      const rad = 7.2 + Math.sin(this.discoT * 0.7 + i) * 1.6;
      l.position.set(
        Math.cos(a) * rad,
        4.6 + Math.sin(this.discoT * 1.3 + i * 2) * 1.2,
        Math.sin(a) * rad
      );
      l.color.setHSL((this.discoT * 0.11 + i * 0.33) % 1, 0.85, 0.6);
      l.intensity = m * (2.0 + this.beat * 2.2);
    }

    // mirror ball + beams
    this.discoBall.visible = m > 0.004;
    if (this.discoBall.visible) {
      this.discoBall.scale.setScalar(Math.max(0.001, m));
      this.discoBall.rotation.y += dt * 0.85;
      for (let i = 0; i < this.ballBeams.length; i++) {
        const beam = this.ballBeams[i];
        beam.material.color.setHSL((this.discoT * 0.16 + i / this.ballBeams.length) % 1, 0.8, 0.62);
        beam.material.opacity =
          m * (0.09 + 0.09 * (0.5 + 0.5 * Math.sin(this.discoT * 3 + i)));
      }
    }

    // ambient tint
    this.hemiLight.color.lerpColors(this.baseHemiSky, this.discoHemiSky, m);
    this.hemiLight.groundColor.lerpColors(this.baseHemiGround, this.discoHemiGround, m);
    this.hemiLight.intensity = 0.85 + 0.3 * m;
    this.dirLight.color.lerpColors(this.baseDirColor, this.discoDirColor, m);
    this.dirLight.intensity = 1.15 - 0.3 * m;

    // keep background color and fog unchanged
    (this.scene.fog as THREE.FogExp2).color.copy(this.baseClearColor);
    this.renderer.setClearColor(this.baseClearColor);

    // keep the snake readable above the disco floor
    const segBoost = 1 + 0.9 * m;
    const n = Math.min(this.segMeshes.length, this.cells.length);
    for (let i = 0; i < n; i++) this.segMeshes[i].material.emissiveIntensity = segBoost;
    this.postMat.emissiveIntensity = 0.42 + m * (0.5 + this.beat * 0.5);

    // wall hue cycles with the music
    this.discoWallColor.setHSL((this.discoT * 0.12) % 1, 0.8, 0.55);
  }

  /** Puts every environment value back to its exact pre-disco state. */
  private restoreStage() {
    this.discoDirty = false;
    this.beat = 0;
    this.discoFloor.visible = false;
    this.boardMat.roughness = 0.93;
    this.boardMat.metalness = 0;
    for (const l of this.discoLights) l.intensity = 0;
    this.discoBall.visible = false;
    for (const beam of this.ballBeams) beam.material.opacity = 0;
    this.hemiLight.color.copy(this.baseHemiSky);
    this.hemiLight.groundColor.copy(this.baseHemiGround);
    this.hemiLight.intensity = 0.85;
    this.dirLight.color.copy(this.baseDirColor);
    this.dirLight.intensity = 1.15;
    (this.scene.fog as THREE.FogExp2).color.copy(this.baseClearColor);
    this.renderer.setClearColor(this.baseClearColor);
    for (const s of this.segMeshes) s.material.emissiveIntensity = 1;
    this.postMat.emissiveIntensity = 0.42;
    this.appleBodyMat.emissiveIntensity = 1;
    this.extraBodyMat.emissiveIntensity = 1;
  }

  private updateWalls(dt: number) {
    if (this.wallFlash > 0) this.wallFlash = Math.max(0, this.wallFlash - dt * 1.5);
    const f = this.wallFlash;
    const m = this.discoMix;
    for (const mat of this.wallMats) {
      if (f > 0) {
        mat.emissive.lerpColors(this.wallBaseEmissive, this.wallRedEmissive, f);
        mat.emissiveIntensity = 0.38 + f * 1.2;
      } else if (m > 0.001) {
        mat.emissive.lerpColors(this.wallBaseEmissive, this.discoWallColor, m);
        mat.emissiveIntensity = 0.38 + m * (0.5 + this.beat * 0.6);
      } else if (this.discoDirty || mat.emissiveIntensity !== 0.38) {
        mat.emissive.copy(this.wallBaseEmissive);
        mat.emissiveIntensity = 0.38;
      }
    }
  }

  private updateCamera(dt: number) {
    if (this.cells.length) {
      const head = this.cells[0];
      this.followTarget.set((head.x - HALF) * 0.3, 0, (head.z - HALF) * 0.3);
    } else {
      this.followTarget.set(0, 0, 0);
    }
    this.follow.lerp(this.followTarget, 1 - Math.exp(-dt * 3.2));

    let ox = 0;
    let oy = 0;
    let oz = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = this.shakeAmp * Math.pow(Math.max(0, this.shakeT / this.shakeDur), 1.6);
      ox = (Math.random() * 2 - 1) * k;
      oy = (Math.random() * 2 - 1) * k * 0.7;
      oz = (Math.random() * 2 - 1) * k;
    }
    this.camera.position.set(
      this.camBase.x + this.follow.x + ox,
      this.camBase.y + oy,
      this.camBase.z + this.follow.z + oz
    );
    this.camera.lookAt(this.follow.x * 0.9, 0, this.follow.z * 0.9);
  }
}
