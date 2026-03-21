# Wolf of Wall Street - Progress Tracker

Last updated: 2026-03-21

This document is the persistent handoff context for future chat sessions.

## Project Status

- Stage: Late implementation + rehearsal hardening.
- Backend/runtime: Functional with Supabase-connected migrations and seed data.
- Frontend: Running in dev mode via Vite, routed through backend proxy.
- Core flows: Trading, admin controls, leaderboard reveal, display bootstrap validated via API drills.
- Production readiness: Strong, with final operator-led browser rehearsal recommended before event-day signoff.

## Baseline and Delta Context

- Primary baseline doc: `WoWS_Final_Balanced.docx` (extracted as `WoWS_Final_Balanced.txt`).
- Execution delta doc: `PLAN.md`.
- Implementation has adopted major PLAN hardening items:
  - persisted market control plane (`MarketState`)
  - append-only operator audit trail (`AdminEvent`)
  - idempotent trade requests (`requestId`)
  - database-authoritative money/valuation paths
  - scripted recovery helpers.

## Key Decisions Made

1. **Same-origin capable backend-first runtime retained**
   - Backend serves built frontend in production (`createApp` static serving path).

2. **Participant-only trading enforced**
   - Admins cannot execute participant trades at route level.

3. **Operational resilience prioritized**
   - Startup script path fixed.
   - Transaction retries expanded for transient Prisma/Supabase failures.
   - Interactive transaction timeouts increased to avoid 5s expiry under latency.
   - Tick loop guarded so one failed tick does not crash the process.

4. **Deployment discipline**
   - Supabase migrations applied via committed migration and `prisma migrate deploy`.
   - Rehearsal checklist added for go/no-go gating.

## Implemented Changes (This Workstream)

### 1) Start command fixed

- File: `package.json`
- Change:
  - `start` updated from `node dist/server/index.js` to `node dist/server/src/server/index.js`.
- Why:
  - Built server output path is rooted under `dist/server/src/server`.

### 2) Participant-only trade guard

- File: `src/server/lib/http.ts`
  - Added `requireParticipant` middleware (401 unauthenticated, 403 non-participant).
- File: `src/server/routes/api.ts`
  - Applied `requireParticipant` to:
    - `POST /api/trade/buy`
    - `POST /api/trade/sell`
- Why:
  - Preserve event fairness and prevent admin-side accidental trading.

### 3) Transaction and tick stability hardening

- File: `src/server/services/tradeService.ts`
  - Added transient failure detection for:
    - `P2028`
    - "Transaction not found"
    - "could not serialize access due to concurrent update"
  - Retries now cover these transient failures in addition to serializable conflicts.
  - Added transaction options:
    - `maxWait: 10000`
    - `timeout: 20000`

- File: `src/server/services/marketService.ts`
  - Added transaction options on market tick:
    - `maxWait: 10000`
    - `timeout: 20000`

- File: `src/server/index.ts`
  - Wrapped interval tick call with safe catch:
    - logs `[market-tick] failed: ...`
    - prevents process crash on tick failures.

### 4) Rehearsal and operations documentation

- File: `DEPLOY_REHEARSAL_CHECKLIST.md`
  - Added full pre-deploy and event rehearsal pass/fail checklist.

## Verification Performed

### Environment and DB

- `.env` validated and Supabase connection confirmed.
- `npm run prisma:deploy` succeeded (migration applied).
- `npm run prisma:seed` succeeded (rounds/stocks/users seeded).

### Build/Test

- `npm test` passed.
- `npm run build` passed.
- `npm start` healthy with `/health` returning DB-connected status.

### API Drills (Multiple passes)

- Auth: admin + participant login OK.
- Round controls: start/end OK.
- News/shock/broadcast OK.
- Halt/resume OK.
- Leaderboard reveal/hide OK.
- Display bootstrap state consistency OK.
- CSV import OK.
- Post-end trading blocked as expected.
- Admin trading blocked (`Participant access required`) as expected.

## Current Runtime for UI Testing

- Dev servers started with:
  - `npm run dev`
- Frontend URL:
  - `http://localhost:5173`
- Backend health:
  - `http://localhost:3000/health` (returns 200)

## Known Remaining Gaps / Recommendations

1. Run one full operator-led browser rehearsal across:
   - participant (desktop + mobile)
   - admin panel timings
   - display/projection readability.
2. Add integration tests for:
   - auth/session persistence after restart
   - trade concurrency under active tick load
   - end-to-end round and reveal workflows.
3. For deployment:
   - ensure env parity on Render/Vercel
   - enable external health monitor (`/health`).

## Session-End Update Rule (Mandatory)

At the end of every development session, append/update:

- Date/time and summary of work completed.
- Files changed.
- Commands/tests run with result.
- New risks discovered and mitigation status.
- Next immediate tasks for the following session.

Do not start a new major task in a future chat without first reading this file.
