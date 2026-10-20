# AI Gateway Console

Web console to see every AI request, understand cost, and change model routing safely. Client-server app: React console in the browser, TypeScript backend with Postgres. All traffic is simulated by the backend (D1, D15).

## Source of truth

Requirements are **frozen** (2026-10-20). Read before building any slice:

- `docs/intent.md`: problem and success criteria.
- `docs/spec.md`: screens, FR-1..FR-32, NFR-1..NFR-17, data entities, flows A–H. Cite FR/NFR ids in commits and tests.
- `docs/decisions.md`: how we build it and where we simplify (D1–D15). **Later entries override earlier ones and `spec.md`** where they differ (D13, D14, D15).
- `docs/plan.md`: task checklist. One task = one issue = one PR.

`intent.md` and `spec.md` stay unedited. A requirement change or new clarification becomes a new `D<n>` entry at the bottom of `decisions.md`; a replaced entry is marked replaced, never deleted. Ask the user before adding one.

## Stack (D9, D14, D15)

pnpm workspaces monorepo:

- `apps/web`: React + TypeScript + Vite, Tailwind v4 + shadcn/ui (Radix), Zustand, TanStack Table + Virtual, Apache ECharts (tree-shaken `echarts/core`), React Router.
- `apps/api`: Node + Hono, Drizzle ORM, Postgres (PGlite for local dev and tests, `DATABASE_URL` for hosted), Server-Sent Events.
- `packages/contracts`: Zod schemas and types shared by web and api.
- Tests: Vitest everywhere, React Testing Library in web. Lint/format: Biome.

No real model calls. Secrets only in backend config, never in browser code (NFR-8).

## Architecture invariants

- **Gateway client seam (D1, D15):** every screen reads data and sends route changes only through the web gateway client interface. Its implementation talks HTTP + SSE to `apps/api`. Screens never call `fetch` directly.
- **Simulator in backend (D2, D15):** seeded (`SIM_SEED`), writes requests to the DB in batches, follows current routing rules, fails 3–5% with fallback.
- **Chat seam (D6, D15):** text → action goes through one interface; the rule-based parser runs in the backend (`POST /api/chat`). Chat proposes; it never applies (FR-26, NFR-5). Client checks the returned action against the fixed allow-list and always shows what was understood (FR-28, NFR-7).
- **Route change path:** every change (click, chat, undo) goes through the same review step → Confirm → backend confirmation. The role check lives in the backend route-change handler (NFR-6); the UI only mirrors it. UI shows the new route only after the backend confirms (FR-32).
- **Auth seam (D4, D15):** role picker → backend session in httpOnly signed cookie. One module, replaceable by real sign-in.
- **Performance (D7, D8):** browser loads snapshot then follows SSE; requests live in a Zustand store outside components, max 50k; live updates batched ~250 ms; table virtualised; charts read time-bucket aggregates, never raw rows; filters run on store data. Targets: 60fps scroll at 10k rows, filter < 100 ms, no input freeze at 20 req/s (NFR-1..3).
- **Determinism (D2):** simulator accepts a fixed seed; tests use it.
- Prices are example values in a single config file (D3), in `packages/contracts` or `apps/api` config.

## Workflow

Each `docs/plan.md` task: GitHub issue → branch `<issue#>-<slug>` → PR to `main` with `Closes #<issue#>` → merge → tick checkbox in `plan.md` → next task.

## Build order (D12, adapted by D15)

See `docs/plan.md`. Slices: 0 setup, 1 backend + gateway client, 2 Live Requests, 3 Cost & Speed, 4 Routing + History, 5 role checks, 6 chat, 7 perf, README, deploy.

## Testing (NFR-14)

Required coverage: cost calculation, routing rules, role checks, chat request understanding. A slice is done when its FRs work in the running app and its tests pass.

## Out of scope (D10)

Real accounts, real model calls or billing, email/chat alerts, phone-first layout.
