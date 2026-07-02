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
- [ ] **Enforce minimum roster size on lock** — `lock` only rejects *empty* teams; a 3-rider team can lock even though the game rules say 20 riders. Decide the rule (exactly 20? at least N?) and validate it in `FantasyTeamViewSet.lock`
- [ ] **Rate-limit auth endpoints** — `register`/`login` have no DRF throttling; add `AnonRateThrottle` (or per-endpoint throttle scopes) to slow brute-force attempts
- [ ] **Move SYNC_SECRET out of query params** — the secret is currently passed as `?secret=` which lands in server/proxy access logs; accept it via an `X-Sync-Secret` header instead (update `data-sync.yml` and push scripts to match)
- [ ] **Leaderboard N+1 queries** — `/api/leaderboard/` and league leaderboards call the `total_score`/`total_cost` properties per team (one aggregate query each) and sort in Python; annotate with `Sum()` and `order_by` in the queryset instead. Matters more as teams grow — pairs with the Postgres item

---

## Frontend Features

- [x] **Score delta widget** — leaderboard (global + league) shows weekly points gained per team; team page has a "since <date>" stat tile diffed against a week-old snapshot
- [x] **Rank movement arrows** — ▲/▼ rank changes vs ~1 week ago on the leaderboard; previous ranks recomputed from snapshot scores within the displayed set so league boards are correct too
- [ ] **Top performers page/section** — surface the `/api/riders/top-performers/` endpoint in the UI (riders with highest score-to-cost ratio); endpoint exists but nothing links to it
- [ ] **Rider dedicated detail page** — `/riders/[id]` page with full season result history, not just the hover tooltip (useful on mobile where tooltip doesn't work)
- [ ] **Mobile touch support for rider details** — `RiderTooltip` uses mouse events only; touch devices get no detail panel

---

## UX & Polish

- [ ] **Share team button** — `/teams/[id]` already works publicly; add a copy-to-clipboard share link button on the team page so users can easily share
- [ ] **Leaderboard rank column** — show explicit rank numbers (1st, 2nd…) with medal icons for top 3
- [ ] **Empty draft state UX** — clearer onboarding flow for new users who land on an empty draft page
- [ ] **Password reset flow** — no way to recover a forgotten password; needs Django's password-reset views (or a token endpoint) plus an email backend
- [ ] **Leave / delete league** — `LeagueViewSet` only supports create, list, retrieve, and join; members can't leave and creators can't delete a league

---

## Infrastructure / Ops

- [ ] **Deployment guide** — document how to deploy to a real host (Fly.io, Railway, etc.) including env vars, SQLite vs Postgres decision, and scheduler setup
- [ ] **Postgres migration** — SQLite is fine for dev but will need a migration path for production with concurrent users
- [ ] **CI workflow for tests + lint** — `backend/tests/` has a pytest suite but the only GitHub Actions workflow is `data-sync.yml`; add a CI workflow running `pytest` and `npm run lint`/`npm run build` on PRs
- [ ] **Automate the local push scripts** — result freshness depends on manually running `scripts/push_results.py` / `push_riders.py` (PCS blocks cloud IPs); add a Windows Task Scheduler entry or similar on the local machine so pushes happen daily without remembering

---

## Ideas / Stretch

- [ ] **Email digest** — weekly email to all users with current standings and top scoring riders that week
- [ ] **Season archive** — view previous years' leaderboards and teams (model already has `year` field)
- [ ] **Budget efficiency leaderboard** — rank teams by `total_score / total_cost` (value-per-point) alongside the main score leaderboard
