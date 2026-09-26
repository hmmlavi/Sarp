/**
 * Dynamic procedural music for Sarp.
 * A tiny step-sequencer whose parameters LERP between moods, so every
 * transition is a smooth crossfade in tempo/energy — never an abrupt cut.
 */

export type MusicMood = "normal" | "combo" | "fever" | "rainbow" | "space" | "lava";

interface MoodDef {
  bpm: number;
  bass: number;
  arp: number;
  perc: number;
  bassWave: OscillatorType;
  arpWave: OscillatorType;
  scale: number[];
  root: number; // midi
  arpOct: number;
  arpEvery: number;
}

const MOODS: Record<MusicMood, MoodDef> = {
  // relaxed, laid-back groove
  normal: {
    bpm: 96, bass: 0.055, arp: 0.03, perc: 0,
    bassWave: "triangle", arpWave: "sine",
    scale: [0, 3, 5, 7, 10], root: 45, arpOct: 12, arpEvery: 2,
  },
  // a bit brighter as the combo builds
  combo: {
    bpm: 112, bass: 0.06, arp: 0.038, perc: 0.012,
    bassWave: "triangle", arpWave: "square",
    scale: [0, 3, 5, 7, 10], root: 45, arpOct: 12, arpEvery: 2,
  },
  // fever: driving and energetic
  fever: {
    bpm: 134, bass: 0.068, arp: 0.05, perc: 0.026,
    bassWave: "sawtooth", arpWave: "square",
    scale: [0, 2, 3, 7, 10], root: 43, arpOct: 24, arpEvery: 1,
  },
  // disco fun
  rainbow: {
    bpm: 128, bass: 0.062, arp: 0.052, perc: 0.03,
    bassWave: "square", arpWave: "square",
    scale: [0, 2, 4, 7, 9, 11], root: 48, arpOct: 12, arpEvery: 1,
  },
  // sparse, ambient, futuristic
  space: {
    bpm: 72, bass: 0.05, arp: 0.034, perc: 0,
    bassWave: "sine", arpWave: "sine",
    scale: [0, 2, 5, 7, 9], root: 41, arpOct: 24, arpEvery: 4,
  },
  // intense, warm, driving
  lava: {
    bpm: 110, bass: 0.07, arp: 0.034, perc: 0.02,
    bassWave: "sawtooth", arpWave: "triangle",
    scale: [0, 1, 5, 6, 10], root: 40, arpOct: 12, arpEvery: 2,
  },
};

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private playing = false;
  private muted = false;
  private mood: MusicMood = "normal";

  // current (lerped) params
  private bpm = MOODS.normal.bpm;
  private bass = MOODS.normal.bass;
  private arp = MOODS.normal.arp;
  private perc = MOODS.normal.perc;
  private arpEvery = MOODS.normal.arpEvery;

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 1, this.ctx.currentTime + 0.25);
    }
  }

  /** Priority: rainbow > fever > space/lava > combo > normal. */
  setMood(m: MusicMood) {
    this.mood = m;
  }

  start() {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      if (this.playing) return;
      this.playing = true;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
      const def = MOODS.normal;
      this.bpm = def.bpm;
      this.bass = def.bass;
      this.arp = def.arp;
      this.perc = def.perc;
      this.arpEvery = def.arpEvery;
      this.timer = window.setInterval(this.tick, 25);
    } catch {
      /* ignore */
    }
  }

  stop() {
    this.playing = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose() {
    this.stop();
    try {
      this.master?.disconnect();
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.master = null;
  }

  private tick = () => {
    if (!this.ctx || !this.master || !this.playing) return;
    const target = MOODS[this.mood];
    // smooth parameter morph (tempo + layer volumes)
    const k = 0.06;
    this.bpm += (target.bpm - this.bpm) * k;
    this.bass += (target.bass - this.bass) * k;
    this.arp += (target.arp - this.arp) * k;
    this.perc += (target.perc - this.perc) * k;
    this.arpEvery = target.arpEvery;

    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.18) {
      this.scheduleStep(this.step, this.nextTime, target);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 16;
    }
  };

  private scheduleStep(step: number, when: number, def: MoodDef) {
    const master = this.master!;
    const barPos = step % 16;

    // bass on the downbeats
    if (barPos % 4 === 0) {
      const deg = def.scale[(step / 4) % def.scale.length | 0];
      this.voice(
        midiToFreq(def.root + deg),
        when,
        60 / this.bpm / 2,
        def.bassWave,
        this.bass,
        420
      );
    }
    // arpeggio
    if (step % this.arpEvery === 0) {
      const deg = def.scale[(step * 3) % def.scale.length];
      this.voice(
        midiToFreq(def.root + def.arpOct + deg),
        when,
        60 / this.bpm / 4,
        def.arpWave,
        this.arp,
        2600
      );
    }
    // light percussion for energetic moods
    if (this.perc > 0.005 && barPos % 4 === 2) {
      this.voice(1200, when, 0.035, "square", this.perc, 3200);
    }
    void master;
  }

  private voice(
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    cutoff: number
  ) {
    if (gain <= 0.0005) return;
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(f).connect(g).connect(this.master!);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }
}
