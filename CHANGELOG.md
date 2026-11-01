# Changelog

## 1.1.1 — 2026-11-01

### Fixed
- Nickname fields now accept normal typing without game keyboard shortcuts intercepting letters.
- Removed the unnecessary cooldown when changing a guest username.

### Improved
- Completed-run score submissions update global personal-best rankings.
- Game Over now shows the global leaderboard while local scores remain available on the menu.
- Improved nickname input behavior and guest-auth failure handling.

## 1.1.0 — 2026-11-01

### Added
- Worldwide all-time and weekly leaderboards.
- Guest player profiles with editable public usernames; no email or password required.
- Top 10 rankings plus each guest's own world rank.
- Dense ranking for tied scores, with earlier achieved scores listed first.
- Weekly leaderboard rollover every Monday at 00:00 UTC.
- Server-side username moderation and score-submission validation.
- A retryable unavailable state that keeps local gameplay and scores independent from the online service.

### Unchanged
- Existing local scores and achievements remain stored locally and are not migrated.
- Guest profiles cannot be recovered after browser data is cleared or when switching devices.
