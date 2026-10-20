# Screens: AI Gateway Console

Screen inventory derived from `spec.md`, `decisions.md` (D1–D13) and `intent.md`. This file lists what to build; it adds no new requirements. Where it and the source docs differ, the source docs win (D13 over `spec.md`).

## Summary

| #   | Screen / surface         | Kind              | Who sees it       | Slice (D12) | Key requirements                    |
| --- | ------------------------ | ----------------- | ----------------- | ----------- | ----------------------------------- |
| S0  | Sign in (role picker)    | Full page         | Signed-out users  | 5           | FR-1, D4, D13.1                     |
| S1  | App shell                | Layout            | All signed in     | 2           | FR-2, FR-24, FR-31, NFR-9, NFR-11   |
| S2  | Live Requests            | Main screen       | Viewer, Admin     | 2           | FR-3..FR-9, FR-30, NFR-1..3         |
| S2a | Request detail panel     | Side panel        | Viewer, Admin     | 2           | FR-7, FR-8                          |
| S3  | Cost & Speed             | Main screen       | Viewer, Admin     | 3           | FR-10..FR-15, D8                    |
| S4  | Routing                  | Main screen       | Viewer (RO), Admin| 4, 5        | FR-16, FR-17, FR-21                 |
| S5  | Review step              | Modal dialog      | Admin             | 4           | FR-18, FR-19, FR-32, D13.9, D13.10  |
| S6  | History                  | Main screen       | Viewer, Admin     | 4           | FR-22, FR-23, D13.12                |
| S7  | Ask your gateway (chat)  | Side panel        | Viewer, Admin     | 6           | FR-24..FR-28, NFR-5, NFR-7, D6      |
| S8  | Developer controls       | Collapsible panel | All roles         | 1, 7        | D2, D13.8, D13.9, D13.14            |

Four main screens (S2, S3, S4, S6), one entry page (S0), one shared modal (S5), two side panels (S2a, S7), and the shell plus dev panel that wrap everything.

---

## S0. Sign in (role picker)

Entry page when no user is stored.

- Name input and role choice: Viewer or Admin (D4).
- "Sign in" button. Chosen user is saved in local storage until sign-out (D13.1, D13.13).
- One short line saying what the console is (NFR-9).
- After sign-in → Live Requests.

**States:** empty name → button disabled with hint.

---

## S1. App shell

Wraps every signed-in screen.

- **Top bar:** app name; signed-in name and role badge; Sign out button (FR-2).
- **Navigation:** Live Requests · Cost & Speed · Routing · History.
- **Connection banner:** "Disconnected — reconnecting…" while the stream is down; keeps current data on screen; disappears after reconnect and backfill (FR-31, Flow H).
- **Chat panel slot:** S7 docked on the side of every screen, can be opened/closed (FR-24). Loaded on demand (NFR-4).
- **Dev controls slot:** S8.
- **Toasts / inline errors:** e.g. route change failed (FR-32).
- Keyboard reachable nav and buttons; status never shown by colour alone (NFR-11).

---

## S2. Live Requests (default landing screen)

- **Intro line:** one sentence explaining the table (NFR-9).
- **Toolbar:**
  - Filters: feature, model, status (success / failed / fallback), time range (last 5 min / last hour / all data) (FR-5, D13.5). Team filter used by chat (D6) should be visible here too so chat-applied filters are shown.
  - Search by request ID (FR-6).
  - Pause / Resume, with a "N new requests" count while paused; Resume catches up (FR-4).
  - Active-filter chips with clear-all (so chat filters are visible and removable).
  - Row count (filtered / total).
- **Table:** newest first; columns time, feature, model used, status, latency, tokens, cost (FR-3). Fallback badge with icon + label (FR-8). Virtualised, 10k+ rows (FR-9, NFR-1). Rows clickable and keyboard selectable.
- **States:** loading seed data; no rows match filters (with "clear filters"); stream disconnected (banner from S1).

### S2a. Request detail panel

Opens on row click (FR-7).

- Request ID, timestamp, feature, team.
- Planned model vs served model.
- Status with icon + label.
- Input tokens, output tokens, cost, latency.
- Error reason when failed.
- Fallback explanation, e.g. "Opus timed out, so it was routed to Sonnet" (FR-8). Note per D13.7: latency includes the failed attempt; cost is for the served model; failed = cost 0.
- Close button; Esc closes.

