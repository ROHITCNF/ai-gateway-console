# Decisions: AI Gateway Console

This file records the choices we made to keep the project buildable by one person, and why. `intent.md` and `spec.md` describe the full system. This file says how we build it and where we simplify.

If a decision changes, add a new entry at the bottom and mark the old one as replaced. Do not delete old entries.

> **Status: requirements FROZEN (2026-10-20).** `intent.md` and `spec.md` are frozen. Any change or clarification is a new entry here.

---

## D1. The request data is simulated

> **Partly replaced by D15:** the data is still simulated, but the simulator runs in the backend, not the browser. The gateway client seam stays.

**Decision:** The data in this project is simulated. No real AI model is called, and nothing here is real company traffic.

**What it means:** The console talks to a gateway API, as described in `spec.md`. In this project that API is implemented by a local simulator that runs in the browser. It creates requests, follows the current routing rules, fails some requests, and uses the backup model when that happens.

**Why:**

- It costs nothing. There are no API keys to protect.
- It is repeatable, so we can test and measure performance properly.
- It is safe to publish on GitHub.

**Keeping it replaceable:** All screens get their data through one small interface, called the gateway client. The simulator is one implementation of it. A real gateway could be connected later by writing a second implementation, without changing the screens.

---

## D2. How the simulator behaves

**Decision:** The simulator follows these rules.

- **Features:** five example features: support-bot, code-review, search-summary, invoice-reader and onboarding-helper, each owned by a team.
- **Models:** seven example models: a large, a medium and a small model, plus Grok, GPT, Gemini and a self-hosted model.
- **Failures:** about 3% to 5% of requests to any model fail or time out. The backup model then answers, so fallbacks show up on screen.
- **Speed and size:** bigger models are slower and cost more. Token counts are random but realistic.
- **Starting data:** the app starts with 10,000 requests already in the log, so the table and charts are never empty and the performance target can be tested straight away.
- **Live traffic:** new requests then keep arriving. The default is one per second. A small developer control can switch to 5 or 20 per second for performance testing.
- **Repeatable runs:** the simulator can use a fixed seed, so tests get the same data every time.

**Why:** It makes the console look and behave like it is connected to a busy system, and it gives us a controlled way to test speed.

---

## D3. Model prices are example values

**Decision:** The model prices are example numbers, not real prices. They live in one config file and are marked as examples there.

**Why:** Real prices change often and we are not billing anyone. One file makes them easy to change.

---

## D4. Sign-in is a role picker

**Decision:** There are no real accounts. The sign-in screen lets the person choose a name and a role (Viewer or Admin).

**What it means:** The rest of the app behaves as if the role was assigned by the company. Permission checks still run in the code that applies a route change, not only in the buttons. Real sign-in could replace the role picker later by swapping one module.

**Why:** Real accounts add work (passwords, a database, password reset) that does not help show the main product.

---

## D5. Storage is in the browser

> **Replaced by D15:** storage is in a Postgres database behind the backend.

**Decision:** There is no server and no database. Routing rules and route history are saved in the browser's local storage, so a refresh keeps them. Requests are generated again each time the app starts.

**Why:** It keeps deployment simple (a static site) and removes a whole area of work.

---

## D6. The chat panel uses fixed rules, not an AI model

**Decision:** The chat panel understands requests with pattern matching and a small list of known words (feature names, model names, "failed", "today", "cheaper" and so on). It does not call an AI model.

**What it understands:**

- Filter requests by feature, model, status, team and time.
- Questions about cost, for example "how much did support-bot cost today".
- Suggesting a route change, for example "move support-bot to a cheaper model".

**What stays the same either way:**

- It always shows what it understood.
- It never applies a change. Only the Confirm click does.
- A Viewer asking for a change gets a polite refusal.

**Why:** No real model calls means no keys, no cost, and predictable behaviour that is easy to test.

**Keeping it replaceable:** The panel uses one interface to turn text into an action. An AI-based version could replace the rule-based one later.

---

## D7. Live updates are batched

**Decision:** New requests come in through a subscribe interface, the same shape a real live stream would have. The app collects them and updates the screen in batches (about every 250 ms) instead of once per request.

**Why:** Updating the screen on every single request would make the table stutter at higher speeds.

---

## D8. How we keep the table fast

**Decision:**

- The table only draws the rows on screen (virtualisation), using TanStack Table and TanStack Virtual.
- The 10,000+ requests live in a store (Zustand), outside the components.
- Charts do not use raw rows. We group requests into time buckets (for example every 10 seconds) and update those totals as new requests arrive.
- Filters run on the stored data, not on drawn rows.

