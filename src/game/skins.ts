/**
 * Random snake skins for Sarp.
 * Pure data — the engine just reads the numbers, so skins never touch logic.
 */

export interface Skin {
  id: string;
  name: string;
  /** head sphere */
  head: number;
  headEmissive: number;
  headSpec: number;
  headShine: number;
  /** body gradient: nearest the head -> tail */
  bodyA: number;
  bodyB: number;
  bodyEmissive: number;
  spec: number;
  shine: number;
}

export const SKINS: Skin[] = [
  {
    id: "classic",
    name: "Classic",
    head: 0xffd23f,
    headEmissive: 0x553905,
    headSpec: 0xfff2c0,
    headShine: 120,
    bodyA: 0x54f28c,
    bodyB: 0x0c6b43,
    bodyEmissive: 0x06281a,
    spec: 0x3fae7a,
    shine: 85,
  },
  {
    id: "metallic",
    name: "Metallic",
    head: 0xe2e8f0,
    headEmissive: 0x2a2f36,
    headSpec: 0xffffff,
    headShine: 220,
    bodyA: 0xc9d4e0,
    bodyB: 0x4d5866,
    bodyEmissive: 0x0d1116,
    spec: 0xffffff,
    shine: 190,
  },
  {
    id: "electric",
    name: "Electric",
    head: 0x8ff9ff,
    headEmissive: 0x0a5a6e,
    headSpec: 0xd9fbff,
    headShine: 200,
    bodyA: 0x4fd4ff,
    bodyB: 0x123a9c,
    bodyEmissive: 0x061a3a,
    spec: 0x9fe8ff,
    shine: 170,
  },
  {
    id: "space",
    name: "Space",
    head: 0xc79bff,
    headEmissive: 0x2d0f52,
    headSpec: 0xe8d5ff,
    headShine: 160,
    bodyA: 0x8f7bff,
    bodyB: 0x241047,
    bodyEmissive: 0x120626,
    spec: 0xb79bff,
    shine: 140,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    head: 0xffffff,
    headEmissive: 0x333333,
    headSpec: 0xffffff,
    headShine: 180,
    bodyA: 0xff5a4e,
    bodyB: 0x4fd4ff,
    bodyEmissive: 0x170b28,
    spec: 0xffffff,
    shine: 150,
  },
  {
    id: "cartoon",
    name: "Cartoon",
    head: 0xff8a3d,
    headEmissive: 0x5c2a06,
    headSpec: 0xffe0b8,
    headShine: 100,
    bodyA: 0xff6ad5,
    bodyB: 0xffb03d,
    bodyEmissive: 0x1c0716,
    spec: 0xffd6f2,
    shine: 95,
  },
];

export function randomSkin(): Skin {
  return SKINS[(Math.random() * SKINS.length) | 0];
}

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
