import { useCallback, useEffect, useRef, useState } from "react";
import { SnakeEngine, RAINBOW_DURATION, type DirName, type EngineEvent } from "./game/engine";
import { ensureAudio, isMuted, toggleMuted, sfx } from "./game/audio";
import { loadScores, saveScore, makeId, type ScoreEntry } from "./game/scores";
import { MusicEngine, type MusicMood } from "./game/music";
import { loadUnlocked, unlock, achievementById } from "./game/achievements";
import { STAGE_DUR } from "./game/worldfx";
import { cn } from "./utils/cn";
import { getGuestProfile, saveGuestUsername, getGlobalLeaderboard, submitGlobalScore, type GuestProfile, type GlobalScore } from "./online/leaderboard";
import { UsernamePanel, LeaderboardPanel } from "./online/LeaderboardPanels";
import {
  StartScreen,
  PauseScreen,
  GameOverScreen,
  HUD,
  DPad,
  RainbowHud,
  ComboBadge,
  PowerBadge,
  AchievementToast,
  NearMissPop,
} from "./ui";

type Screen = "menu" | "playing" | "paused" | "over";

interface Popup {
  id: number;
  text: string;
  rainbow?: boolean;
  skin?: boolean;
}

interface AchToast {
  id: number;
  name: string;
  icon: string;
}

let popupSeq = 0;

