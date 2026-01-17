<p align="center">
  <img src="docs/assets/logo.png" alt="OpenTripBoard Logo" width="120" height="120">
</p>

<h1 align="center">OpenTripBoard</h1>

<p align="center">
  <strong>Plan trips together, in real-time.</strong>
</p>

<p align="center">
  <a href="#why-opentripboard">Why</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#documentation">Documentation</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPLv3-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg" alt="Node.js Version">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20FR%20%7C%20ES-orange.svg" alt="Languages">
</p>

---

## What is OpenTripBoard?

OpenTripBoard is a **free, self-hosted travel planning app** that lets you collaborate with friends and family in real-time. Think Google Docs, but for trip planning.

Build itineraries, track budgets, manage reservations, create packing lists, and store travel documents — all in one place. Invite "Trip Buddies" to edit together, vote on activities, and split expenses.

**Your data stays on your server. No tracking, no ads, no subscription fees.**

---

## Why OpenTripBoard?

| Problem | Solution |
|---------|----------|
| Trip planning scattered across emails, spreadsheets, and chat apps | **Everything in one place** — itinerary, reservations, budget, documents |
| Coordinating group trips is chaos | **Real-time collaboration** with live editing and voting |
| Commercial apps track your data and charge subscriptions | **Self-hosted and open source** — you own your data forever |

### Who is it for?

- Solo travelers who want organized trip planning
- Couples and families planning vacations
- Friend groups coordinating multi-destination trips
- Privacy-conscious travelers who want control over their data

---

## Features

### Trip Planning
- **Visual Itineraries** — Day-by-day schedules with drag-and-drop
- **Interactive Maps** — See all destinations on OpenStreetMap
- **Reservation Management** — Organize flights, hotels, and activities
- **Budget Tracking** — Set budgets and split costs among travelers
- **Packing Lists** — Customizable checklists with templates
- **Document Storage** — Keep passports, tickets, and notes organized

### Collaboration
- **Trip Buddies** — Invite via email or shareable link
- **Live Editing** — See changes in real-time
- **Presence Indicators** — Know who's viewing the trip
- **Voting** — Propose activities and vote as a group

### User Experience
- **Light/Dark Theme** — Automatic system detection
- **Responsive Design** — Works on desktop, tablet, mobile
- **Multi-language** — English, French, Spanish
- **Keyboard Accessible** — Full accessibility support

---

## Getting Started

### Quick Start with Docker (Recommended)

#### Development Setup

```bash
# Clone the repository
git clone https://github.com/skullgoth/opentripboard.git
cd opentripboard

# Setup development environment (creates all .env files automatically)
./scripts/setup-env.sh dev

# Start the application (--build required on first run)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Open http://localhost in your browser
```

**That's it!** The development environment is pre-configured with sensible defaults:
- Hot reload enabled for both frontend and backend
- Database runs locally with default credentials
- All services accessible via nginx on port 80

**Direct service access (development only):**

| Service | URL | Notes |
|---------|-----|-------|
| Main app (nginx) | http://localhost | Recommended for testing |
| Frontend (Vite) | http://localhost:5173 | HMR enabled |
| Backend API | http://localhost:3000 | Direct API access |
| Database | localhost:5432 | PostgreSQL (user: postgres) |

#### Production Setup

