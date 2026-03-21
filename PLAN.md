# Upgraded Blueprint Addendum for the Venturers Market Platform

## Summary
- The original blueprint is aiming at the right target: not a realistic market simulator, but a four-hour event system that must feel live, stay understandable under pressure, and be operable by a small admin team without engineering intervention.
- Its core design intent is sound: minimize moving parts, keep one backend, use PostgreSQL for durable state, and concentrate effort on the four event-critical capabilities: trading, admin control, leaderboard, and round flow.
- The blueprint’s main weakness is not over-simplification of features; it is under-specification of correctness boundaries. Several “simple” choices create hidden fragility around auth, restart recovery, state consistency, and event-day operations.

## Critical Review
- `Vercel frontend + Render API + cookie sessions` is the biggest practical risk. Cross-origin cookies, Socket.IO auth, and a public `/display` route conflict with the current session model. Consequence: intermittent login/session bugs, broken sockets, or a display screen that cannot connect cleanly.
- The system has no persisted global market state. `currentRound`, `leaderboardRevealed`, halt status, and parts of live pricing are described as in-memory. Consequence: a restart can preserve login sessions but still lose round state, reveal state, or halt state, which directly contradicts the document’s reliability goal.
- The “one query that must be correct” is incomplete. Locking only the stock row does not prevent overspending by one user across multiple simultaneous buys, or overselling by concurrent sells on the same holding. Consequence: impossible portfolios, negative balances, and fairness disputes.
- Serializable transactions are specified without retries or idempotency. On real WiFi, users will retry or double-submit when latency spikes. Consequence: duplicate trades, confusing failures, or transaction-abort errors exposed to users.
- The market has two competing authorities: DB `current_price` and in-memory `livePrices`. Admin shocks, news impacts, and the 10-second tick can overwrite each other if they interleave. Consequence: lost updates, unexplained price jumps, and non-replayable state.
- The leaderboard is described as “correct” but also cached every 30 seconds. Consequence: the most visible result in the event can be stale at reveal time, especially right after a shock or late trade.
- Money handling is underspecified. The pseudocode uses JS numbers for price math while the DB uses decimals. Consequence: rounding drift between client, server, and leaderboard computations.
- `/display` is declared public, but the Socket.IO connection example disconnects unauthenticated clients. Consequence: the projector view cannot work as specified.
- `prisma db push` in production is a prototyping workflow, not a production migration strategy. Consequence: schema drift, unsafe deploys, and harder recovery if the schema changes late.
- The document overstates free-tier guarantees. Current Render docs explicitly say free web services can restart at any time and should not be used for production; Supabase free projects can be paused for very low activity and free-plan backup handling is limited. Consequence: false confidence if the team treats “zero-cost” as “production-safe.”
- The admin runbook relies too heavily on ad hoc SQL surgery. Consequence: the recovery path for common failures is fast in theory but risky in practice when operators are under time pressure.
- The build plan validates happy paths well, but it under-tests failure paths: reconnects, restarts, duplicate requests, stale reveal state, admin misfires, and mixed mobile/desktop use. Consequence: the system may look finished in rehearsal but still fail during stress.

## Upgraded Blueprint
- Keep the single-backend architecture, but make the event deployment same-origin. Recommended: serve the built React app from the Node/Express service on Render and keep Vercel only for preview builds if desired. This removes most auth/CORS/socket fragility without adding infrastructure.
- Introduce a persisted `market_state` record as the real control plane: `current_round_id`, `round_status`, `trading_halted`, `leaderboard_visible`, `last_tick_at`, `event_version`. On boot, the server reconstructs memory from DB, not the reverse.
- Add a minimal append-only `admin_events` table storing `type`, `payload JSON`, `actor_id`, and `created_at`. This replaces undocumented operator memory with a replayable event trail for shocks, news, halts, reveals, imports, and manual corrections.
- Make the database authoritative for all market mutations. In-memory state becomes only a cached snapshot used for fast reads and broadcasts. All writes go through one serialized market service that commits DB state first, updates cache second, and emits a full snapshot third.
- Expand trade correctness rules:
  - Buy: lock stock row and user row.
  - Sell: lock holding row and user row.
  - Both: enforce idempotency with a client-generated `requestId`.
  - Both: retry serializable conflicts internally a small bounded number of times.
