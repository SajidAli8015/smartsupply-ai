# SmartSupply AI

> AI-powered supply chain and order management platform for apparel businesses — with RAG-based business intelligence

## Overview

SmartSupply AI is a full-stack monorepo built to help apparel brands manage inventory, purchase orders, suppliers, and fulfillment with AI-assisted insights powered by Retrieval-Augmented Generation (RAG).

## Monorepo Structure

```
smartsupply-ai/
├── backend/          # FastAPI — REST API, Celery workers, SQLAlchemy ORM
├── frontend/         # Vite + React 18 + TypeScript + Tailwind CSS
├── infra/            # Infrastructure-as-code (Terraform / Docker configs)
├── docs/             # Architecture docs, ADRs, API references
├── docker-compose.yml
├── .env.example
└── README.md
```

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI, Pydantic v2, SQLAlchemy 2, Alembic |
| Auth | python-jose (JWT), passlib (bcrypt) |
| Background jobs | Celery + Redis |
| Storage | PostgreSQL 16, Redis 7, AWS S3 |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Data fetching | TanStack Query v5, Axios |
| Routing | React Router v6 |

## Getting Started

### Prerequisites

- Docker & Docker Compose (for PostgreSQL)
- Node.js 20+
- Python 3.11+

### Local Development (recommended)

In local dev only **PostgreSQL** runs in Docker; the backend and frontend run
natively for fast reloading and easier debugging.

#### Step 1 — Start PostgreSQL

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts a single Postgres 16 container on `localhost:5432`.
Credentials: user `smartsupply` / password `smartsupply123` / db `smartsupply_db`.

#### Step 2 — Backend

```bash
cp .env.example .env          # first time only — adjust secrets as needed

cd backend
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API is now available at **http://localhost:8000** — interactive docs at
**http://localhost:8000/docs**.

#### Step 3 — Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The app is now available at **http://localhost:3000**.

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |

#### Stopping PostgreSQL

```bash
docker compose -f docker-compose.dev.yml down
```

Add `-v` to also delete the database volume: `... down -v`

---

### Full Docker Stack (production-like)

To run all services in Docker (backend + frontend + postgres + redis):

```bash
docker compose up --build
```

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

## License

Proprietary — All rights reserved.