**Why:** These are the usual causes of slow tables and charts. Deciding this early avoids rewrites.

---

## D9. Tech stack

> **Partly replaced by D14 (charts, UI kit) and D15 (backend, deployment).**

**Decision:**

- React, TypeScript and Vite.
- Zustand for state.
- TanStack Table and Virtual for the log.
- Recharts for charts.
- Vitest and React Testing Library for tests.
- Deployed as a static site on Vercel.

**Why:** Familiar tools, no backend, quick to build and quick to deploy.

---

## D10. What we are not building

- Real user accounts, passwords or multiple organisations.
- Real model calls or real billing.
- Alerts by email or chat.
- A phone-first layout. The app should be readable on a phone, but laptops come first.

**Why:** Each of these is large and none is needed to show the core product: see requests, understand cost, change routes safely.

---

## D11. The README says what is simulated

**Decision:** The README links to this file, so anyone reading the project can see which parts are simulated and which are built for real.

**Why:** It keeps the project honest and saves readers from guessing.

---

## D12. Build order

**Decision:** We build in small slices, each one working before the next starts.

1. Gateway client interface and the simulator, with a few tests.
2. Live Requests table with filters and the detail panel.
3. Cost & Speed screen.
4. Routing screen with the review step, and History with undo.
5. Role checks.
6. Chat panel.
7. Performance measuring, README and deployment.

**Why:** Each slice can be shown on its own, and the hardest part (the fast table) comes early, when it is cheapest to fix.

---

## D13. Requirements frozen, with clarifications

> **Points 1, 6, 8 and 13 partly replaced by D15. Point 11 clarified by D14.**

**Decision:** `intent.md`, `spec.md` and D1–D12 are frozen as of 2026-10-20. The points below close gaps found in the spec. Where they differ from `spec.md`, this entry wins.

1. **Sign-in (FR-1, Roles):** the D4 role picker replaces company-assigned roles. The chosen user is kept in local storage until sign-out.
2. **Models (D2):** ids are `claude-opus` (large), `claude-sonnet` (medium), `claude-haiku` (small), `grok`, `gpt`, `gemini`, `self-hosted`. Prices live in one config file (D3).
3. **Features and teams (D2, Flow E):** support-bot → Customer Support, code-review → Developer Platform, search-summary → Search, invoice-reader → Payments, onboarding-helper → Growth.
4. **Starting data (D2):** the 10,000 seed requests are spread over the 3 hours before app start, so "last 5 minutes", "last hour" and "all data" all show different results.
5. **Time ranges (FR-5, FR-15):** both screens offer last 5 minutes, last hour, all data. In the chat panel "today" means since local midnight.
6. **Memory cap:** the request store keeps at most 50,000 requests and drops the oldest. This keeps long sessions at 20/s from growing without limit.
7. **Request outcome (data entities):** `fallback` means the planned model failed and the backup answered; cost and tokens are for the served model, latency includes the failed attempt. If the backup also fails, status is `failed` and cost is 0.
8. **Disconnect (FR-31, Flow H):** a developer control drops the simulated stream for a chosen time. The simulator keeps generating during the drop. On reconnect the client fetches missed requests with a "requests since timestamp" call, then resumes the stream.
9. **Route change confirmation (FR-32):** the simulator confirms a route change after a short delay (about 300 ms). A developer control makes the next change fail, to test the error path.
10. **Estimated cost change (FR-18):** computed from the feature's requests in the last hour (all data if fewer than 50): same token counts priced at the new model vs the old model, shown as a percentage.
11. **"Cheaper model" in chat (FR-25):** the suggestion is the model with the lowest estimated cost for that feature, excluding its current main model. If none is cheaper, the panel says so and makes no proposal.
12. **Undo (FR-23):** restores both the old main and old backup model of the latest change for that feature. It goes through the review step and is recorded with source `undo`.
13. **Persistence (D5):** local storage holds routing rules, route history and the signed-in user. Requests are not stored.
14. **Developer controls:** request rate (1/5/20 per second), drop connection, fail next route change. They sit in a small collapsible panel, visible to every role.

**Why:** These were open in the spec and would otherwise be decided ad hoc during the build.

---

## D14. Frontend libraries and chat backup rule

**Decision:**

