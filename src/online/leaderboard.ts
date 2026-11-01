const SUPABASE_URL = "https://vojpdcdcjkaejxqydwck.supabase.co";
const SUPABASE_KEY = "sb_publishable_XO1yMGkRMpnY3DOJ3dRF6w_uiqu3DqS";
const SESSION_KEY = "sarp.guest-session.v1";

export interface GuestProfile {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}
export interface GlobalScore {
  rank: number;
  username: string;
  score: number;
  achieved_at: string;
  is_you: boolean;
}
interface GuestSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; is_anonymous?: boolean };
}

function readSession(): GuestSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as GuestSession) : null;
  } catch {
    return null;
  }
}
function storeSession(session: GuestSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function normalizeSession(value: any): GuestSession {
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: value.expires_at ?? Math.floor(Date.now() / 1000) + (value.expires_in ?? 3600),
    user: value.user,
  };
}

async function getGuestSession(): Promise<GuestSession> {
  let session = readSession();
  if (session && session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;

  if (session?.refresh_token) {
    const refreshed = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (refreshed.ok) {
      session = normalizeSession(await refreshed.json());
      storeSession(session);
      return session;
    }
    localStorage.removeItem(SESSION_KEY);
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ data: {} }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.msg || payload.message || "Guest sign-in is unavailable.");
  }
  const created = normalizeSession(await response.json());
  if (!created.access_token || !created.refresh_token || !created.user?.id) {
    throw new Error("Guest sign-in did not return a session.");
  }
  storeSession(created);
  return created;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const session = await getGuestSession();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sarp-leaderboard`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Leaderboard unavailable.");
  return payload as T;
}

export async function getGuestProfile() {
  const result = await call<{ profile: GuestProfile | null }>({ action: "profile_get" });
  return result.profile;
}
export async function saveGuestUsername(username: string) {
  const result = await call<{ profile: GuestProfile }>({ action: "profile_save", username });
  return result.profile;
}
export async function getGlobalLeaderboard(period: "all_time" | "weekly") {
  const result = await call<{ entries: GlobalScore[] }>({ action: "leaderboard", period });
  return result.entries;
}
export async function submitGlobalScore(score: number, apples: number, length: number) {
  return call<{ result: { all_time_improved: boolean; weekly_improved: boolean } }>({
    action: "submit_score", score, apples, length,
  });
}
