<div align="center">

# SmartSupply AI

### AI-powered supply chain and order management platform for apparel businesses — with RAG-based business intelligence assistant *(coming soon)*

<br/>

[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![CI](https://img.shields.io/github/actions/workflow/status/SajidAli8015/smartsupply-ai/ci.yml?label=CI%2FCD&style=flat-square&logo=github-actions&logoColor=white)](https://github.com/SajidAli8015/smartsupply-ai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-F59E0B?style=flat-square)](LICENSE)

</div>

---

## Overview

SmartSupply AI is a full-stack, production-ready supply chain management platform built specifically for apparel businesses. It covers the complete business cycle — from factory procurement and inventory management, through to customer orders, warehouse fulfillment, and delivery — in a single cohesive system. The platform is designed for small-to-medium apparel suppliers who need real operational visibility without the cost or complexity of enterprise ERP software.

The platform is architected with an AI layer in mind. The upcoming RAG-based business intelligence assistant will give suppliers natural-language visibility into their operations: *"Which products should I reorder?"*, *"What's my best-performing SKU this month?"*, *"Which orders have been sitting in fulfillment for over 48 hours?"*. By structuring analytics data as rich, queryable context, SmartSupply AI is purpose-built to connect operations data to an LLM — turning a supply chain dashboard into an intelligent business advisor.

SmartSupply AI serves three personas: **suppliers** (owners and managers who need business KPIs, purchase order management, and full order visibility), **warehouse staff** (who need a clean, focused queue for packing and shipping), and **buyers** (retail customers who browse products, place orders, and track deliveries). Role-based access control ensures each user sees only what is relevant to their workflow, with separate layouts, navigation, and API guards per role.

The technical foundation is a FastAPI backend with a service-layer architecture, a React 18 frontend with a fully typed Axios client, PostgreSQL for persistence, Redis for background task queuing, and Docker for local development parity. The CI/CD pipeline runs on GitHub Actions, validating both the Python test suite and the TypeScript build on every push.

---

## Screenshots

<br/>

**Supplier Dashboard** — Live KPIs, revenue time-series chart, top products by revenue, and purchase order pipeline
![Supplier Dashboard](docs/screenshots/dashboard.png)


---

## Features

### Supplier / Owner

- **Real-time business dashboard** with revenue KPIs, total orders, inventory value, and gross margin — all calculated live from the database
- **Sales analytics** with time-series revenue charts across daily, weekly, and monthly windows, powered by Recharts
- **Top products and slow-mover identification** — ranked by revenue to surface what's working and what isn't
- **Purchase order management** — create POs against factory vendors, track line items, and monitor fulfillment from `draft` → `sent` → `confirmed` → `in_production` → `shipped` → `received`
- **Inventory tracking** with SKU-level stock quantities, low-stock threshold alerts, and available vs. reserved breakdown
- **Full order visibility** — view every buyer order with status history, item breakdown, shipping address, and shipment tracking numbers
- **Order lifecycle management** — confirm pending orders and mark shipped orders as delivered directly from the order detail view
- **Notifications system** — in-app notification feed for restocks, order events, and business alerts

### Warehouse Staff

- **Fulfillment queue** split into two focused columns: *To Pack* (confirmed orders awaiting packaging) and *To Ship* (packed orders awaiting dispatch)
- **Priority flagging** — orders older than 24 hours are automatically surfaced with a red priority badge so nothing sits forgotten
- **One-click pack workflow** — mark an order as packed with a single button; the queue updates instantly
- **Ship modal** — enter carrier (TCS, Leopards, PostEx, DHL) and tracking number to create a shipment record and advance the order to `shipped`
- **Auto-refreshing queue** — polls every 60 seconds so warehouse staff always see the current state without manual page refreshes

### Buyers

- **Product storefront** with server-side pagination and client-side filtering by product type, size, color, and price range
- **Debounced search** across product names and descriptions — smooth, no excessive API calls
- **SKU-level selection** — interactive color swatches and size buttons that reflect real-time inventory availability per variant
- **Stock indicators** — *In Stock*, *Low Stock*, *Only N left!*, and *Out of Stock* badges driven by live inventory data
- **Cart sidebar** with localStorage persistence, quantity controls, and item removal — survives page refreshes and navigation
- **Checkout** with shipping address form, client-side validation, and a live order summary panel
- **Order confirmation page** with full order details immediately after placement
- **Order tracking** — expandable order cards showing status badge, item breakdown, shipping address, and courier tracking number
- **Order cancellation** available for `pending` and `confirmed` orders directly from the buyer's order history

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript 5, Tailwind CSS, React Query v5, React Router v6, Recharts |
| **Backend** | FastAPI 0.111, SQLAlchemy 2.0, Alembic, Pydantic v2, Celery |
| **Database** | PostgreSQL 16, Redis 7 |
| **Auth** | JWT (python-jose), bcrypt (passlib), httpOnly refresh cookie |
| **Infrastructure** | Docker, Docker Compose, GitHub Actions CI/CD |
| **Cloud Ready** | AWS ECS, RDS, S3, CloudFront *(deployment guide coming)* |
| **Payments** | Stripe SDK *(test mode integration)* |
| **AI (Planned)** | RAG pipeline with LLM integration for natural language business intelligence |

---

## Architecture

SmartSupply AI follows a clean **monorepo** structure with `/backend`, `/frontend`, `/infra`, and `/docs` as first-class directories — each independently buildable and deployable.

The **FastAPI backend** uses a strict three-layer architecture: **routers** handle HTTP concerns (request parsing, auth guards, response serialization), **services** contain all business logic and database access, and **SQLAlchemy models** define the persistence schema. This keeps route handlers thin and business logic fully testable without HTTP overhead. Pydantic v2 models are used for all request validation and response serialization, with `model_validator(mode="before")` hooks for complex transformations.

The **React frontend** separates server state from UI state cleanly. **React Query** manages all API data with configurable `staleTime` per query — real-time views (like the fulfillment queue) poll aggressively, while stable data (product catalog) is cached for several minutes. **React Context** handles auth state and the shopping cart, with the cart persisted to `localStorage` so it survives navigation and refresh. The routing tree uses **nested protected routes** where `ProtectedRoute` checks role before rendering the layout, which renders the active page via `<Outlet />`. The buyer shell wraps the entire buyer layout in `CartProvider`, making cart state available in both the navbar badge and the slide-over sidebar without prop drilling.

**Role-based access control** is enforced at both layers: FastAPI `Depends()` guards decode the JWT and check role before any route handler executes, and `ProtectedRoute` on the frontend prevents unauthorized navigation. The three roles — `supplier`, `staff`, and `buyer` — each get a distinct layout, navigation structure, and set of API-accessible endpoints.

**PostgreSQL with Alembic** manages all schema changes through versioned migrations. The seed script (`scripts/seed.py`) is fully idempotent and generates a realistic Pakistani apparel business dataset — products, SKUs, inventory, factories, purchase orders, and 60+ days of order history — making it possible to demo every feature immediately after setup.

---

## Project Structure

```
smartsupply-ai/
├── backend/
│   ├── alembic/              # Database migrations (versioned schema history)
│   ├── core/
│   │   ├── config.py         # Pydantic settings loaded from .env
│   │   ├── dependencies.py   # FastAPI auth dependencies per role
│   │   ├── security.py       # JWT encode/decode, password hashing
│   │   └── cache.py          # Redis client and cache helpers
│   ├── db/
│   │   └── session.py        # SQLAlchemy engine and SessionLocal
│   ├── models/               # SQLAlchemy ORM models
│   │   ├── user.py           #   User (supplier / staff / buyer)
│   │   ├── product.py        #   Product, SKU
│   │   ├── inventory.py      #   Inventory (per-SKU stock levels)
│   │   ├── order.py          #   Order, OrderItem, OrderStatus enum
│   │   ├── shipment.py       #   Shipment (carrier + tracking number)
│   │   ├── factory.py        #   Factory vendor
│   │   ├── purchase_order.py #   PurchaseOrder, POLineItem
│   │   └── notification.py   #   Notification
│   ├── routers/              # FastAPI APIRouters — one file per domain
│   │   ├── auth.py           #   POST /auth/login, /auth/refresh, /auth/logout
│   │   ├── products.py       #   GET /products (paginated, filterable)
│   │   ├── orders.py         #   /orders — buyer + supplier views, status updates
│   │   ├── inventory.py      #   /inventory
│   │   ├── factories.py      #   /factories
│   │   ├── purchase_orders.py#   /purchase-orders
│   │   ├── analytics.py      #   /analytics — KPIs, revenue charts, top products
│   │   ├── notifications.py  #   /notifications
│   │   └── health.py         #   /health — liveness probe for load balancers
│   ├── schemas/              # Pydantic v2 request/response models
│   ├── services/             # Business logic layer (no HTTP concerns here)
│   │   ├── order_service.py
│   │   ├── product_service.py
│   │   ├── inventory_service.py
│   │   ├── factory_service.py
│   │   └── po_service.py
│   ├── scripts/
│   │   └── seed.py           # Idempotent seed with realistic apparel data
│   ├── tests/                # Pytest test suite
│   ├── main.py               # FastAPI app factory, CORS, router registration
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── api/              # Typed Axios wrappers — one file per domain
│       │   ├── client.ts     #   Axios instance with JWT interceptor + auto-refresh
│       │   ├── buyer.ts      #   Buyer-specific endpoints (shop, cart, orders)
│       │   ├── orders.ts     #   Supplier order management + fulfillment queue
│       │   ├── products.ts   #   Product and inventory management
│       │   ├── factories.ts  #   Factory vendor CRUD
│       │   ├── purchase_orders.ts
│       │   └── analytics.ts  #   KPI and chart data
│       ├── components/
│       │   ├── buyer/        #   CartSidebar
│       │   ├── dashboard/    #   KPICard, SalesChart, TopProductsTable,
│       │   │                 #   LowStockAlert, POPipeline
│       │   └── ProtectedRoute.tsx
│       ├── contexts/
│       │   ├── AuthContext.tsx    # JWT auth state, login / logout
│       │   ├── CartContext.tsx    # Cart with localStorage persistence
│       │   └── ToastContext.tsx   # Global toast notification system
│       ├── layouts/
│       │   ├── SupplierLayout.tsx # Sidebar nav for supplier / staff
│       │   └── BuyerLayout.tsx    # Top nav with cart badge + CartSidebar
│       ├── lib/
│       │   └── format.ts     # formatPKR, timeAgo, ORDER_STATUS_STYLES
│       ├── pages/
│       │   ├── auth/         #   Login, Register
│       │   ├── supplier/     #   Dashboard, Orders, Fulfillment, Inventory,
│       │   │                 #   Products, Factories, PurchaseOrders
│       │   └── buyer/        #   Shop, ProductDetail, Checkout,
│       │                     #   OrderConfirmation, MyOrders
│       └── types/
│           └── index.ts      # Shared TypeScript interfaces
├── infra/                    # AWS Terraform configuration (coming soon)
├── docs/
│   └── screenshots/          # README screenshots
├── .github/
│   └── workflows/
│       └── ci.yml            # Backend pytest + frontend build on every push
├── docker-compose.yml        # Full stack: postgres + redis + backend + frontend
├── docker-compose.dev.yml    # Dev mode: postgres only (run backend/frontend natively)
└── .env.example              # Environment variable template
```

---

## Local Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for the PostgreSQL container
- Python 3.11
- Node.js 20+

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/SajidAli8015/smartsupply-ai.git
cd smartsupply-ai

# 2. Copy environment template
cp .env.example .env
# Review .env — defaults work out of the box for local development
```

**Backend** (Terminal 1):

```bash
cd backend

# Create and activate virtual environment
py -3.11 -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Start PostgreSQL in Docker (database only — backend runs natively)
cd ..
docker-compose -f docker-compose.dev.yml up -d
cd backend

# Apply database migrations
alembic upgrade head

# Seed with realistic demo data (idempotent — safe to run multiple times)
python scripts/seed.py

# Start the API server
uvicorn main:app --reload
# API:        http://localhost:8000
# Swagger UI: http://localhost:8000/docs
# ReDoc:      http://localhost:8000/redoc
```

**Frontend** (Terminal 2):

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:3000
```

### Full Stack with Docker

To run the complete stack (PostgreSQL + Redis + backend + frontend) entirely in Docker:

```bash
cp .env.example .env
docker-compose up --build
# App: http://localhost:3000
# API: http://localhost:8000
```

---

## Demo Credentials

Run `python scripts/seed.py` from the `backend/` directory to populate the database. All seeded accounts share the same password: **`Admin123!`**

| Role | Email | Password |
|---|---|---|
| **Supplier** | `supplier@smartsupply.com` | `Admin123!` |
| **Staff** | `usman.tariq@smartsupply.com` | `Admin123!` |
| **Staff** | `fatima.malik@smartsupply.com` | `Admin123!` |
| **Buyer** | `ali.raza@gmail.com` | `Admin123!` |
| **Buyer** | Register a new account at `/register` | — |

> The seed script generates 20 buyer accounts, 8 products with multiple color/size SKUs, 5 factory vendors, 30+ purchase orders, and 60+ days of order history — enough data to explore every feature immediately.

---

## API Documentation

The FastAPI backend auto-generates interactive documentation directly from the OpenAPI schema. No separate documentation setup required.

| Interface | URL |
|---|---|
| **Swagger UI** (interactive) | http://localhost:8000/docs |
| **ReDoc** (readable) | http://localhost:8000/redoc |
| **OpenAPI JSON** | http://localhost:8000/openapi.json |

All endpoints are versioned under `/api/v1/` and follow RESTful conventions. Authenticated endpoints require an `Authorization: Bearer <token>` header obtained from `POST /api/v1/auth/login`.

| Group | Base Path | Description |
|---|---|---|
| Auth | `/api/v1/auth` | Login, token refresh, logout |
| Products | `/api/v1/products` | Paginated catalog with filters |
| Orders | `/api/v1/orders` | Order CRUD, status updates, fulfillment queue |
| Inventory | `/api/v1/inventory` | Stock levels and low-stock alerts |
| Factories | `/api/v1/factories` | Factory vendor management |
| Purchase Orders | `/api/v1/purchase-orders` | PO lifecycle management |
| Analytics | `/api/v1/analytics` | KPIs, revenue charts, top products |
| Notifications | `/api/v1/notifications` | In-app notification feed |
| Health | `/api/v1/health` | Liveness probe for load balancers |

---

## Environment Variables

Copy `.env.example` to `.env`. All variables with defaults work out of the box for local development.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | `postgresql://smartsupply:smartsupply123`<br>`@localhost:5432/smartsupply_db` | PostgreSQL connection string |
| `SECRET_KEY` | **Yes** | `changeme` | JWT signing secret — use a long random string in production |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` | Access token lifetime (24 hours) |
| `REDIS_URL` | No | *(unset)* | Redis connection string — Celery background tasks are disabled if unset |
| `ALLOWED_ORIGINS` | No | `["http://localhost:3000"]` | CORS allowed origins |
| `STRIPE_SECRET_KEY` | No | *(empty)* | Stripe secret key for payment processing |
| `SENDGRID_API_KEY` | No | *(empty)* | SendGrid API key for transactional email |
| `AWS_ACCESS_KEY_ID` | No | *(empty)* | AWS credentials for S3 file uploads |
| `AWS_SECRET_ACCESS_KEY` | No | *(empty)* | AWS secret key |
| `AWS_REGION` | No | `us-east-1` | AWS region |
| `AWS_S3_BUCKET` | No | *(empty)* | S3 bucket name for product image uploads |

> **Security note:** Never commit your `.env` file — it is listed in `.gitignore`. For production deployments, use a secrets manager (AWS Secrets Manager, GitHub Actions encrypted secrets, etc.) rather than committing credentials.

---

## Running Tests

```bash
# Backend test suite
cd backend
pytest tests/ -v

# Frontend type-check and production build
cd frontend
npm run build
```

The GitHub Actions CI pipeline runs both jobs on every push to any branch and on every pull request targeting `main`. A green CI badge means the full test suite passes and the TypeScript build is error-free.

---

## Roadmap

- [x] Core supply chain management — products, SKUs, inventory, factories, purchase orders
- [x] Role-based access control — supplier / staff / buyer with JWT auth
- [x] Supplier analytics dashboard — KPIs, revenue charts, top products, PO pipeline
- [x] Buyer storefront — browsing, SKU selection, cart, checkout, order tracking
- [x] Fulfillment queue — warehouse pack and ship workflow with courier integration
- [ ] **RAG-based AI business intelligence assistant** *(in design)*
- [ ] AWS deployment with Terraform — ECS + RDS + S3 + CloudFront
- [ ] Transactional email via SendGrid — order confirmations, status updates
- [ ] WhatsApp order notifications via Twilio
- [ ] Mobile-first responsive optimization
- [ ] Product image uploads to S3
- [ ] Multi-tenant support — multiple independent businesses on one instance
- [ ] Advanced reporting and data export (CSV, PDF)

---


## License

[MIT](LICENSE) — free to use, modify, and distribute with attribution.

---

<div align="center">

Built with FastAPI, React, and PostgreSQL &nbsp;·&nbsp; Designed for Pakistani apparel businesses

</div>
