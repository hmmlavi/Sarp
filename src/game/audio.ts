/* Tiny WebAudio synth — no assets, all sounds generated. */

const LS_KEY = "serpent3d.muted";

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem(LS_KEY) === "1";
} catch {
  muted = false;
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(LS_KEY, m ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Create / resume the AudioContext. Call from a user gesture. */
export function ensureAudio() {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignore */
  }
}

interface ToneOpts {
  f0: number;
  f1?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
}

function tone({ f0, f1, dur, type = "square", vol = 0.1, delay = 0 }: ToneOpts) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  eat(streak: number) {
    const p = 1 + Math.min(streak, 8) * 0.07;
    tone({ f0: 340 * p, f1: 690 * p, dur: 0.09, type: "square", vol: 0.09 });
    tone({ f0: 1050 * p, f1: 1500 * p, dur: 0.07, type: "triangle", vol: 0.07, delay: 0.02 });
  },
  turn() {
    tone({ f0: 210, f1: 190, dur: 0.03, type: "sine", vol: 0.028 });
  },
  die() {
    tone({ f0: 320, f1: 52, dur: 0.5, type: "sawtooth", vol: 0.12 });
    tone({ f0: 165, f1: 40, dur: 0.55, type: "square", vol: 0.08, delay: 0.03 });
  },
  over() {
    tone({ f0: 392, dur: 0.12, type: "triangle", vol: 0.08, delay: 0.0 });
    tone({ f0: 311, dur: 0.12, type: "triangle", vol: 0.08, delay: 0.13 });
    tone({ f0: 233, dur: 0.26, type: "triangle", vol: 0.09, delay: 0.26 });
  },
  best() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) =>
      tone({ f0: f, dur: 0.12, type: "square", vol: 0.07, delay: i * 0.09 })
    );
  },
  start() {
    tone({ f0: 392, f1: 523, dur: 0.08, type: "square", vol: 0.07 });
    tone({ f0: 659, f1: 784, dur: 0.1, type: "square", vol: 0.06, delay: 0.07 });
  },
  click() {
    tone({ f0: 620, f1: 540, dur: 0.05, type: "triangle", vol: 0.05 });
  },
  /** Soft thud when the immortal snake slides along a wall. */
  bounce() {
    tone({ f0: 160, f1: 95, dur: 0.06, type: "sine", vol: 0.05 });
  },
  /** A rainbow apple has appeared. */
  rainbowSpawn() {
    tone({ f0: 880, f1: 1320, dur: 0.1, type: "triangle", vol: 0.055 });
    tone({ f0: 1320, f1: 1760, dur: 0.14, type: "sine", vol: 0.045, delay: 0.09 });
  },
  /** Rainbow Mode activated — rising fanfare. */
  rainbowUp() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone({ f0: f, f1: f * 1.5, dur: 0.14, type: "square", vol: 0.06, delay: i * 0.055 })
    );
    tone({ f0: 196, f1: 392, dur: 0.4, type: "triangle", vol: 0.05 });
  },
  /** Rainbow Mode over — gentle power-down. */
  rainbowDown() {
    [1047, 784, 523, 392].forEach((f, i) =>
      tone({ f0: f, f1: f * 0.82, dur: 0.13, type: "triangle", vol: 0.05, delay: i * 0.07 })
    );
  },
};
