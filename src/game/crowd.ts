import * as THREE from "three";

/**
 * Small cartoon spectators that live OUTSIDE the playable walls.
 * They idle, and during Rainbow/Fever they dance, jump and celebrate.
 * They never enter the board and never affect gameplay.
 */

interface Fan {
  group: THREE.Group;
  body: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;
  head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  armL: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  armR: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  base: THREE.Vector3;
  phase: number;
  hue: number;
  jump: number;
}

const FAN_COLORS = [0xff6ad5, 0x4fd4ff, 0xffd23f, 0x5cff8f, 0xff8a3d, 0xb98cff];

export class DancingCrowd {
  readonly group = new THREE.Group();
  private fans: Fan[] = [];
  private excitement = 0;
  private target = 0;
  private t = 0;
  private hypeT = 0;
  private geoBody = new THREE.CapsuleGeometry(0.22, 0.34, 4, 10);
  private geoHead = new THREE.SphereGeometry(0.2, 14, 10);
  private geoArm = new THREE.BoxGeometry(0.09, 0.3, 0.09);
  private mats: THREE.MeshStandardMaterial[] = [];

  constructor(halfExtent: number, count = 10) {
    const off = halfExtent + 1.75;
    const spots: THREE.Vector3[] = [];
    const along = Math.max(3, Math.round(halfExtent * 1.5));
    for (let i = 0; i < along; i++) {
      const p = -halfExtent + (i / (along - 1)) * halfExtent * 2;
      spots.push(new THREE.Vector3(p, 0, -off));
      spots.push(new THREE.Vector3(p, 0, off));
      spots.push(new THREE.Vector3(-off, 0, p));
      spots.push(new THREE.Vector3(off, 0, p));
    }
    // shuffle + take
    for (let i = spots.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = spots[i];
      spots[i] = spots[j];
      spots[j] = tmp;
    }
    const n = Math.min(count, spots.length);
    for (let i = 0; i < n; i++) {
      const color = FAN_COLORS[i % FAN_COLORS.length];
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.05,
        emissive: new THREE.Color(color).multiplyScalar(0.12),
      });
      this.mats.push(mat);
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.geoBody, mat);
      body.position.y = 0.42;
      const head = new THREE.Mesh(this.geoHead, mat);
      head.position.y = 0.88;
      const armL = new THREE.Mesh(this.geoArm, mat);
      armL.position.set(-0.28, 0.5, 0);
      const armR = new THREE.Mesh(this.geoArm, mat);
      armR.position.set(0.28, 0.5, 0);
      g.add(body, head, armL, armR);
      g.position.copy(spots[i]);
      g.lookAt(0, 0.4, 0);
      this.group.add(g);
      this.fans.push({
        group: g,
        body,
        head,
        armL,
        armR,
        base: spots[i].clone(),
        phase: Math.random() * Math.PI * 2,
        hue: i / n,
        jump: 0,
      });
    }
    this.group.visible = false;
    for (const f of this.fans) f.group.scale.setScalar(0.001);
  }

  /** 0 = idle, 1 = full party. */
  setExcitement(v: number) {
    this.target = THREE.MathUtils.clamp(v, 0, 1);
  }

  /** One-shot celebration burst (golden apple, big combo…). */
  hype(amount = 1) {
    this.hypeT = Math.max(this.hypeT, amount);
  }

  update(dt: number) {
    const anyVisible = this.excitement > 0.01 || this.target > 0.01;
    this.group.visible = anyVisible;
    if (!anyVisible) return;
    this.t += dt;
    this.hypeT = Math.max(0, this.hypeT - dt * 1.6);
    this.excitement += (this.target - this.excitement) * (1 - Math.exp(-dt * 3.2));
    const e = this.excitement;
    const hype = this.hypeT;

    for (const f of this.fans) {
      const s = Math.max(0.001, e);
      f.group.scale.setScalar(s);
      const bounce = Math.abs(Math.sin(this.t * (5 + e * 4) + f.phase));
      const jump = bounce * (0.16 + e * 0.5) + hype * 0.55 * Math.abs(Math.sin(this.t * 14 + f.phase));
      f.group.position.y = f.base.y + jump;
      // dance sway + wave
      f.group.rotation.z = Math.sin(this.t * 6 + f.phase) * 0.14 * e;
      const swing = (0.35 + e * 1.5) * Math.sin(this.t * (7 + e * 5) + f.phase);
      f.armL.rotation.z = 0.4 + swing;
      f.armR.rotation.z = -0.4 - swing;
      f.head.position.y = 0.88 + Math.sin(this.t * 8 + f.phase) * 0.03 * e;
      f.body.scale.y = 1 + Math.sin(this.t * 9 + f.phase) * 0.06 * e;
      // fans tint themselves during the party
      if (e > 0.05) {
        const h = (f.hue + this.t * 0.22) % 1;
        f.body.material.emissive.setHSL(h, 0.85, 0.28 * e + hype * 0.2);
      }
    }
  }

  dispose() {
    this.geoBody.dispose();
    this.geoHead.dispose();
    this.geoArm.dispose();
    for (const m of this.mats) m.dispose();
  }
}
