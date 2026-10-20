# Plan: AI Gateway Console

Task checklist derived from `spec.md`, `screens.md` and `decisions.md` (D1–D15). Adds no requirements.

## Workflow

Each task below is one unit of work:

1. Open a GitHub issue for the task (title = task title, body = scope + FR/NFR/D ids + done-when).
2. Branch `<issue#>-<slug>` from `main`.
3. Open a PR to `main` with `Closes #<issue#>`. Tests and lint pass in CI.
4. Merge. The issue closes automatically.
5. Tick the box here (in the same PR or the next one), then start the next task.

A slice is done when its FRs work in the running app and its tests pass (NFR-14).

---

## Slice 0: Setup

- [ ] **0.1 Docs: D14, D15, plan.** Record frontend picks and client-server architecture; update `CLAUDE.md`; add this plan.
- [ ] **0.2 Monorepo scaffold.** pnpm workspaces (`apps/web`, `apps/api`, `packages/contracts`), shared `tsconfig`, Biome, Vitest in each package, root scripts (`dev`, `build`, `test`, `lint`, `typecheck`). Done when `pnpm dev` starts web + api and `pnpm test` passes.
- [ ] **0.3 CI.** GitHub Actions on PR: install, lint, typecheck, test.
- [ ] **0.4 Web base.** Vite + React + TS, Tailwind v4, shadcn/ui init (Radix), Inter font, lucide-react, React Router. Vite dev proxy `/api` → api.

## Slice 1: Backend, simulator, gateway client

- [ ] **1.1 Contracts.** Zod schemas + types for User, Model, Feature, RoutingRule, Request, RouteChange, ChatMessage (spec §4, D13.2, D13.3, D13.7) and API request/response shapes.
- [ ] **1.2 Prices + cost calculation.** Example prices in one config file (D3); `cost(model, inputTokens, outputTokens)`; tests (NFR-14).
- [ ] **1.3 Database.** Drizzle schema + migrations: `routing_rules`, `route_changes`, `sessions`, `requests` (indexed on timestamp, feature, model, status). PGlite for dev/test, Postgres via `DATABASE_URL`. Seed 5 features and default rules.
- [ ] **1.4 Simulator engine (pure).** Seeded PRNG; request generation by rules; 3–5% failures with fallback; latency/cost per D13.7; size and speed by model (D2). Tests with fixed seed.
- [ ] **1.5 Simulator runner.** Ticks at the configured rate (1/5/20 per second), batch insert, seeds 10k over the last 3 h when the table is empty (D13.4), trims to latest 200k (D15.4).
- [ ] **1.6 Read API.** `GET /api/models`, `/features`, `/routes`, `/history`, `/requests?since=&limit=` (FR-29).
- [ ] **1.7 Live stream.** `GET /api/stream` SSE, ~250 ms batches with event ids (FR-30, D7, D15.6).
- [ ] **1.8 Session + role middleware.** `POST/DELETE /api/session`, signed httpOnly cookie `{name, role}`, `requireRole('admin')` (D4, D15.7). Role check tests (NFR-14).
- [ ] **1.9 Route change API.** `POST /api/routes/estimate` (D13.10); `POST /api/routes/:featureId/changes` with role check, ~300 ms confirm, history write with source, simulator picks up new rule (FR-17..FR-20, FR-22, FR-32, NFR-6). Routing rule tests (NFR-14).
- [ ] **1.10 Developer controls API.** Global rate, global fail-next route change, per-connection stream drop (D13.8, D13.9, D15.12).
- [ ] **1.11 Web gateway client.** Interface (D1 seam) + HTTP/SSE implementation; reconnect with `since` backfill (FR-31); tests against a fake.

## Slice 2: Live Requests

