# Deployment Guide

This project supports a free split deployment:

- Netlify for the Vite frontend
- Render for the Express + Socket.IO backend
- Neon for PostgreSQL

## 1. Prepare the App

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Create your local env file:
   ```bash
   Copy-Item .env.example .env
   ```
3. Generate the Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Run the local app to confirm everything still works:
   ```bash
   npm run dev
   ```

## 2. Create the Neon Database

1. Create a Neon project in the same region you plan to use on Render.
2. Open the project and copy two connection strings:
   - `DATABASE_URL`: the pooled connection string with `-pooler`
   - `DIRECT_URL`: the direct connection string without `-pooler`
3. Keep both strings ready for Render and your one-time production bootstrap.

## 3. Initialize Production Data

Run these commands from your machine once against the Neon production database:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Before running them, set:

- `DATABASE_URL` to the Neon pooled URL
- `DIRECT_URL` to the Neon direct URL

## 4. Deploy the Backend to Render

Create one Render Web Service for this repo.

- Runtime: Node
- Instance type: Free
- Region: match your Neon region
- Health check path: `/health`
- Build command:
  ```bash
  npm ci && npm run prisma:generate && npm run build:server && npm run prisma:deploy
  ```
- Start command:
  ```bash
  npm start
  ```

Add these environment variables in Render:

- `NODE_ENV=production`
- `DATABASE_URL=<Neon pooled URL>`
- `DIRECT_URL=<Neon direct URL>`
- `SESSION_SECRET=<strong random secret>`
- `CLIENT_URL=https://<your-site>.netlify.app`
- `PRICE_TICK_MS=10000`
- `SERVE_STATIC_CLIENT=false`

Notes:

- Keep this service single-instance. The market runtime is stateful in memory.
- Render Free spins down after 15 minutes of inactivity and may take around a minute to wake up.

## 5. Deploy the Frontend to Netlify

Create a Netlify site from the same repo.

- Base directory: leave empty
- Build command:
  ```bash
  npm ci && npm run build:client
  ```
- Publish directory:
  ```bash
  dist/client
  ```

Add these Netlify environment variables:

- `VITE_BACKEND_ORIGIN=https://<your-service>.onrender.com`
- `NODE_VERSION=22`

The repo already includes `netlify.toml` for the SPA rewrite.

## 6. Final Wiring

1. Deploy Render and copy the final `onrender.com` URL.
2. Deploy Netlify and copy the final `netlify.app` URL.
3. Update Render `CLIENT_URL` so it exactly matches the Netlify production URL.
4. Redeploy Render after updating `CLIENT_URL`.

## 7. Smoke Test Checklist

From the Netlify URL, verify:

- Login works for admin and participant users
- Refreshing the page keeps the session alive
- Logout removes access to authenticated routes
- `/display` loads public market data
- Socket updates work on admin, participant, and display screens
- Trades persist after refresh and backend restart
- Render `/health` reports a healthy database connection

## 8. Operational Notes

- The frontend sends API requests to `VITE_BACKEND_ORIGIN` in production and uses same-origin proxying in local dev.
- Production cookies are configured for secure cross-site usage.
- Prisma runtime traffic uses `DATABASE_URL`; Prisma migrations use `DIRECT_URL`.
- Neon Free scales to zero after a short idle period, so the first request after idle may be slower.
