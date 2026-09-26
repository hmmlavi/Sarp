import * as THREE from "three";

const MAX = 700;

export interface BurstOpts {
  count: number;
  colors: (string | number)[];
  speed: number;
  up?: number;
  gravity?: number;
  drag?: number;
  size?: [number, number];
  life?: [number, number];
}

const VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (150.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  float a = smoothstep(0.5, 0.06, d) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export class ParticleSystem {
  readonly points: THREE.Points;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;

  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);

  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private drag = new Float32Array(MAX);
  private baseSize = new Float32Array(MAX);
  private cursor = 0;
  private tmp = new THREE.Color();

  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));

    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    // Park all particles far away initially
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;
  }

  burst(x: number, y: number, z: number, opts: BurstOpts) {
    const {
      count,
      colors,
      speed,
      up = 0,
      gravity = 12,
      drag = 0.9,
      size = [0.4, 0.9],
      life = [0.35, 0.7],
    } = opts;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      const i3 = i * 3;

      // Random direction, biased hemisphere upward
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      let dx = Math.sin(phi) * Math.cos(theta);
      let dy = Math.abs(Math.cos(phi)) * 0.9 + 0.25;
      let dz = Math.sin(phi) * Math.sin(theta);
      const sp = speed * (0.35 + Math.random() * 0.85);
      this.vel[i3] = dx * sp;
      this.vel[i3 + 1] = dy * sp * 0.75 + up;
      this.vel[i3 + 2] = dz * sp;

      this.pos[i3] = x + (Math.random() - 0.5) * 0.2;
      this.pos[i3 + 1] = y + (Math.random() - 0.5) * 0.2;
      this.pos[i3 + 2] = z + (Math.random() - 0.5) * 0.2;

      this.tmp.set(colors[(Math.random() * colors.length) | 0]);
      this.col[i3] = this.tmp.r;
      this.col[i3 + 1] = this.tmp.g;
      this.col[i3 + 2] = this.tmp.b;

      const l = life[0] + Math.random() * (life[1] - life[0]);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.grav[i] = gravity * (0.7 + Math.random() * 0.6);
      this.drag[i] = drag;
      this.baseSize[i] = size[0] + Math.random() * (size[1] - size[0]);
      this.size[i] = this.baseSize[i];
      this.alpha[i] = 1;
    }
  }

  update(dt: number) {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.pos[i3 + 1] = -999;
        continue;
      }
      const d = Math.pow(this.drag[i], dt * 60);
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05 && this.vel[i3 + 1] < 0) {
        this.pos[i3 + 1] = 0.05;
        this.vel[i3 + 1] *= -0.4;
      }
      const r = this.life[i] / this.maxLife[i];
      this.alpha[i] = r * r;
      this.size[i] = this.baseSize[i] * (0.45 + 0.55 * r);
    }
    if (any) {
      (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
