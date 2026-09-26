import { useEffect, useRef } from "react";
import type { ReactNode, PointerEvent as RPointerEvent, MouseEvent as RMouseEvent } from "react";
import { cn } from "./utils/cn";
import type { DirName } from "./game/engine";
import type { ScoreEntry } from "./game/scores";

/* ------------------------------------------------- icons */

type IconProps = { className?: string };

export const IconPlay = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M7 4.5v15l13-7.5-13-7.5Z" />
  </svg>
);

export const IconPause = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.2" />
  </svg>
);

export const IconRestart = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a9 9 0 1 1-2.6-6.3" />
    <path d="M21 3v6h-6" />
  </svg>
);

export const IconHome = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v10h13V10" />
  </svg>
);

export const IconTrophy = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H4.5v2A3.5 3.5 0 0 0 8 10.5M16 5h3.5v2A3.5 3.5 0 0 1 16 10.5" />
    <path d="M12 14v4m-4 2h8m-6.5-2h5l.7 2H6.8l.7-2Z" />
  </svg>
);

export const IconSoundOn = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" />
  </svg>
);

export const IconSoundOff = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4Z" fill="currentColor" stroke="none" />
    <path d="m16 9.5 5 5m0-5-5 5" />
  </svg>
);

export const IconApple = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 6.6C9.6 4.4 5.5 5.7 5 10c-.4 4 2.6 8.6 5.2 9.8.6.3 1.2.3 1.8.3s1.2 0 1.8-.3c2.6-1.2 5.6-5.8 5.2-9.8-.5-4.3-4.6-5.6-7-3.4Z" />
    <path d="M12 6.5c0-2 1-3.4 2.8-4" stroke="#6b4423" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <path d="M12.6 5.6c1.8-1.6 3.8-1.3 4.9-.6-.5 1.9-2.6 2.7-4.9.6Z" fill="#37d165" />
  </svg>
);

export const IconChevron = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m5.5 14.5 6.5-6.5 6.5 6.5" />
  </svg>
);

/* ------------------------------------------------- shared bits */

