# AI Gateway Console

Web console to see every AI request, understand cost, and change model routing safely. Static React app; all data comes from an in-browser simulated gateway.

## Source of truth

Requirements are **frozen** (2026-10-20). Read before building any slice:

- `docs/intent.md`: problem and success criteria.
- `docs/spec.md`: screens, FR-1..FR-32, NFR-1..NFR-17, data entities, flows A–H. Cite FR/NFR ids in commits and tests.
- `docs/decisions.md`: how we build it and where we simplify (D1–D13). **D13 overrides `spec.md`** where they differ.

`intent.md` and `spec.md` stay unedited. A requirement change or new clarification becomes a new `D<n>` entry at the bottom of `decisions.md`; a replaced entry is marked replaced, never deleted. Ask the user before adding one.

## Stack (D9)

React + TypeScript + Vite, Zustand, TanStack Table + Virtual, Recharts, Vitest + React Testing Library. Static deploy on Vercel. No backend, no database, no real model calls, no API keys in code (NFR-8).

## Architecture invariants

- **Gateway client seam (D1):** every screen reads data and sends route changes only through the gateway client interface. The simulator is one implementation; a real gateway must be swappable without touching screens.
- **Chat seam (D6):** text → action goes through one interface. The rule-based parser is one implementation. Chat proposes; it never applies (FR-26, NFR-5). It acts only from a fixed list of allowed actions and always shows what it understood (FR-28, NFR-7).
- **Route change path:** every change (click, chat, undo) goes through the same review step → Confirm → gateway confirmation. The role check lives in the code that applies the change, not only in the UI (NFR-6). UI shows the new route only after the gateway confirms (FR-32).
- **Auth seam (D4):** role picker is one module, replaceable by real sign-in.
- **Performance (D7, D8):** requests live in a Zustand store outside components; live updates batched ~250 ms; table virtualised; charts read time-bucket aggregates, never raw rows; filters run on store data. Targets: 60fps scroll at 10k rows, filter < 100 ms, no input freeze at 20 req/s (NFR-1..3).
- **Determinism (D2):** simulator accepts a fixed seed; tests use it.
- Prices are example values in a single config file (D3).

## Build order (D12)

Build in slices, each working and tested before the next:

1. Gateway client interface + simulator, with tests.
2. Live Requests table, filters, detail panel.
3. Cost & Speed screen.
4. Routing with review step; History with undo.
5. Role checks.
6. Chat panel.
7. Performance measuring, README, deployment.

## Testing (NFR-14)

Required coverage: cost calculation, routing rules, role checks, chat request understanding. A slice is done when its FRs work in the running app and its tests pass.

## Out of scope (D10)

Real accounts, real model calls or billing, email/chat alerts, phone-first layout.
