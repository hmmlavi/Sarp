export interface ScoreEntry {
  id: string;
  score: number;
  apples: number;
  len: number;
  date: number;
}

const LS_KEY = "serpent3d.scores.v1";
const MAX_ENTRIES = 8;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => typeof e?.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveScore(entry: ScoreEntry): { list: ScoreEntry[]; rank: number } {
  const list = [...loadScores(), entry]
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  const rank = list.findIndex((e) => e.id === entry.id);
  return { list, rank };
}

export function bestScore(): number {
  const l = loadScores();
  return l.length ? l[0].score : 0;
}

export function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}