- [ ] **2.1 Request store.** Zustand store outside components; snapshot load; 250 ms batch apply; 50k cap (D13.6); filter selectors for feature, team, model, status, time range, request ID (FR-5, FR-6, D13.5). Filter tests incl. < 100 ms at 10k (NFR-2).
- [ ] **2.2 App shell + sign in.** S0 role picker, top bar with name/role/sign out, nav, connection indicator, disconnected/reconnected banner (FR-1, FR-2, FR-31, NFR-9, NFR-11).
- [ ] **2.3 Live Requests table.** Virtualised TanStack table, newest first, columns per FR-3, status icon + label, fallback badge (FR-3, FR-8, FR-9, NFR-1). Keyboard row selection.
- [ ] **2.4 Toolbar.** Filters, ID search, time range, active-filter chips + clear all, row count, Pause/Resume with "N new" (FR-4, FR-5, FR-6).
- [ ] **2.5 Detail panel.** S2a: planned vs served model, tokens, cost, latency, error reason, fallback explanation; Esc closes (FR-7, FR-8).
- [ ] **2.6 Developer controls panel.** S8 collapsible, rate / drop / fail next, marked as simulator (D13.14).
- [ ] **2.7 States.** Loading, empty ("No requests match these filters"), error (NFR-12).

## Slice 3: Cost & Speed

- [ ] **3.1 Time-bucket aggregates.** Incremental buckets on the store: spend, count, failed, fallback, p50/p95 latency (D8). Tests.
- [ ] **3.2 ECharts hook.** `useEChart` with tree-shaken `echarts/core`, resize, dispose, theme from Tailwind tokens (D14.1). Lazy-loaded route (NFR-4).
- [ ] **3.3 Cost & Speed screen.** KPI tiles, spend over time, latency p50/p95, spend by model and by feature, price table marked "example prices", time range switch, states (FR-10..FR-15, NFR-12).

## Slice 4: Routing and History

- [ ] **4.1 Routing screen.** S4 feature list with main/backup pickers; picking opens review; "Applying…" pending and inline error keeping old route (FR-16, FR-17, FR-32).
- [ ] **4.2 Review step.** S5 shared modal: source badge, old → new main and backup, estimate with basis note, Confirm/Cancel, busy and error states, focus trap, Esc = Cancel (FR-18, FR-19, FR-32, NFR-11).
- [ ] **4.3 History screen.** S6 list newest first, source badge, estimate; empty state (FR-22, NFR-12).
- [ ] **4.4 Undo.** Undo latest change per feature → review step with source `undo`, restores old main and backup (FR-23, D13.12).

## Slice 5: Role checks

- [ ] **5.1 Viewer UI.** Routing pickers disabled with "Only Admins can change routes", Undo hidden/disabled, Confirm disabled (FR-21, Flow F).
- [ ] **5.2 Role tests end to end.** Viewer session gets 403 from the change API even with a crafted request; UI tests for disabled controls (NFR-6, NFR-14).

## Slice 6: Chat

- [ ] **6.1 Chat parser (backend).** Rule-based parser: filters (feature, team, model, status, time incl. "today" = since local midnight), cost questions from stored data, route proposals ("cheaper" per D13.11 + D14.4, named model), not-understood, Viewer refusal. Fixed allowed-action list. Tests (NFR-14, NFR-7).
- [ ] **6.2 Chat API.** `POST /api/chat` → `{understood, action}`; never applies changes (FR-26, NFR-5).
- [ ] **6.3 Chat panel.** S7 side panel, lazy-loaded, "Understood" block, example chips, filter actions drive Live Requests, "Review change" opens S5 with source `chat` (FR-24..FR-28, NFR-4).

## Slice 7: Performance, README, deploy

- [ ] **7.1 Performance pass.** Measure by hand in DevTools: scroll fps at 10k rows, filter ms, input responsiveness at 20/s; fix hot spots; record one before/after (NFR-1..3, D14.5).
- [ ] **7.2 README.** Problem, screenshot, measured numbers + method, key decisions, what is simulated, link to `decisions.md` (NFR-16, NFR-17, D11).
- [ ] **7.3 Hosting decision.** New `D<n>` entry: where web, api and Postgres run.
- [ ] **7.4 Deploy.** Public link (NFR-15). Done by the user.