- Store only stable identity in the session: `userId`, `role`, `displayName`. Always read balances and mutable market state from authoritative services, not from the session object.
- Make valuation server-authoritative. Client-side portfolio values can remain for responsiveness, but leaderboard, admin monitor, and reveal must all come from one shared valuation function with explicit money rounding.
- Replace “leaderboard every 30 seconds” with “cached every 30 seconds, forced recompute on round end, reveal, halt, and any manual correction.”
- Remove or defer ambiguous MVP features: `loan_balance`, demand-signal price nudges, and any mechanic that changes trade rules per user. They add correctness surface before the core is hardened.
- Add one small but high-value recovery layer:
  - `GET /health` checks DB connectivity and last tick freshness.
  - Pre-event manual DB dump/export.
  - Spare admin and spare participant accounts created ahead of time.
  - Prepared repair scripts for password reset and trade reversal instead of freehand SQL.

## Interface Changes
- Add `market_state` and `admin_events` tables.
- Change trade endpoints to require `requestId` and return the authoritative executed price, updated balances, and holding state.
- Add a server-generated state snapshot shape used by HTTP bootstrap and Socket.IO reconnect: `{ prices, marketState, leaderboard, recentNews }`.
- Make `/display` explicitly read-only and unauthenticated, or protect it with a simple signed display token instead of the participant/admin session model.
- Use migrations for deployment: local prototyping can use `db push`, but production deploys should use committed migrations plus `prisma migrate deploy`.

## Implementation Blueprint
- Phase 1: Architecture hardening
  - Lock the same-origin deployment model, environment contract, migration workflow, seed strategy, and persisted market state before writing UI-heavy code.
  - Define canonical market services: auth/session, market state, pricing, valuation, trade execution, admin events, bootstrap snapshot.
- Phase 2: Core invariants first
  - Implement money helpers and valuation rules.
  - Implement buy/sell with full row-lock strategy, idempotency, and retry handling.
  - Implement startup recovery from DB-backed sessions plus `market_state`.
  - Implement the serialized market mutation path for ticks, shocks, news, halt, and round changes.
- Phase 3: Real-time and operator flows
  - Build participant, admin, and display clients against the same snapshot/broadcast contract.
  - Design participant UI for mixed device use from the start: mobile-safe primary trade flow, desktop density where it helps, no desktop-only assumptions.
  - Add admin preview and confirmation flows for news/shock actions, plus read-only monitoring views.
- Phase 4: Rehearsal and freeze
  - Freeze feature scope after core rehearsal.
  - Optional mechanics only enter after the team proves restart recovery, reconnect recovery, accurate reveal, and smooth admin operation on deployed URLs.

## Test Plan
- Concurrency: two users buying the last share; one user sending simultaneous buys across two stocks; concurrent sells on one holding; duplicate request replay after timeout.
- Recovery: server restart mid-round preserves session, round state, halt state, reveal state, and price snapshot; reconnect restores the same view on participant, admin, and display clients.
- Market consistency: admin shock fired during a tick results in one bounded final price and one coherent broadcast, not two competing writes.
- Leaderboard correctness: reveal immediately after a major shock or manual correction shows the same ordering in admin preview, display, and API output.
- Auth and access: participant, admin, and display access paths all work without cross-origin cookie edge cases.
- UX: participant can log in, select a stock, and complete a trade quickly on both phone and laptop; admin can complete any core action in under 30 seconds.
- Ops: pre-event warm-up, DB export, spare-account use, halt/resume, and scripted repair steps are rehearsed by non-developers.

## Assumptions and Defaults
- Budget stays strict zero-cost.
- Participant devices are mixed; the system cannot assume laptop-only use.
- One event runs at a time; multi-event tenancy is out of scope.
- Core event reliability takes priority over optional mechanics; optional mechanics remain post-rehearsal additions.
- External checks that informed the infra refinements:
  - [Render free instance limitations](https://render.com/docs/free)
  - [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
  - [Supabase backups](https://supabase.com/docs/guides/platform/backups)
  - [Prisma `db push`](https://www.prisma.io/docs/cli/db/push)
  - [Prisma `migrate deploy`](https://docs.prisma.io/docs/cli/migrate/deploy)
