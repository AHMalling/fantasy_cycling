# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## App Concept

Fantasy Cycling is a once-a-year fantasy sports game built around real professional cycling.

**How it works:**
- Once per season, each user drafts a team of **20 real professional riders**
- Rider cost is based on their **UCI points earned the previous season**
- Each team has a **budget cap of 20,000 UCI points** to spend on their roster
- Once submitted, the team is **locked for the entire season**
- The goal is to accumulate the most **UCI points** from races during the current season
- Users compete to see whose team scores the highest total

**Tech stack:**
- **Backend**: Python 3.12, Django 5, Django REST Framework, SQLite (dev)
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Containerization**: Docker Compose

## Data Source: ProCyclingStats

All rider and points data is sourced from [procyclingstats.com](https://www.procyclingstats.com/).

**Source of truth for current season standings:**
`https://www.procyclingstats.com/rankings/uci-season-individual`
This page is updated weekly, so it should be supplemented with fresher race result data from individual race and rider pages on the same site.

**How to access the data (in order of preference):**

1. **Official API** — ProCyclingStats has an official API (`procyclingstats.com/info/api`) covering teams, race timelines, startlists, and live situation data. Contact [email protected] for access. Recommended for production use.

2. **Python library `procyclingstats`** — A well-maintained open-source scraper ([PyPI](https://pypi.org/project/procyclingstats/), [GitHub](https://github.com/themm1/procyclingstats), [docs](https://procyclingstats.readthedocs.io/)). Install with `pip install procyclingstats`. The `Ranking` class parses the UCI rankings page and returns structured data (`rank`, `rider_name`, `rider_url`, `points`, `nationality`, `team_name`). Other useful classes: `Rider`, `RiderResults`, `Race`, `RaceStartlist`, `Team`.

3. **Web scraping** — As a fallback, the site can be scraped directly. Rate-limit requests aggressively to avoid being blocked.

**Rider pricing** uses the previous season's UCI points total. **In-season scoring** uses current-season UCI points accumulated from race results.

## Development Commands

### Docker (recommended — runs both services)
```bash
docker compose up --build
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/api/
# Django admin: http://localhost:8000/admin/
```

### Backend only
```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver      # http://localhost:8000
```

### Frontend only
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                     # http://localhost:3000
npm run build && npm start      # production build
npm run lint
```

## Architecture

### Request Flow
1. Next.js **server components** fetch data directly from the Django API at `NEXT_PUBLIC_API_URL`
2. Django processes requests through middleware → URL router → DRF views → serializers → JSON response
3. CORS is configured in `backend/core/settings.py` to allow `http://localhost:3000`
4. Frontend uses ISR (`revalidate: 30`) for backend data

### Backend layout (`backend/`)
- `core/` — Django project config: `settings.py`, main `urls.py`, WSGI/ASGI
- `api/` — REST API app: `views.py`, `models.py`, `serializers.py`, `urls.py`, `admin.py`
- All API routes are mounted at `/api/` in `core/urls.py`

### Frontend layout (`frontend/app/`)
- Uses Next.js **App Router** with server components by default
- `layout.tsx` — root layout and metadata
- `page.tsx` — home page; fetches `/api/health/` and displays backend status

### Environment variables
| Variable | Location | Purpose |
|---|---|---|
| `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` | `backend/.env` | Django config |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Points Next.js at the Django API |

In Docker, `NEXT_PUBLIC_API_URL=http://backend:8000` (service name DNS). Locally, use `http://localhost:8000`.

### Adding new features
- New Django app: `python manage.py startapp <name>`, add to `INSTALLED_APPS`, wire URLs in `core/urls.py`
- New API endpoint: add view to `api/views.py` (or new app), serializer, and URL entry in `api/urls.py`
- New frontend page: add a directory under `frontend/app/` with a `page.tsx` (server component default)
