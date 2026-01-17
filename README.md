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

# Setup development environment (automated)
./scripts/setup-env.sh dev

# Edit configuration files with your secrets and domain
nano backend/.env      # Set JWT_SECRET, PEXELS_API_KEY, CORS_ORIGIN
nano frontend/.env     # Update VITE_API_URL and VITE_WS_URL to your domain

# Start the application
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Open http://localhost in your browser
```

#### Production Setup

```bash
# Clone the repository
git clone https://github.com/skullgoth/opentripboard.git
cd opentripboard

# Setup production environment (automated)
./scripts/setup-env.sh prod

# Edit configuration files with your secrets and domain
nano .env              # Set DB_PASSWORD
nano backend/.env      # Set JWT_SECRET, PEXELS_API_KEY, CORS_ORIGIN
nano frontend/.env     # Update VITE_API_URL and VITE_WS_URL to your domain

# Start the application
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

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

---

## Documentation

TODO

---

## Architecture

```
opentripboard/
├── backend/          # Fastify API (Node.js 20)
│   ├── src/
│   │   ├── routes/   # REST API endpoints
│   │   ├── services/ # Business logic
│   │   ├── db/       # PostgreSQL migrations & queries
│   │   └── websocket/# Real-time collaboration
│   └── tests/
│
├── frontend/         # Vite + Vanilla JS
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── locales/  # i18n (en, fr, es)
│   │   └── services/ # API client, WebSocket
│   └── tests/
│
└── docker-compose.yml
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
