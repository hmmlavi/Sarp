import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Guest session required" }, 401);
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const user = authData.user;
    if (authError || !user || user.is_anonymous !== true) {
      return json({ error: "A valid guest session is required" }, 401);
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    if (body?.action === "profile_get") {
      const { data, error } = await admin.from("sarp_players").select("id, username, created_at, updated_at").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return json({ profile: data });
    }
    if (body?.action === "profile_save") {
      const username = typeof body.username === "string" ? body.username.trim() : "";
      if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return json({ error: "Username must be 3–16 characters using letters, numbers, or _." }, 400);
      const { data, error } = await admin.from("sarp_players").upsert({ id: user.id, username }, { onConflict: "id" }).select("id, username, created_at, updated_at").single();
      if (error) {
        if (String(error.message).toLowerCase().includes("username")) return json({ error: "That username is not allowed. Please choose another." }, 400);
        throw error;
      }
      return json({ profile: data });
    }
    if (body?.action === "leaderboard") {
      const period = body.period === "weekly" ? "weekly" : "all_time";
      const { data, error } = await authClient.rpc("sarp_get_leaderboard", { p_period: period });
      if (error) throw error;
      return json({ entries: data ?? [] });
    }
    if (body?.action === "submit_score") {
      const score = Number(body.score), apples = Number(body.apples), playerLength = Number(body.length);
      if (![score, apples, playerLength].every(Number.isSafeInteger) || score < 1 || score > 10000000 || apples < 1 || apples > 100000 || playerLength < 1 || playerLength > 100001) {
        return json({ error: "Score submission failed validation." }, 400);
      }
      const { data: profile, error: profileError } = await admin.from("sarp_players").select("id").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return json({ error: "Choose a username before submitting a score." }, 409);
      const { data, error } = await admin.rpc("sarp_submit_score", { p_player_id: user.id, p_score: score, p_apples: apples, p_player_length: playerLength });
      if (error) {
        if (error.message.includes("wait before")) return json({ error: "Please wait before submitting another score." }, 429);
        if (error.message.includes("Invalid score")) return json({ error: "Score submission failed validation." }, 400);
        throw error;
      }
      return json({ result: data });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("sarp-leaderboard error:", error);
    return json({ error: "Leaderboard unavailable. Please try again." }, 500);
  }
});