---

## S3. Cost & Speed

- **Time range switch:** last 5 min / last hour / all data (FR-15).
- **KPI tiles:** total spend; failed count + %; fallback count + % (FR-11, FR-14).
- **Spend by model** and **spend by feature** breakdowns (FR-11).
- **Spend over time** chart (FR-12).
- **Latency over time** chart: p50 and p95 lines (FR-13).
- **Price table:** model name, provider, input and output price per 1M tokens, marked "example prices" (FR-10, D3).
- Charts read time-bucket aggregates, not raw rows (D8). Charts loaded on demand (NFR-4).
- **States:** loading; no data in range.

---

## S4. Routing

- **Feature list:** one row per feature: name, team, current main model, backup model, last updated (FR-16).
- **Admin:** model pickers for main and backup per feature; choosing a value opens S5 — nothing changes yet (FR-17, FR-18).
- **Viewer:** same list, pickers disabled, short note "Only Admins can change routes" (FR-21, Flow F).
- **Pending state:** while the gateway confirms (~300 ms, D13.9) the row shows "applying…" and still the old route (FR-32).
- **Error state:** on failure, inline error and old route kept (FR-32).

---

## S5. Review step (shared modal)

One dialog used by every route change: Routing click, chat proposal, History undo.

- Feature name and source (click / chat / undo).
- What changes: old main → new main, old backup → new backup.
- Estimated cost change in % with basis note ("based on last hour of traffic" or "all data" when < 50 requests) (FR-18, D13.10).
- **Confirm** and **Cancel** (FR-19). Cancel = no change.
- Confirm disabled for Viewers; role re-checked in apply code (NFR-6).
- While confirming: button busy; on failure, error shown in dialog and route unchanged (FR-32).
- Focus trapped; Esc = Cancel (NFR-11).

---

## S6. History

- **Change list**, newest first: time, who, feature, old → new main, old → new backup, source badge (click / chat / undo), estimated cost change (FR-22).
- **Undo** button on the latest change per feature, Admin only; opens S5 with source `undo`, restoring both old main and old backup (FR-23, D13.12, Flow G).
- Viewer: Undo hidden or disabled with note.
- **States:** empty ("No route changes yet").

---

## S7. Ask your gateway (chat panel)

Side panel on every screen (FR-24).

- **Message list:** user and assistant messages.
- **"Understood" block** on every assistant reply, e.g. `Filter: feature = support-bot, status = failed, time = today` (FR-28).
- **Action results:**
  - Filter → applies filters to Live Requests (navigates there if needed) and says what it did (FR-25).
  - Cost question → answer from app data only (D6, NFR-7).
  - Route change → "Review change" opens S5 with the suggested model; never applies (FR-25, FR-26, NFR-5, D13.11).
- **Polite fallback:** not understood, Viewer asking for a change, or no cheaper model → says so and suggests what it can do (FR-27, Flow F).
- **Input:** text box + send; example prompts as quick chips for first-time users.
- Loaded on demand (NFR-4).

---

## S8. Developer controls

Small collapsible panel, visible to every role (D13.14).

- Request rate: 1 / 5 / 20 per second (D2).
- Drop connection for N seconds (D13.8).
- Fail next route change (D13.9).
- Marked clearly as simulator controls (D1, D11).

---

## Cross-screen states (NFR-12)

Every main screen needs: **loading**, **empty**, **error**. Plus app-wide: **disconnected** banner (S1) and **route change failed** message (S4/S5).

## Flow coverage

| Flow | Screens                                 |
| ---- | --------------------------------------- |
| A    | S0 → S2 → S2a                           |
| B    | S2 (status = failed) → S2a              |
| C    | S0 (Admin) → S4 → S5 → S2 / S3 → S6     |
| D    | S7 → S5 → S6                            |
| E    | S7 → S2                                 |
| F    | S0 (Viewer) → S4 (disabled) → S7        |
| G    | S6 → S5 → S6                            |
| H    | S8 (drop) → S1 banner → S2 backfill     |
