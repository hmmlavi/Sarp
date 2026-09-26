import * as THREE from "three";
import { Weather, SparkTrail, type WeatherKind } from "./ambience";
import { DancingCrowd } from "./crowd";

const WEATHER_MIN = 24;
const WEATHER_MAX = 40;
const WEATHER_DUR = 14;
export const STAGE_DUR = 18;

export type StageKind = "none" | "space" | "lava";

export interface WorldUpdate {
  head: THREE.Vector3;
  cells: { x: number; z: number }[];
  excitement: number;
  fever: boolean;
  rainbow: boolean;
  running: boolean;
}

/**
 * Owns decorative world effects (weather, crowd, sparks) while keeping
 * the background environment unchanged and with no extra AI snakes on the board.
 */
export class WorldFx {
  readonly group = new THREE.Group();
  private weather: Weather;
  private spark: SparkTrail;
  private crowd: DancingCrowd;
  private weatherTimer = WEATHER_MIN;
  private sparkT = 0;

  constructor(_grid: number, half: number) {
    this.weather = new Weather(half + 3);
    this.spark = new SparkTrail();
    this.crowd = new DancingCrowd(half, 10);
    this.group.add(
      this.weather.group,
      this.spark.points,
      this.crowd.group
    );
  }

  setActive(v: boolean) {
    if (!v) this.crowd.setExcitement(0);
  }

  startSpark(d = 8) {
    this.sparkT = Math.max(this.sparkT, d);
  }

  hype(a = 1) {
    this.crowd.hype(a);
  }

  get weatherKind(): WeatherKind {
    return this.weather.current;
  }

  get stageKind(): StageKind {
    return "none";
  }

  get lightning() {
    return this.weather.lightning;
  }

  get spaceLevel(): number {
    return 0;
  }

  get lavaLevel(): number {
    return 0;
  }

  reset() {
    this.weather.stop();
    this.weatherTimer = WEATHER_MIN;
    this.sparkT = 0;
    this.spark.setActive(false);
    this.crowd.setExcitement(0);
  }

  update(dt: number, u: WorldUpdate) {
    // random weather scheduling — only during a live run
    if (u.running && !this.weather.active) {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        const kinds: Exclude<WeatherKind, "none">[] = ["rain", "snow", "storm"];
        this.weather.start(kinds[(Math.random() * kinds.length) | 0], WEATHER_DUR);
        this.weatherTimer = WEATHER_MIN + Math.random() * (WEATHER_MAX - WEATHER_MIN);
      }
    }

    if (this.sparkT > 0) this.sparkT = Math.max(0, this.sparkT - dt);

    this.crowd.setExcitement(Math.max(u.excitement, u.fever ? 0.85 : 0));

    this.spark.setActive(this.sparkT > 0 || u.fever, u.fever ? 1 : 0.75);
    this.spark.trail(u.head.x, u.head.y, u.head.z, dt);
    this.spark.update(dt);

    this.weather.update(dt);
    this.crowd.update(dt);
  }

  dispose() {
    this.weather.dispose();
    this.spark.dispose();
    this.crowd.dispose();
  }
}
