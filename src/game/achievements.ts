/** Simple, no-menu achievement list for Sarp. Persisted in localStorage. */

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_bite", name: "First Bite", desc: "Eat your first apple", icon: "🍎" },
  { id: "apple_hunter", name: "Apple Hunter", desc: "Eat 50 apples", icon: "🎯" },
  { id: "golden_touch", name: "Golden Touch", desc: "Eat a Golden Apple", icon: "🥇" },
  { id: "combo_starter", name: "Combo Starter", desc: "Reach Combo x5", icon: "⚡" },
  { id: "fever_time", name: "Fever Time", desc: "Activate Fever Mode", icon: "🔥" },
  { id: "rainbow_hunter", name: "Rainbow Hunter", desc: "Eat a Rainbow Apple", icon: "🌈" },
  { id: "speed_demon", name: "Speed Demon", desc: "Survive a Fever or Rainbow event", icon: "💨" },
  { id: "hundred_club", name: "100 Club", desc: "Reach 100 apples", icon: "💯" },
];

const LS_KEY = "sarp.achievements.v1";

export function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/** Persist and report whether this is a NEW unlock (for the toast). */
export function unlock(id: string, unlocked: Set<string>): boolean {
  if (unlocked.has(id)) return false;
  unlocked.add(id);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...unlocked]));
  } catch {
    /* ignore */
  }
  return true;
}

export function achievementById(id: string): Achievement {
  return ACHIEVEMENTS.find((a) => a.id === id) ?? ACHIEVEMENTS[0];
}
