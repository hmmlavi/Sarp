import type { GlobalScore } from "./leaderboard";

export function UsernamePanel({
  value,
  onChange,
  onSave,
  onClose,
  error,
  saving,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  error: string;
  saving: boolean;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-pine-950/90 p-4" onClick={onClose}>
      <section className="panel w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
        <p className="font-display text-[10px] tracking-[0.25em] text-neon-300">GUEST PLAYER</p>
        <h2 className="title-green mt-2 font-display text-2xl">CHOOSE YOUR NAME</h2>
        <p className="mt-2 text-sm text-milk-dim">Your name appears on the global leaderboard. No account or personal details needed.</p>
        <input
          type="text"
          autoFocus
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !saving) { event.preventDefault(); onSave(); } }}
          maxLength={16}
          minLength={3}
          placeholder="YourUsername"
          aria-label="Player nickname"
          className="mt-4 w-full pointer-events-auto select-text rounded-lg border-2 border-pine-600 bg-pine-950 px-3 py-3 font-display text-sm text-milk outline-none focus:border-neon-400"
          style={{ userSelect: "text", WebkitUserSelect: "text" }}
        />
        <p className="mt-2 text-[10px] text-milk-dim">3–16 characters · letters, numbers and underscore</p>
        {error && <p role="alert" className="mt-2 text-xs text-apple-400">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn btn-ghost flex-1 px-3 py-3 text-xs" onClick={onClose}>CANCEL</button>
          <button className="btn btn-gold flex-1 px-3 py-3 text-xs" disabled={saving} onClick={onSave}>{saving ? "SAVING…" : "SAVE NAME"}</button>
        </div>
      </section>
    </div>
  );
}

export function LeaderboardPanel({
  entries,
  period,
  onPeriodChange,
  onClose,
  status,
  error,
  onRefresh,
  username,
}: {
  entries: GlobalScore[];
  period: "all_time" | "weekly";
  onPeriodChange: (period: "all_time" | "weekly") => void;
  onClose: () => void;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
  onRefresh: () => void;
  username: string | null;
}) {
  const mine = entries.find((entry) => entry.is_you);
  const top = entries.filter((entry) => entry.rank <= 10);
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-pine-950/95 p-4" onClick={onClose}>
      <section className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center py-6" onClick={(event) => event.stopPropagation()}>
        <div className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-[10px] tracking-[0.25em] text-neon-300">SARP GLOBAL</p>
              <h2 className="title-arcade mt-1 font-display text-3xl">LEADERBOARD</h2>
            </div>
            <button className="btn btn-ghost px-3 py-2 text-xs" onClick={onClose}>CLOSE</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className={period === "all_time" ? "btn btn-gold px-3 py-2 text-xs" : "btn btn-ghost px-3 py-2 text-xs"} onClick={() => onPeriodChange("all_time")}>ALL-TIME</button>
            <button className={period === "weekly" ? "btn btn-gold px-3 py-2 text-xs" : "btn btn-ghost px-3 py-2 text-xs"} onClick={() => onPeriodChange("weekly")}>THIS WEEK</button>
          </div>
          {status === "loading" && <p className="py-10 text-center text-sm text-milk-dim">Loading leaderboard…</p>}
          {status === "error" && (
            <div className="py-8 text-center">
              <p className="font-display text-sm text-gold-300">LEADERBOARD UNAVAILABLE</p>
              <p className="mt-2 text-xs text-milk-dim">{error || "Check your connection and try again."}</p>
              <button className="btn btn-green mt-4 px-4 py-2 text-xs" onClick={onRefresh}>RETRY</button>
            </div>
          )}
          {status === "ready" && (
            <>
              <div className="mt-4 flex items-center gap-2 border-b border-pine-700 px-2 pb-2 text-[9px] font-bold tracking-[0.18em] text-milk-dim">
                <span className="w-10">RANK</span><span className="flex-1">PLAYER</span><span>SCORE</span>
              </div>
              {top.length === 0 && <p className="py-8 text-center text-sm text-milk-dim">No scores yet. Be the first!</p>}
              {top.map((entry) => (
                <div key={entry.rank + ":" + entry.username + ":" + entry.achieved_at} className={`flex items-center gap-2 border-b border-pine-800 px-2 py-3 ${entry.is_you ? "bg-neon-400/10" : ""}`}>
                  <span className="w-10 font-display text-sm text-gold-300">#{entry.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-milk">{entry.username}{entry.is_you ? " (YOU)" : ""}</span>
                  <span className="font-display text-sm tabular text-neon-300">{entry.score.toLocaleString()}</span>
                </div>
              ))}
              {mine && mine.rank > 10 && (
                <div className="mt-3 rounded-lg border border-neon-400/40 bg-neon-400/10 px-3 py-3">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-neon-300">YOUR WORLD RANK</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-bold text-milk">{mine.username}</span>
                    <span className="font-display text-sm text-gold-300">#{mine.rank} · {mine.score.toLocaleString()}</span>
                  </div>
                </div>
              )}
              {!mine && username && <p className="mt-3 text-center text-[10px] text-milk-dim">Play a run to appear on the leaderboard.</p>}
            </>
          )}
          <p className="mt-4 text-center text-[9px] text-milk-dim">Weekly rankings reset every Monday at 00:00 UTC.</p>
        </div>
      </section>
    </div>
  );
}
