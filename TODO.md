# Fantasy Cycling — Backlog

Maintained collaboratively by user + AI. Check off items as they're completed.
Add new items anywhere that feels right — no strict ordering required.

---

## Data & Backend

- [x] **Auto-schedule score snapshots** — GitHub Actions `data-sync.yml`: `take_snapshot` daily at 23:50 UTC
- [x] **Auto-schedule result sync** — GitHub Actions `data-sync.yml`: `sync_results` hourly, `sync_riders` + `sync_photos` weekly (Sunday)
- [ ] **Draft deadline / auto-lock** — add a `draft_deadline` date to settings (env var or DB config); auto-lock all unlocked teams after that date so the game is fair for multi-player leagues
- [x] **push_results local script** — `scripts/push_results.py` + `/api/admin/push-results/` endpoint; run locally to push race breakdown data (PCS blocks cloud IPs)
- [ ] **Admin UI for sync triggers** — replace the raw API secret-key endpoint with a Django admin action or a small protected page so syncs can be triggered without `curl`

---

## Frontend Features

- [ ] **Score delta widget** — show how many points each team gained this week on the leaderboard and team page (requires at least two snapshots to diff)
- [ ] **Rank movement arrows** — show +/- rank changes (↑2, ↓1) on the leaderboard since last snapshot
- [ ] **Top performers page/section** — surface the `/api/riders/top-performers/` endpoint in the UI (riders with highest score-to-cost ratio); endpoint exists but nothing links to it
- [ ] **Rider dedicated detail page** — `/riders/[id]` page with full season result history, not just the hover tooltip (useful on mobile where tooltip doesn't work)
- [ ] **Mobile touch support for rider details** — `RiderTooltip` uses mouse events only; touch devices get no detail panel

---

## UX & Polish

- [ ] **Share team button** — `/teams/[id]` already works publicly; add a copy-to-clipboard share link button on the team page so users can easily share
- [ ] **Leaderboard rank column** — show explicit rank numbers (1st, 2nd…) with medal icons for top 3
- [ ] **Empty draft state UX** — clearer onboarding flow for new users who land on an empty draft page

---

## Infrastructure / Ops

- [ ] **Deployment guide** — document how to deploy to a real host (Fly.io, Railway, etc.) including env vars, SQLite vs Postgres decision, and scheduler setup
- [ ] **Postgres migration** — SQLite is fine for dev but will need a migration path for production with concurrent users

---

## Ideas / Stretch

- [ ] **Email digest** — weekly email to all users with current standings and top scoring riders that week
- [ ] **Season archive** — view previous years' leaderboards and teams (model already has `year` field)
- [ ] **Budget efficiency leaderboard** — rank teams by `total_score / total_cost` (value-per-point) alongside the main score leaderboard