1. **Charts:** Apache ECharts replaces Recharts. Import from `echarts/core` and register only the parts we use (line chart, grid, tooltip, legend, canvas renderer). A small in-house `useEChart` hook handles init, updates, resize and dispose. Charts still read time-bucket aggregates (D8) and load only with the Cost & Speed screen (NFR-4). Simple bar breakdowns (spend by model or feature) are plain CSS bars.
2. **UI kit:** Tailwind CSS v4 and shadcn/ui built on Radix primitives. Radix gives the dialog focus trap and keyboard behaviour the review step needs (NFR-11).
3. **Table stays:** TanStack Table and TanStack Virtual (D8) are kept. AG Grid was considered and rejected: large bundle on the landing screen, its own row state next to the store, and its own styling system.
4. **Chat "cheaper model" (D13.11):** the proposal changes only the main model. The backup model stays as it is. Where the design reference shows the backup changing too, this entry wins.
5. **Performance numbers (NFR-16):** measured by hand in Chrome DevTools (Performance panel for frame rate, `performance.measure` for filter time). The README states the method next to the numbers.

**Why:** ECharts copes well with live updates. shadcn and Tailwind match the design references. Keeping the backup unchanged makes chat proposals simple and predictable.

---

## D15. Client-server architecture with a database

**Decision:** The console is a client-server app. The browser only renders. All data, including the simulated traffic, comes from our own backend.

1. **Repository:** TypeScript monorepo with pnpm workspaces: `apps/web` (the console), `apps/api` (the backend), `packages/contracts` (shared Zod schemas and types for every entity in `spec.md` §4 and every API call).
2. **Backend:** Node.js and Hono. The simulator (D2) runs inside the backend as a long-running process. It uses a fixed seed from config (`SIM_SEED`), so tests stay repeatable.
3. **Database:** Postgres, accessed through Drizzle ORM with migrations. Tables: routing rules, route history, sessions and requests. Local development and tests use PGlite (Postgres compiled to run inside Node, no install needed). A hosted Postgres is used later through `DATABASE_URL`.
4. **Requests are stored:** every simulated request is written to the database in batches. If the requests table is empty when the backend starts, it seeds 10,000 requests over the 3 hours before start (D13.4). The database keeps the latest 200,000 requests and trims older ones. The browser store still keeps at most 50,000 (D13.6).
5. **Gateway client seam (D1):** the browser's gateway client talks to the backend over HTTP and a live stream. Screens do not change if the backend's simulator is later replaced by a real gateway.
6. **Live stream:** Server-Sent Events. Events are batched about every 250 ms (D7) and carry ids, so a reconnecting client can fetch what it missed with `GET /api/requests?since=` (FR-31, D13.8).
7. **Sign-in (D4, D13.1):** the role picker stays. The backend creates the session and stores the name and role in an httpOnly signed cookie. The browser does not keep the user in local storage.
8. **Role checks (NFR-6):** the backend's route-change handler checks the role from the session. The UI only mirrors that check.
9. **Route changes (FR-32, D13.9, D13.10):** the backend computes the cost estimate, waits about 300 ms, applies the change, records history and then confirms. The UI shows the new route only after that confirmation.
10. **Chat (D6):** the rule-based parser runs in the backend behind `POST /api/chat`, so a future AI version keeps any keys on the server (NFR-8). The browser still checks that the returned action is on the allowed list and never applies a change itself (NFR-5, NFR-7).
11. **Filtering and charts stay in the browser (D8):** the browser loads a snapshot, then follows the stream. Filters and time buckets run on the browser store, so the 100 ms filter target holds.
12. **Developer controls (D13.14):** request rate and "fail next route change" are global to the backend, so they affect every viewer of the demo. "Drop connection" affects only the client that pressed it.
13. **Secrets (NFR-8):** any secret lives only in backend config. Nothing secret is sent to or built into the browser.
14. **Hosting:** decided at the last slice, as a new entry. The backend needs a long-running host, because of the simulator and the live stream.

**Why:** It matches how a real console would work, puts permission checks where they cannot be bypassed, and keeps secrets out of the browser, while the data stays simulated.

---

## D16. Local database: Neon when configured, PGlite otherwise

> Clarifies D15.3.

**Decision:**

1. When `DATABASE_URL` is set in `apps/api/.env`, the backend uses that Postgres. For local development this is a Neon `dev` branch, reached through its direct (not pooled) connection string with `sslmode=require`, using the `postgres` (postgres.js) driver.
2. When `DATABASE_URL` is not set, the backend uses PGlite, so the project runs after a fresh clone with no setup.
3. Tests always use PGlite, never `DATABASE_URL`. They stay fast, isolated and offline, and CI needs no secret.
4. `SIM_ENABLED=false` runs the backend without the simulator, so the database is not written to all the time.
5. The connection string is a secret (NFR-8). It lives only in the git-ignored `.env`. A committed `.env.example` holds placeholders only.

**Why:** The developer already has a Neon project and wants to work against real Postgres locally. The simulator writes all the time, which keeps Neon's compute awake and uses up free-tier hours, so it can be switched off.