export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function ScoreTable({
  scores,
  limit = 5,
  highlightId,
}: {
  scores: ScoreEntry[];
  limit?: number;
  highlightId?: string | null;
}) {
  if (!scores.length) {
    return (
      <p className="text-sm text-milk-dim py-3 text-center">
        No runs yet — set the pace.
      </p>
    );
  }
  const rankColor = ["text-gold-400", "text-[#cfd8d3]", "text-[#d8a05c]"];
  return (
    <div>
      {scores.slice(0, limit).map((s, i) => {
        const hl = s.id === highlightId;
        return (
          <div
            key={s.id}
            style={{ animationDelay: `${i * 60}ms` }}
            className={cn(
              "score-row-in flex items-center gap-2.5 py-1.5 px-2",
              i < scores.slice(0, limit).length - 1 && "border-b border-pine-700/70",
              hl && "rounded-md border-2 border-gold-400/60 bg-gold-400/10 my-0.5"
            )}
          >
            <span className={cn("font-display text-sm w-5 text-center", rankColor[i] ?? "text-milk-dim")}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold tabular text-milk leading-none text-[15px]">
                  {s.score.toLocaleString()}
                </span>
                {hl && (
                  <span className="font-display text-[8px] tracking-widest text-gold-300 bg-gold-400/20 rounded px-1 py-0.5">
                    YOU
                  </span>
                )}
              </div>
              <div className="text-[10px] text-milk-dim mt-0.5">
                {s.apples} apples · length {s.len}
              </div>
            </div>
            <span className="text-[10px] text-milk-dim/80 whitespace-nowrap">
              {new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------- HUD */

export function HUD({
  score,
  best,
  apples,
  streak,
  speedPct,
  rainbow,
  onPause,
  muted,
  onToggleMute,
}: {
  score: number;
  best: number;
  apples: number;
  streak: number;
  speedPct: number;
  rainbow: boolean;
  onPause: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 pt-safe pointer-events-none">
      <div className="flex items-start justify-between gap-2 p-2.5 sm:p-4">
        <div className="relative">
          <div className="panel px-3 py-1.5 min-w-[8rem]">
            <div className="text-[9px] font-bold tracking-[0.3em] text-gold-400">SCORE</div>
            <div
              key={score}
              className="anim-pop font-display text-2xl sm:text-3xl leading-none text-milk tabular mt-0.5"
            >
              {score.toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[8px] font-bold tracking-widest text-milk-dim">
                {rainbow ? "MAX" : "SPD"}
              </span>
              <div className="h-1 flex-1 bg-pine-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    rainbow ? "rainbow-grad rainbow-anim" : "bg-neon-400"
                  )}
                  style={{ width: `${rainbow ? 100 : 8 + Math.min(1, speedPct) * 92}%` }}
                />
              </div>
            </div>
          </div>
          {streak >= 2 && (
            <div
              key={streak}
              className="streak-pulse absolute -bottom-7 left-0 rounded-md border-2 border-apple-500 bg-pine-900/95 px-2 py-0.5 font-display text-[11px] text-gold-300 shadow-[0_3px_0_#03150e]"
            >
              STREAK ×{streak}
            </div>
          )}
        </div>

        <div className="flex items-start gap-1.5 sm:gap-2">
          <div className="panel px-2.5 py-1.5 text-center hidden sm:block">
            <div className="text-[9px] font-bold tracking-[0.25em] text-milk-dim">BEST</div>
            <div className="font-display text-sm text-gold-300 tabular leading-tight">
              {best.toLocaleString()}
            </div>
          </div>
          <div className="panel px-2.5 py-2 flex items-center gap-1.5">
            <IconApple className="w-4 h-4 text-apple-500" />
            <span className="font-display text-sm text-milk tabular">{apples}</span>
          </div>
          <button
            className="btn btn-ghost p-2.5 pointer-events-auto"
            onClick={onPause}
            aria-label="Pause game"
          >
            <IconPause className="w-4 h-4" />
          </button>
          <button
            className="btn btn-ghost p-2.5 pointer-events-auto"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <IconSoundOff className="w-4 h-4" /> : <IconSoundOn className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- Rainbow Mode HUD */

const RING_R = 25;

export function RainbowHud({ endsAt, duration }: { endsAt: number; duration: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const C = 2 * Math.PI * RING_R;
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, endsAt - performance.now());
      const p = Math.max(0, Math.min(1, left / (duration * 1000)));
      if (barRef.current) barRef.current.style.width = `${(p * 100).toFixed(1)}%`;
      if (ringRef.current) ringRef.current.style.strokeDashoffset = `${(C * (1 - p)).toFixed(1)}`;
      if (numRef.current) numRef.current.textContent = (left / 1000).toFixed(1);
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [endsAt, duration]);

  const C = 2 * Math.PI * RING_R;

  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-[4.3rem] sm:top-24 z-10 pointer-events-none">
      <div
        className="rainbow-in rounded-[12px] p-[2px] rainbow-grad rainbow-anim shadow-[0_5px_0_#03150e,0_14px_30px_rgba(0,0,0,0.55)]"
      >
        <div className="rounded-[10px] bg-pine-900/96 pl-2 pr-3.5 py-2 flex items-center gap-3">
          <div className="relative w-[58px] h-[58px] shrink-0">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={RING_R}
                fill="none"
                stroke="rgba(46,232,141,0.16)"
                strokeWidth="6"
              />
              <circle
                ref={ringRef}
                cx="32"
                cy="32"
                r={RING_R}
                fill="none"
                stroke="url(#sarpRainbowGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={0}
              />
              <defs>
                <linearGradient id="sarpRainbowGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ff5a4e" />
                  <stop offset="35%" stopColor="#ffc93c" />
                  <stop offset="65%" stopColor="#5cff8f" />
                  <stop offset="100%" stopColor="#8f7bff" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                ref={numRef}
                className="font-display text-[13px] text-milk tabular leading-none"
                style={{ textShadow: "0 2px 0 #06301d" }}
              >
                10.0
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-display text-[15px] sm:text-base leading-none rainbow-text">
              RAINBOW MODE
            </div>
            <div className="mt-1.5 h-1.5 w-28 sm:w-36 rounded-full bg-pine-800 overflow-hidden">
              <div ref={barRef} className="h-full rainbow-grad rainbow-anim rounded-full" />
            </div>
            <div className="text-[8.5px] font-bold tracking-[0.18em] text-milk-dim mt-1.5">
              ×2 SPEED · IMMORTAL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- D-Pad */

export function DPad({ onDir, onPause }: { onDir: (d: DirName) => void; onPause: () => void }) {
  const cls =
    "pointer-events-auto flex items-center justify-center w-14 h-14 rounded-xl border-2 border-pine-600 bg-pine-900/85 text-neon-300 shadow-[0_4px_0_#03150e] active:bg-pine-700 active:translate-y-0.5 transition-[transform,background] duration-75";
  const press = (fn: () => void) => (e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    fn();
  };
  return (
    <div
      className="absolute bottom-3 right-3 z-10 pb-safe pointer-events-none"
      style={{ touchAction: "none" }}
    >
      <div className="grid grid-cols-3 gap-1.5 opacity-90">
        <div />
        <button className={cls} onPointerDown={press(() => onDir("up"))} aria-label="Up">
          <IconChevron className="w-7 h-7" />
        </button>
        <div />
        <button className={cls} onPointerDown={press(() => onDir("left"))} aria-label="Left">
          <IconChevron className="w-7 h-7 -rotate-90" />
        </button>
        <button className={cls} onPointerDown={press(onPause)} aria-label="Pause">
          <IconPause className="w-5 h-5" />
        </button>
        <button className={cls} onPointerDown={press(() => onDir("right"))} aria-label="Right">
          <IconChevron className="w-7 h-7 rotate-90" />
        </button>
        <div />
        <button className={cls} onPointerDown={press(() => onDir("down"))} aria-label="Down">
          <IconChevron className="w-7 h-7 rotate-180" />
        </button>
        <div />
      </div>
    </div>
  );
}

/* ------------------------------------------------- screens */

/* ------------------------------------------------- arcade extras UI */

export function ComboBadge({
  combo,
  mult,
  fever,
}: {
  combo: number;
  mult: number;
  fever: boolean;
}) {
  if (combo < 2) return null;
  return (
    <div
      className={cn(
        "panel px-2.5 py-1.5 flex items-center gap-2",
        fever && "border-gold-300"
      )}
    >
      <span
        key={combo}
        className={cn(
          "anim-pop font-display text-sm leading-none",
          fever ? "text-gold-300" : "text-neon-300"
        )}
      >
        COMBO ×{combo}
      </span>
      <span className="text-[10px] font-bold text-milk-dim tabular">×{mult.toFixed(2)}</span>
    </div>
  );
}

/** Generic countdown pill used by Fever + Magnet. */
export function PowerBadge({
  label,
  endsAt,
  duration,
  from,
  to,
}: {
  label: string;
  endsAt: number;
  duration: number;
  from: string;
  to: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, endsAt - performance.now());
      const p = Math.max(0, Math.min(1, left / (duration * 1000)));
      if (barRef.current) barRef.current.style.width = `${(p * 100).toFixed(1)}%`;
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [endsAt, duration]);
  return (
    <div
      className="rainbow-in rounded-[10px] px-3 py-1.5 bg-pine-900/95 border-2 border-pine-600 shadow-[0_4px_0_#03150e]"
      style={{ borderColor: to }}
    >
      <div
        className="font-display text-[13px] leading-none mb-1.5"
        style={{ color: to, textShadow: "0 2px 0 #06301d" }}
      >
        {label}
      </div>
      <div className="h-1.5 w-28 sm:w-32 rounded-full bg-pine-800 overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
        />
      </div>
    </div>
  );
}

export function AchievementToast({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="rise-in panel px-3 py-2 flex items-center gap-2.5 !border-gold-400">
      <span className="text-lg leading-none">{icon}</span>
      <div className="text-left">
        <div className="text-[8px] font-bold tracking-[0.2em] text-gold-400 leading-none">
          ACHIEVEMENT UNLOCKED
        </div>
        <div className="font-display text-[11px] text-milk mt-1">{name}</div>
      </div>
    </div>
  );
}

export function NearMissPop() {
  return (
    <div
      className="float-up font-display text-sm text-neon-300"
      style={{ textShadow: "0 2px 0 #06301d, 0 0 12px rgba(46,232,141,0.6)" }}
    >
      CLOSE!
    </div>
  );
}

function MuteButton({ muted, onToggleMute }: { muted: boolean; onToggleMute: () => void }) {
  return (
    <button
      className="btn btn-ghost p-2.5 absolute top-3 right-3 z-30"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
      onClick={(e) => {
        e.stopPropagation();
        onToggleMute();
      }}
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? <IconSoundOff className="w-4 h-4" /> : <IconSoundOn className="w-4 h-4" />}
    </button>
  );
}

export function StartScreen({
  scores,
  muted,
  onStart,
  onToggleMute,
  isTouch,
}: {
  scores: ScoreEntry[];
  muted: boolean;
  onStart: () => void;
  onToggleMute: () => void;
  isTouch: boolean;
}) {
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-pine-950/55" onClick={onStart}>
      <MuteButton muted={muted} onToggleMute={onToggleMute} />
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-4xl grid md:grid-cols-[1.15fr_0.85fr] gap-5 md:gap-8 items-center">
          {/* left — title & start */}
          <div className="rise-in text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-md border-2 border-pine-600 bg-pine-900/90 px-2.5 py-1 text-[10px] font-bold tracking-[0.3em] text-neon-300">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-400 animate-pulse" />
              3D SNAKE ARCADE
            </div>
            <h1 className="title-arcade font-display text-6xl sm:text-7xl md:text-8xl leading-[0.95] mt-3 -rotate-1">
              SARP
            </h1>
            <p className="font-display text-neon-300 text-xs sm:text-sm tracking-[0.22em] mt-2">
              EAT · GROW · DON&apos;T CRASH
            </p>
            <p className="text-[10px] font-bold tracking-[0.3em] text-gold-400/80 mt-1.5">
              A GAME BY LAVI
            </p>
            <p className="text-milk-dim text-sm max-w-sm mx-auto md:mx-0 mt-3 leading-relaxed">
              Steer the golden serpent around the garden pit, scarf every apple you
              can, and thread the needle as the pace keeps climbing.
            </p>

            <div className="mt-4 flex items-center gap-2.5 rounded-md border-2 border-pine-600 bg-pine-900/80 px-3 py-2 max-w-sm mx-auto md:mx-0 text-left">
              <span className="w-2.5 h-2.5 rounded-full rainbow-grad rainbow-anim shrink-0" />
              <p className="text-[11px] leading-snug text-milk-dim">
                Every <span className="text-gold-300 font-bold">10th</span> apple (then
                25, 40, 55 …) spawns a{" "}
                <span className="font-bold rainbow-text inline-block">RAINBOW APPLE</span>{" "}
                — eat it for 10 seconds of disco speed and immortality.
              </p>
            </div>

            <div className="mt-6 flex flex-col items-center md:items-start gap-3">
              <button
                className="btn btn-gold pulse-glow text-base sm:text-lg px-8 py-3.5"
                onClick={(e: RMouseEvent) => {
                  e.stopPropagation();
                  onStart();
                }}
              >
                <IconPlay className="w-5 h-5" />
                START SLITHERING
              </button>
              <p className="blink text-[11px] font-bold tracking-[0.25em] text-milk-dim">
                {isTouch ? "OR TAP ANYWHERE · SWIPE TO STEER" : "OR PRESS ANY ARROW KEY"}
              </p>
            </div>

            <div className="panel p-3 mt-6 max-w-sm mx-auto md:mx-0 text-left">
              {isTouch ? (
                <div className="text-xs text-milk-dim space-y-1.5">
                  <p>
                    <span className="font-bold text-neon-300">SWIPE</span> anywhere to
                    steer — chain swipes for sharp turns.
                  </p>
                  <p>
                    Or use the <span className="font-bold text-neon-300">D-PAD</span> in
                    the corner. Center button pauses.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs text-milk-dim items-center">
                  <span className="flex gap-1">
                    <KeyCap>↑↓←→</KeyCap>
                    <KeyCap>WASD</KeyCap>
                  </span>
                  <span>Steer the serpent</span>
                  <span className="flex gap-1">
                    <KeyCap>SPACE</KeyCap>
                    <KeyCap>P</KeyCap>
                  </span>
                  <span>Pause / resume</span>
                  <span className="flex gap-1">
                    <KeyCap>R</KeyCap>
                  </span>
                  <span>Instant restart</span>
                  <span className="flex gap-1">
                    <KeyCap>M</KeyCap>
                  </span>
                  <span>Sound on / off</span>
                </div>
              )}
            </div>
          </div>

          {/* right — high scores */}
          <div
            className="panel p-4 rise-in"
            style={{ animationDelay: "120ms" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-gold-400 mb-2">
              <IconTrophy className="w-4 h-4" />
              <h2 className="font-display text-sm tracking-[0.2em]">HIGH SCORES</h2>
              <span className="ml-auto text-[10px] text-milk-dim font-semibold">TOP 5</span>
            </div>
            <ScoreTable scores={scores} limit={5} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PauseScreen({
  score,
  onResume,
  onRestart,
  onQuit,
}: {
  score: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-pine-950/60">
      <div className="panel w-full max-w-xs p-5 text-center rise-in">
        <h2 className="title-green font-display text-3xl tracking-wide">PAUSED</h2>
        <p className="text-milk-dim text-sm mt-1.5">
          Score so far: <span className="text-gold-300 font-bold tabular">{score.toLocaleString()}</span>
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <button className="btn btn-gold px-4 py-3 text-sm" onClick={onResume}>
            <IconPlay className="w-4 h-4" />
            RESUME
            <KeyCap>SPACE</KeyCap>
          </button>
          <button className="btn btn-green px-4 py-3 text-sm" onClick={onRestart}>
            <IconRestart className="w-4 h-4" />
            RESTART
            <KeyCap>R</KeyCap>
          </button>
          <button className="btn btn-ghost px-4 py-3 text-sm" onClick={onQuit}>
            <IconHome className="w-4 h-4" />
            QUIT TO MENU
            <KeyCap>Q</KeyCap>
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen({
  score,
  apples,
  length,
  isNewBest,
  scores,
  highlightId,
  onRestart,
  onQuit,
}: {
  score: number;
  apples: number;
  length: number;
  isNewBest: boolean;
  scores: ScoreEntry[];
  highlightId: string | null;
  onRestart: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-pine-950/70">
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="panel w-full max-w-md p-5 sm:p-6 text-center rise-in">
          <h2 className="title-red font-display text-4xl sm:text-5xl -rotate-1">WRECKED!</h2>
          <p className="text-milk-dim text-sm mt-1.5">The serpent has met the wall.</p>

          {isNewBest && (
            <div className="badge-in inline-flex items-center gap-1.5 mt-3 rounded-md bg-gold-400 text-[#2b1a02] font-display text-xs px-3 py-1.5 shadow-[0_4px_0_#9c6b0a]">
              <IconTrophy className="w-4 h-4" />
              NEW HIGH SCORE
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="panel px-2 py-2.5">
              <div className="text-[9px] font-bold tracking-[0.2em] text-milk-dim">SCORE</div>
              <div className="font-display text-xl text-gold-400 tabular mt-0.5">
                {score.toLocaleString()}
              </div>
            </div>
            <div className="panel px-2 py-2.5">
              <div className="text-[9px] font-bold tracking-[0.2em] text-milk-dim">APPLES</div>
              <div className="font-display text-xl text-apple-400 tabular mt-0.5 flex items-center justify-center gap-1">
                <IconApple className="w-4 h-4" />
                {apples}
              </div>
            </div>
            <div className="panel px-2 py-2.5">
              <div className="text-[9px] font-bold tracking-[0.2em] text-milk-dim">LENGTH</div>
              <div className="font-display text-xl text-neon-300 tabular mt-0.5">{length}</div>
            </div>
          </div>

          <div className="mt-4 text-left">
            <div className="flex items-center gap-2 text-gold-400 mb-1.5 justify-center">
              <IconTrophy className="w-4 h-4" />
              <h3 className="font-display text-xs tracking-[0.2em]">LOCAL LEGENDS</h3>
            </div>
            <ScoreTable scores={scores} limit={5} highlightId={highlightId} />
          </div>

          <div className="flex gap-2 mt-5">
            <button className="btn btn-gold flex-1 px-4 py-3 text-sm" onClick={onRestart}>
              <IconRestart className="w-4 h-4" />
              PLAY AGAIN
              <span className="font-sans text-[10px] font-bold bg-black/15 rounded px-1.5 py-0.5">R</span>
            </button>
            <button className="btn btn-ghost px-4 py-3 text-sm" onClick={onQuit}>
              <IconHome className="w-4 h-4" />
              MENU
            </button>
          </div>
          <p className="blink text-[10px] font-bold tracking-[0.25em] text-milk-dim mt-3">
            PRESS SPACE TO RESTART
          </p>
        </div>
      </div>
    </div>
  );
}