const KEY_DIRS: Record<string, DirName> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);

  const [screen, setScreen] = useState<Screen>("menu");
  const [score, setScore] = useState(0);
  const [apples, setApples] = useState(0);
  const [streak, setStreak] = useState(0); // streak === combo counter
  const [mult, setMult] = useState(1);
  const [speedPct, setSpeedPct] = useState(0);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [usernameValue, setUsernameValue] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"all_time" | "weekly">("all_time");
  const [globalEntries, setGlobalEntries] = useState<GlobalScore[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [leaderboardError, setLeaderboardError] = useState("");
  const [onlineNotice, setOnlineNotice] = useState("");
  const [finalStats, setFinalStats] = useState({ score: 0, apples: 0, length: 4 });
  const [isNewBest, setIsNewBest] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());
  const [popups, setPopups] = useState<Popup[]>([]);
  const [flashKey, setFlashKey] = useState(0);
  const [isTouch] = useState(
    () => window.matchMedia?.("(pointer: coarse)").matches ?? false
  );

  // rainbow mode
  const [rainbowEndsAt, setRainbowEndsAt] = useState<number | null>(null);
  const [rainbowFlashKey, setRainbowFlashKey] = useState(0);

  // fever + magnet power badges
  const [feverEndsAt, setFeverEndsAt] = useState<number | null>(null);
  const [feverDur, setFeverDur] = useState(9);
  const [magnetEndsAt, setMagnetEndsAt] = useState<number | null>(null);
  const [magnetDur, setMagnetDur] = useState(8);

  // feedback
  const [nearMiss, setNearMiss] = useState<number[]>([]);
  const [achToasts, setAchToasts] = useState<AchToast[]>([]);
  const [stageKind, setStageKind] = useState<"none" | "space" | "lava">("none");

  const screenRef = useRef<Screen>(screen);
  screenRef.current = screen;
  const swipeRef = useRef<{ x: number; y: number; id: number } | null>(null);

  // paused-run remainders so pause freezes every countdown, not just rainbow
  const rainbowRemain = useRef<number | null>(null);
  const feverRemain = useRef<number | null>(null);
  const magnetRemain = useRef<number | null>(null);

  const musicRef = useRef<MusicEngine | null>(null);
  const unlockedRef = useRef<Set<string>>(loadUnlocked());
  const stageTimer = useRef<number | null>(null);

  /* ---------------- achievements ---------------- */

  const award = useCallback((id: string) => {
    if (!unlock(id, unlockedRef.current)) return;
    const a = achievementById(id);
    const tid = ++popupSeq;
    setAchToasts((t) => [...t.slice(-2), { id: tid, name: a.name, icon: a.icon }]);
    window.setTimeout(() => setAchToasts((t) => t.filter((x) => x.id !== tid)), 2900);
  }, []);

  /* ---------------- engine event handling ---------------- */

  const eventHandlerRef = useRef<(e: EngineEvent) => void>(() => {});
  eventHandlerRef.current = (e: EngineEvent) => {
    if (e.type === "eat") {
      setScore(e.score);
      setApples(e.apples);
      setStreak(e.streak);
      setMult(e.mult);
      setSpeedPct(e.speedPct);
      const id = ++popupSeq;
      setPopups((p) => [...p.slice(-4), { id, text: `+${e.gained}` }]);
      window.setTimeout(
        () => setPopups((p) => p.filter((x) => x.id !== id)),
        900
      );
      if (e.apples >= 1) award("first_bite");
      if (e.apples >= 50) award("apple_hunter");
      if (e.apples >= 100) award("hundred_club");
      if (e.streak >= 5) award("combo_starter");
    } else if (e.type === "rainboweat") {
      setScore(e.score);
      const id = ++popupSeq;
      setPopups((p) => [...p.slice(-4), { id, text: `+${e.gained} RAINBOW`, rainbow: true }]);
      window.setTimeout(
        () => setPopups((p) => p.filter((x) => x.id !== id)),
        1100
      );
      award("rainbow_hunter");
    } else if (e.type === "rainbowstart") {
      rainbowRemain.current = null;
      setRainbowEndsAt(performance.now() + e.duration * 1000);
      setRainbowFlashKey((f) => f + 1);
    } else if (e.type === "rainbowend") {
      setRainbowEndsAt(null);
      award("speed_demon");
    } else if (e.type === "golden") {
      setScore(e.score);
      const id = ++popupSeq;
      setPopups((p) => [...p.slice(-4), { id, text: `+${e.gained} GOLDEN`, rainbow: true }]);
      window.setTimeout(
        () => setPopups((p) => p.filter((x) => x.id !== id)),
        1200
      );
      award("golden_touch");
    } else if (e.type === "magnetstart") {
      setMagnetDur(e.duration);
      setMagnetEndsAt(performance.now() + e.duration * 1000);
    } else if (e.type === "magnetend") {
      setMagnetEndsAt(null);
    } else if (e.type === "feverstart") {
      setFeverDur(e.duration);
      setFeverEndsAt(performance.now() + e.duration * 1000);
      award("fever_time");
    } else if (e.type === "feverend") {
      setFeverEndsAt(null);
      award("speed_demon");
    } else if (e.type === "combo") {
      setStreak(e.combo);
    } else if (e.type === "nearmiss") {
      const id = ++popupSeq;
      setNearMiss((p) => [...p.slice(-1), id]);
      window.setTimeout(() => setNearMiss((p) => p.filter((x) => x !== id)), 900);
    } else if (e.type === "stage") {
      setStageKind(e.kind);
      if (stageTimer.current) window.clearTimeout(stageTimer.current);
      stageTimer.current = window.setTimeout(() => setStageKind("none"), STAGE_DUR * 1000);
    } else if (e.type === "skin") {
      const id = ++popupSeq;
      setPopups((p) => [...p.slice(-4), { id, text: e.name.toUpperCase(), skin: true }]);
      window.setTimeout(
        () => setPopups((p) => p.filter((x) => x.id !== id)),
        1600
      );
    } else if (e.type === "gameover") {
      setRainbowEndsAt(null);
      setFeverEndsAt(null);
      setMagnetEndsAt(null);
      setStageKind("none");
      rainbowRemain.current = null;
      feverRemain.current = null;
      magnetRemain.current = null;
      musicRef.current?.stop();
      setFinalStats({ score: e.score, apples: e.apples, length: e.length });
      const entry: ScoreEntry = {
        id: makeId(),
        score: e.score,
        apples: e.apples,
        len: e.length,
        date: Date.now(),
      };
      const { list, rank } = saveScore(entry);
      setScores(list);
      const best = rank === 0 && e.score > 0;
      setIsNewBest(best);
      setFlashKey((f) => f + 1);
      setScreen("over");
      if (best) sfx.best();
      else sfx.over();

      // Submit every completed run; the server keeps only personal-best improvements.
      if (guestProfile) {
        setLeaderboardStatus("loading");
        void submitGlobalScore(e.score, e.apples, e.length)
          .then(() => getGlobalLeaderboard("all_time"))
          .then((entries) => {
            setGlobalEntries(entries);
            setLeaderboardStatus("ready");
          })
          .catch((error) => {
            setLeaderboardStatus("error");
            setLeaderboardError(error instanceof Error ? error.message : "Leaderboard unavailable.");
          });
      }
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      setLeaderboardStatus("loading");
      try {
        const profile = await getGuestProfile();
        const entries = await getGlobalLeaderboard("all_time");
        if (!active) return;
        setGuestProfile(profile);
        setGlobalEntries(entries);
        setLeaderboardStatus("ready");
      } catch (error) {
        if (!active) return;
        setLeaderboardStatus("error");
        setLeaderboardError(error instanceof Error ? error.message : "Leaderboard unavailable.");
      }
    })();
    return () => { active = false; };
  }, []);

  /* ---------------- music ---------------- */

  useEffect(() => {
    musicRef.current = new MusicEngine();
    return () => {
      musicRef.current?.dispose();
      musicRef.current = null;
      if (stageTimer.current) window.clearTimeout(stageTimer.current);
    };
  }, []);

  useEffect(() => {
    musicRef.current?.setMuted(muted);
  }, [muted]);

  // single priority order — the engine lerps between moods, so no hard cuts
  useEffect(() => {
    const m = musicRef.current;
    if (!m) return;
    let mood: MusicMood = "normal";
    if (rainbowEndsAt !== null) mood = "rainbow";
    else if (feverEndsAt !== null) mood = "fever";
    else if (stageKind === "space") mood = "space";
    else if (stageKind === "lava") mood = "lava";
    else if (streak >= 3) mood = "combo";
    m.setMood(mood);
  }, [rainbowEndsAt, feverEndsAt, stageKind, streak]);

  /* ---------------- actions ---------------- */

  const startGame = useCallback((dir?: DirName) => {
    ensureAudio();
    (document.activeElement as HTMLElement | null)?.blur?.();
    const engine = engineRef.current;
    if (!engine) return;
    engine.startRun();
    if (dir) engine.queueDir(dir);
    setScore(0);
    setApples(0);
    setStreak(0);
    setMult(1);
    setSpeedPct(0);
    setPopups([]);
    rainbowRemain.current = null;
    feverRemain.current = null;
    magnetRemain.current = null;
    setRainbowEndsAt(null);
    setFeverEndsAt(null);
    setMagnetEndsAt(null);
    setStageKind("none");
    setScreen("playing");
    sfx.start();
    musicRef.current?.setMood("normal");
    musicRef.current?.setMuted(isMuted());
    musicRef.current?.start();
  }, []);

  const freezeTimers = useCallback(() => {
    const now = performance.now();
    setRainbowEndsAt((v) => {
      if (v !== null) rainbowRemain.current = Math.max(0, v - now);
      return null;
    });
    setFeverEndsAt((v) => {
      if (v !== null) feverRemain.current = Math.max(0, v - now);
      return null;
    });
    setMagnetEndsAt((v) => {
      if (v !== null) magnetRemain.current = Math.max(0, v - now);
      return null;
    });
  }, []);

  const thawTimers = useCallback(() => {
    const now = performance.now();
    if (rainbowRemain.current !== null) {
      setRainbowEndsAt(now + rainbowRemain.current);
      rainbowRemain.current = null;
    }
    if (feverRemain.current !== null) {
      setFeverEndsAt(now + feverRemain.current);
      feverRemain.current = null;
    }
    if (magnetRemain.current !== null) {
      setMagnetEndsAt(now + magnetRemain.current);
      magnetRemain.current = null;
    }
  }, []);

  const pauseGame = useCallback(() => {
    engineRef.current?.pause();
    freezeTimers();
    setScreen("paused");
    sfx.click();
  }, [freezeTimers]);

  const resumeGame = useCallback(() => {
    ensureAudio();
    engineRef.current?.resume();
    thawTimers();
    setScreen("playing");
    sfx.click();
  }, [thawTimers]);

  const quitToMenu = useCallback(() => {
    engineRef.current?.startDemo();
    rainbowRemain.current = null;
    feverRemain.current = null;
    magnetRemain.current = null;
    setRainbowEndsAt(null);
    setFeverEndsAt(null);
    setMagnetEndsAt(null);
    setStageKind("none");
    musicRef.current?.stop();
    setScreen("menu");
    sfx.click();
  }, []);

  const doToggleMute = useCallback(() => {
    const m = toggleMuted();
    setMutedState(m);
    if (!m) {
      ensureAudio();
      sfx.click();
    }
  }, []);

  const queueDir = useCallback((d: DirName) => {
    ensureAudio();
    engineRef.current?.queueDir(d);
  }, []);

  const handleStart = useCallback(async () => {
    setOnlineNotice("");
    let profile: GuestProfile | null;
    try {
      profile = await getGuestProfile();
      setGuestProfile(profile);
    } catch (error) {
      setOnlineNotice(error instanceof Error ? error.message : "Leaderboard unavailable.");
      return;
    }

    if (!profile) {
      setUsernameValue("");
      setUsernameError("");
      setPendingStart(true);
      setUsernameOpen(true);
      return;
    }

    startGame();
  }, [startGame]);

  const handleEditUsername = useCallback(async () => {
    setUsernameError("");
    try {
      const profile = await getGuestProfile();
      setGuestProfile(profile);
      setUsernameValue(profile?.username ?? "");
      setPendingStart(false);
      setUsernameOpen(true);
    } catch (error) {
      setOnlineNotice(error instanceof Error ? error.message : "Leaderboard unavailable.");
    }
  }, []);

  const handleSaveUsername = useCallback(async () => {
    setUsernameSaving(true);
    setUsernameError("");
    try {
      const profile = await saveGuestUsername(usernameValue);
      setGuestProfile(profile);
      setUsernameOpen(false);
      if (pendingStart) startGame();
      setPendingStart(false);
    } catch (error) {
      setUsernameError(error instanceof Error ? error.message : "Could not save username.");
    } finally {
      setUsernameSaving(false);
    }
  }, [usernameValue, pendingStart, startGame]);

  const loadGlobalScores = useCallback(async (period = leaderboardPeriod) => {
    setLeaderboardStatus("loading");
    setLeaderboardError("");
    try {
      const profile = await getGuestProfile();
      setGuestProfile(profile);
      const entries = await getGlobalLeaderboard(period);
      setGlobalEntries(entries);
      setLeaderboardStatus("ready");
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : "Leaderboard unavailable.");
      setLeaderboardStatus("error");
    }
  }, [leaderboardPeriod]);

  const openLeaderboard = useCallback(() => {
    setLeaderboardOpen(true);
    void loadGlobalScores(leaderboardPeriod);
  }, [loadGlobalScores, leaderboardPeriod]);

  const actionsRef = useRef({ startGame, pauseGame, resumeGame, quitToMenu });
  actionsRef.current = { startGame, pauseGame, resumeGame, quitToMenu };

  /* ---------------- engine mount ---------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new SnakeEngine(canvas, (e) => eventHandlerRef.current(e));
    engineRef.current = engine;
    engine.startDemo();

    const onResize = () => engine.resize(window.innerWidth, window.innerHeight);
    const autoPause = () => {
      if (screenRef.current === "playing") actionsRef.current.pauseGame();
    };
    const onVis = () => {
      if (document.hidden) autoPause();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", autoPause);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", autoPause);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      ensureAudio();
      const dir = KEY_DIRS[e.key];
      const k = e.key;
      if (screen === "menu") {
        if (dir) {
          e.preventDefault();
          void handleStart();
        } else if (k === " " || k === "Enter") {
          e.preventDefault();
          if (!e.repeat) void handleStart();
        } else if (k === "m" || k === "M") doToggleMute();
      } else if (screen === "playing") {
        if (dir) {
          e.preventDefault();
          engineRef.current?.queueDir(dir);
        } else if (k === " " || k === "p" || k === "P" || k === "Escape") {
          e.preventDefault();
          if (!e.repeat) pauseGame();
        } else if (k === "r" || k === "R") {
          e.preventDefault();
          startGame();
        } else if (k === "m" || k === "M") doToggleMute();
      } else if (screen === "paused") {
        if (dir) {
          e.preventDefault();
          resumeGame();
          engineRef.current?.queueDir(dir);
        } else if (k === " " || k === "p" || k === "P" || k === "Escape" || k === "Enter") {
          e.preventDefault();
          if (!e.repeat) resumeGame();
        } else if (k === "r" || k === "R") {
          e.preventDefault();
          startGame();
        } else if (k === "q" || k === "Q") quitToMenu();
        else if (k === "m" || k === "M") doToggleMute();
      } else {
        // game over
        if (k === " " || k === "Enter" || k === "r" || k === "R") {
          e.preventDefault();
          if (!e.repeat) startGame();
        } else if (k === "Escape" || k === "q" || k === "Q") quitToMenu();
        else if (k === "m" || k === "M") doToggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, startGame, handleStart, pauseGame, resumeGame, quitToMenu, doToggleMute]);

  /* ---------------- swipe steering ---------------- */

  const onPointerDown = (e: React.PointerEvent) => {
    ensureAudio();
    if (screenRef.current !== "playing") return;
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipeRef.current;
    if (!s || s.id !== e.pointerId || screenRef.current !== "playing") return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    const dir: DirName =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    engineRef.current?.queueDir(dir);
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerEnd = () => {
    swipeRef.current = null;
  };

  const best = scores.length ? scores[0].score : 0;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-pine-950"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block h-full w-full" />

      {/* atmosphere overlays */}
      <div
        className="absolute inset-0 z-[5] pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 92% at 50% 42%, transparent 55%, rgba(2,10,7,0.6) 100%), linear-gradient(rgba(46,232,141,0.05), transparent 18%)",
        }}
      />
      <div
        className="absolute inset-0 z-[6] pointer-events-none opacity-[0.05]"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(200,255,225,0.7) 0 1px, transparent 1px 4px)",
        }}
      />

      {/* death flash */}
      {flashKey > 0 && (
        <div key={flashKey} className="death-flash absolute inset-0 z-30 pointer-events-none" />
      )}

      {/* rainbow mode activation flash */}
      {rainbowFlashKey > 0 && (
        <div
          key={`rb-${rainbowFlashKey}`}
          className="rainbow-flash absolute inset-0 z-30 pointer-events-none"
        />
      )}

      {/* HUD */}
      {(screen === "playing" || screen === "paused") && (
        <HUD
          score={score}
          best={best}
          apples={apples}
          streak={streak}
          speedPct={speedPct}
          rainbow={rainbowEndsAt !== null}
          onPause={screen === "playing" ? pauseGame : resumeGame}
          muted={muted}
          onToggleMute={doToggleMute}
        />
      )}

      {/* Rainbow Mode indicator + countdown */}
      {screen === "playing" && rainbowEndsAt !== null && (
        <RainbowHud endsAt={rainbowEndsAt} duration={RAINBOW_DURATION} />
      )}

      {/* Fever / Magnet power badges */}
      {screen === "playing" && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[10.4rem] z-10 flex flex-col items-center gap-2 pointer-events-none">
          {feverEndsAt !== null && (
            <PowerBadge
              label="FEVER MODE"
              endsAt={feverEndsAt}
              duration={feverDur}
              from="#ffd23f"
              to="#ff5a4e"
            />
          )}
          {magnetEndsAt !== null && (
            <PowerBadge
              label="MAGNET"
              endsAt={magnetEndsAt}
              duration={magnetDur}
              from="#4fd4ff"
              to="#7df9ff"
            />
          )}
        </div>
      )}

      {/* floating score popups */}
      <div className="absolute left-3 top-[5.2rem] sm:top-24 z-10 pointer-events-none">
        {popups.map((p) => (
          <div
            key={p.id}
            className={cn(
              "float-up font-display text-lg",
              p.rainbow && "rainbow-text text-base",
              p.skin && "text-neon-300 text-sm tracking-widest",
              !p.rainbow && !p.skin && "text-gold-300"
            )}
            style={{
              textShadow: p.rainbow
                ? "0 2px 0 #06301d"
                : "0 2px 0 #06301d, 0 0 14px rgba(255,201,60,0.5)",
            }}
          >
            {p.text}
          </div>
        ))}
      </div>

      {/* combo badge (bottom-left, clear of the d-pad) */}
      {screen === "playing" && (
        <div className="absolute left-3 bottom-3 z-10 pointer-events-none">
          <ComboBadge combo={streak} mult={mult} fever={feverEndsAt !== null} />
        </div>
      )}

      {/* near-miss feedback */}
      {screen === "playing" && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[26%] z-10 pointer-events-none">
          {nearMiss.map((id) => (
            <NearMissPop key={id} />
          ))}
        </div>
      )}

      {/* achievement toasts */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-14 z-20 flex flex-col items-center gap-2 pointer-events-none">
        {achToasts.map((t) => (
          <AchievementToast key={t.id} name={t.name} icon={t.icon} />
        ))}
      </div>

      {/* desktop key hints */}
      {screen === "playing" && !isTouch && (
        <div className="absolute bottom-2 inset-x-0 z-10 flex justify-center pointer-events-none">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-milk-dim/60">
            ARROWS / WASD STEER · SPACE PAUSE · R RESTART · M SOUND
          </p>
        </div>
      )}

      {/* touch d-pad */}
      {screen === "playing" && isTouch && <DPad onDir={queueDir} onPause={pauseGame} />}

      {/* screens */}
      {screen === "menu" && (
        <StartScreen
          entries={globalEntries}
          status={leaderboardStatus}
          username={guestProfile?.username ?? null}
          muted={muted}
          onStart={handleStart}
          onToggleMute={doToggleMute}
          isTouch={isTouch}
        />
      )}
      {screen === "menu" && (
        <div className="absolute right-3 top-3 z-30 flex gap-2">
          <button className="btn btn-green px-3 py-2 text-[10px]" onClick={(event) => { event.stopPropagation(); openLeaderboard(); }}>WORLD RANK</button>
          <button className="btn btn-ghost px-3 py-2 text-[10px]" onClick={(event) => { event.stopPropagation(); void handleEditUsername(); }}>{guestProfile ? "EDIT NAME" : "SET NAME"}</button>
        </div>
      )}
      {onlineNotice && screen === "menu" && (
        <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-gold-400/40 bg-pine-900/95 px-3 py-2 text-center text-[10px] text-gold-300">{onlineNotice}</div>
      )}
      {leaderboardOpen && (
        <LeaderboardPanel
          entries={globalEntries}
          period={leaderboardPeriod}
          onPeriodChange={(period) => { setLeaderboardPeriod(period); void loadGlobalScores(period); }}
          onClose={() => setLeaderboardOpen(false)}
          status={leaderboardStatus}
          error={leaderboardError}
          onRefresh={() => { void loadGlobalScores(leaderboardPeriod); }}
          username={guestProfile?.username ?? null}
        />
      )}
      {usernameOpen && (
        <UsernamePanel
          value={usernameValue}
          onChange={setUsernameValue}
          onSave={() => { void handleSaveUsername(); }}
          onClose={() => { setUsernameOpen(false); setPendingStart(false); }}
          error={usernameError}
          saving={usernameSaving}
        />
      )}
      {screen === "paused" && (
        <PauseScreen
          score={score}
          onResume={resumeGame}
          onRestart={() => startGame()}
          onQuit={quitToMenu}
        />
      )}
      {screen === "over" && (
        <GameOverScreen
          score={finalStats.score}
          apples={finalStats.apples}
          length={finalStats.length}
          isNewBest={isNewBest}
          globalEntries={globalEntries}
          globalStatus={leaderboardStatus}
          globalError={leaderboardError}
          onRestart={() => startGame()}
          onQuit={quitToMenu}
        />
      )}
    </div>
  );
}