```bash
# Clone the repository
git clone https://github.com/skullgoth/opentripboard.git
cd opentripboard

# Setup production environment
./scripts/setup-env.sh prod

# IMPORTANT: Edit configuration files with your production values
nano .env              # Set a strong DB_PASSWORD
nano backend/.env      # Set JWT_SECRET, PEXELS_API_KEY, CORS_ORIGIN (your domain)
nano frontend/.env     # Set VITE_API_URL and VITE_WS_URL to your domain

# Build and start the application
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**Production environment differences:**
- Frontend built as static files, served by nginx (no Vite dev server)
- Backend runs with `NODE_ENV=production`
- Only port 80 is exposed
- All services use `restart: always`

> ⚠️ **Security:** Never commit production `.env` files to version control.

Create an account and start planning your first trip!

### Try with Demo Data

Want to explore the features? Load sample trips:

```bash
./bin/seed-demo-data.sh
```

Login credentials:
- `test1@example.com` / `TestPassword123`
- `test2@example.com` / `TestPassword123`

### System Requirements

| For Running | Version |
|-------------|---------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| Memory | 2 GB RAM |
| Storage | 1 GB free |

### Troubleshooting

<details>
<summary><strong>Port already in use</strong></summary>

If you see errors about ports being in use, check which ports are occupied:

```bash
# Check ports 80, 3000, 5173, or 5432
sudo lsof -i :80
```

Stop conflicting services or modify the port mappings in `docker-compose.dev.yml`.
</details>

<details>
<summary><strong>Database connection failed</strong></summary>

The database might not be healthy yet. Wait a few seconds and check:

```bash
# Check container health
docker compose ps

# View database logs
docker compose logs db
```

For a fresh start, remove the data volume:
```bash
docker compose down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```
</details>

<details>
<summary><strong>Hot reload not working (development)</strong></summary>

Ensure you're using the development compose file:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

If changes still don't appear, the issue may be file watching. Try restarting the containers:
```bash
docker compose restart frontend backend
```
</details>

<details>
<summary><strong>Containers keep restarting</strong></summary>

Check the logs for errors:
```bash
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend
```

Common causes:
- Missing environment variables
- Database not ready (wait for health check)
- Syntax errors in configuration files
</details>

<details>
<summary><strong>Clean start (reset everything)</strong></summary>

To completely reset and start fresh:
```bash
# Stop and remove all containers and volumes
docker compose down -v

# Remove built images (optional)
docker compose down --rmi local

# Rebuild everything
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```
</details>

---

## Documentation

TODO

---

## Architecture

```
opentripboard/
├── backend/              # Fastify API (Node.js 20)
│   ├── src/
│   │   ├── routes/       # REST API endpoints
│   │   ├── services/     # Business logic
│   │   ├── db/           # PostgreSQL migrations & queries
│   │   └── websocket/    # Real-time collaboration
│   ├── tests/
│   ├── .env.dev          # Development environment template
│   └── .env.prod         # Production environment template
│
├── frontend/             # Vite + Vanilla JS
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── locales/      # i18n (en, fr, es)
│   │   └── services/     # API client, WebSocket
│   ├── tests/
│   ├── .env.dev          # Development environment template
│   └── .env.prod         # Production environment template
│
├── scripts/
│   └── setup-env.sh      # Environment setup script
│
├── docker-compose.yml    # Base compose (shared services)
├── docker-compose.dev.yml # Development overrides (hot reload, exposed ports)
├── docker-compose.prod.yml # Production overrides (static build, optimized)
├── nginx.dev.conf        # Nginx config for development (proxies to Vite)
└── nginx.prod.conf       # Nginx config for production (serves static files)
```

### Tech Stack

- **Backend**: Fastify, PostgreSQL 16, WebSockets
- **Frontend**: Vanilla JavaScript (ES2022+), Vite
- **Maps**: Leaflet.js + OpenStreetMap
- **Deployment**: Docker Compose, Nginx

---

## Community

- **Bug Reports**: [GitHub Issues](https://github.com/skullgoth/opentripboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/skullgoth/opentripboard/discussions)
- **Discord**: [Join our server](https://discord.gg/ntxSDpWe)

---

## License

OpenTripBoard is licensed under [AGPLv3](LICENSE).

---

## Acknowledgments

Built with [Fastify](https://fastify.dev/), [Vite](https://vitejs.dev/), [PostgreSQL](https://www.postgresql.org/), [Leaflet](https://leafletjs.com/), [OpenStreetMap](https://www.openstreetmap.org/), and [SortableJS](https://sortablejs.github.io/Sortable/).

---

<p align="center">
  <sub>Made with care for travelers everywhere</sub>
</p>
