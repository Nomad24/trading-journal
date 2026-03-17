# Trading Journal

Trading Journal is a full-stack application for tracking trades, accounts, and trading analytics.

The project consists of:

- `client` — React + Vite frontend
- `server` — Express + Prisma backend
- `PostgreSQL` — main database

## Features

- user registration and login
- JWT auth with access token and refresh token
- protected frontend routes
- dashboard with key trading metrics
- equity curve and PnL analytics
- trade journal with create, edit, delete, and details view
- account management with per-account metrics
- analytics by symbol, win/loss breakdown, and heatmap
- active account filter across the app

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Zustand
- Tailwind CSS
- Axios

### Backend

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- JWT
- bcrypt

## Project Structure

```text
trading-journal/
  client/
  server/
  README.md
```

## Requirements

Before запуск, make sure you have installed:

- Node.js 18+
- npm
- PostgreSQL

## Docker (Recommended Quick Start)

This repo includes Docker setup for all services:

- `client` (React build + Nginx)
- `server` (Express + Prisma)
- `db` (PostgreSQL)

### How Docker works in this project

- Each app runs in an isolated container.
- `docker-compose.yml` starts all containers together as one stack.
- Containers communicate via internal network names (`server`, `db`).
- Data is persisted in a named volume (`postgres_data`).
- Frontend is served by Nginx and proxies `/api/*` to backend container.

### Run with Docker Compose

From the project root:

```bash
docker compose up --build -d
# fallback: docker-compose up --build -d
```

Open app:

```text
http://localhost:8080
```

Check API health:

```text
http://localhost:8080/api/v1/health
```

Stop containers:

```bash
docker compose down
# fallback: docker-compose down
```

Stop and remove DB volume too (full reset):

```bash
docker compose down -v
# fallback: docker-compose down -v
```

### Important for production

In `docker-compose.yml`, replace defaults with strong secrets:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `POSTGRES_PASSWORD`

### Push images to Docker Hub

Example (replace `yourname`):

```bash
docker login
docker build -t yourname/trading-journal-server:latest ./server
docker build -t yourname/trading-journal-client:latest ./client
docker push yourname/trading-journal-server:latest
docker push yourname/trading-journal-client:latest
```

### Docker dev mode (hot reload)

For development with auto-reload inside containers:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Dev URLs:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:5000
```

Stop dev stack:

```bash
docker compose -f docker-compose.dev.yml down
```

## Environment Variables

Create a file `server/.env` with values like these:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5433/trading_journal?schema=public"
PORT=5000
CORS_ORIGIN="http://localhost:5173"
JWT_ACCESS_SECRET="your_access_secret"
JWT_REFRESH_SECRET="your_refresh_secret"
```

## Install Dependencies

### Client

```bash
cd client
npm install
```

### Server

```bash
cd server
npm install
```

## Database Setup

After PostgreSQL is running and `server/.env` is configured, apply the Prisma schema:

```bash
cd server
npx prisma generate
npx prisma db push
```

## Run the Project

Open two terminals.

### Terminal 1: backend

```bash
cd server
npm run dev
```

Backend runs on:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/v1/health
```

### Terminal 2: frontend

```bash
cd client
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

## Available Scripts

### Client

```bash
npm run dev
npm run build
npm run preview
```

### Server

```bash
npm run dev
npm run build
npm run start
```

## Main API Routes

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

### Accounts

- `GET /api/v1/accounts`
- `POST /api/v1/accounts`
- `PATCH /api/v1/accounts/:id`
- `DELETE /api/v1/accounts/:id`

### Trades

- `GET /api/v1/trades`
- `POST /api/v1/trades`
- `GET /api/v1/trades/:id`
- `PATCH /api/v1/trades/:id`
- `DELETE /api/v1/trades/:id`

### Analytics

- `GET /api/v1/analytics/summary`
- `GET /api/v1/analytics/equity-curve`
- `GET /api/v1/analytics/pnl-chart`
- `GET /api/v1/analytics/win-loss`
- `GET /api/v1/analytics/by-symbol`
- `GET /api/v1/analytics/heatmap`

## Data Model

Main entities:

- `User`
- `Account`
- `Trade`
- `Strategy`
- `TradeTag`
- `TradeScreenshot`
- `DiaryEntry`

## Production Notes

- do not commit `server/.env`
- do not commit `node_modules`
- do not commit build output like `dist`
- set strong JWT secrets before deployment
- configure `CORS_ORIGIN` for your frontend domain

## Current Status

This repository contains a working MVP with:

- authentication
- trade tracking
- account management
- dashboard metrics
- analytics views
