# Fantasy Cycling

A full-stack fantasy cycling application built with **Django REST Framework** (backend) and **Next.js** (frontend).

---

## Project structure

```
fantasy_cycling/
├── backend/               # Django project
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── core/              # Django project package (settings, urls, wsgi, asgi)
│   └── api/               # REST API app (models, views, serializers, urls)
├── frontend/              # Next.js project
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── .env.local.example
│   └── app/               # Next.js App Router
│       ├── layout.tsx
│       ├── page.tsx
│       └── globals.css
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Running locally (without Docker)

### 1. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set a proper SECRET_KEY

# Apply migrations and start the dev server
python manage.py migrate
python manage.py runserver
# Backend available at http://localhost:8000
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local if needed (default points to http://localhost:8000)

# Start the dev server
npm run dev
# Frontend available at http://localhost:3000
```

---

## Running with Docker Compose

```bash
# From the repo root:

# 1. Create the backend env file (Docker reads it)
cp backend/.env.example backend/.env

# 2. Create the frontend env file
cp frontend/.env.local.example frontend/.env.local

# 3. Start both services
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/
- Django admin: http://localhost:8000/admin/

---

## API endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/health/` | Health check — returns `{"status":"ok","message":"..."}` |

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | insecure default | Django secret key |
| `DEBUG` | `True` | Debug mode |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated allowed hosts |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the Django API |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, Django 5, Django REST Framework, django-cors-headers, python-decouple |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Database (dev) | SQLite |
| Containerisation | Docker Compose |
