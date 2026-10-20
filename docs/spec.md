# Spec: AI Gateway Console

> **Status: FROZEN (2026-10-20).** Do not edit. Clarifications and changes go in `decisions.md` as new entries (see D13).

## What we are building

A web app (React + TypeScript) with four screens and a chat panel:

- **Live Requests**: a table of every AI request, updating in real time.
- **Cost & Speed**: charts and totals for spend and latency per model and per feature.
- **Routing**: shows which model each feature uses, and lets an admin change it.
- **History**: a record of every routing change.
- **Ask your gateway**: a chat panel, available on every screen.

The console gets everything through a **gateway API**. The gateway is the service that sits between the company's features and the AI models. The console uses the API to:

- receive requests as they happen (a live stream),
- read the list of models, their prices, and the list of features,
- read the current routing rules,
- send a routing change and get a confirmation back.

---

## 1. Roles

Users sign in to the console. Each user has one role, set by the company. Users cannot choose or change their own role.

| Role       | What they can do                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer** | See Live Requests, Cost & Speed, Routing (read only) and History. Use the chat panel to filter and ask questions. Cannot change routes. |
| **Admin**  | Everything a Viewer can do, plus change routes and confirm changes suggested by the chat panel.                                         |

---

## 2. Functional requirements

### Sign in

- **FR-1** Users sign in to use the console.
- **FR-2** The signed-in name and role are shown in the top bar. The user can sign out.

### Live Requests

- **FR-3** Show a table of requests, newest first, with these columns: time, feature, model used, status, latency, tokens, cost.
- **FR-4** New requests appear automatically as they happen. A "Pause" button stops new rows from appearing so the user can read. A "Resume" button starts again and catches up.
- **FR-5** The user can filter by feature, model, status (success, failed, fallback) and time range.
- **FR-6** The user can search by request ID.
- **FR-7** Clicking a row opens a detail panel with the full information about that request, including: the model it was meant to use, the model that actually answered, input and output tokens, cost, latency, and the error reason if it failed.
- **FR-8** If a request used a fallback, the table shows a clear badge, and the detail panel explains it (for example "Opus timed out, so it was routed to Sonnet").
- **FR-9** The table must handle at least 10,000 rows without slowing down (see non-functional requirements).

### Cost & Speed

- **FR-10** Show a price table of the models: name and price per 1 million tokens (input and output).
- **FR-11** Show total spend so far, and spend split by model and by feature.
- **FR-12** Show a chart of spend over time.
- **FR-13** Show a chart of latency over time with two lines: typical (p50) and slow (p95).
- **FR-14** Show the number and percentage of failed requests and fallbacks.
- **FR-15** The user can switch the time range (last 5 minutes, last hour, all data).

### Routing

- **FR-16** Show a list of features. Each feature shows its current main model and its backup (fallback) model.
- **FR-17** An Admin can choose a different main model or backup model for a feature.
- **FR-18** Before anything changes, the app shows a **review step**: what will change (old model to new model), and an estimated cost change based on recent traffic (for example "about 40% cheaper").
- **FR-19** The change only happens when the Admin clicks **Confirm**. **Cancel** closes the review with no change.
- **FR-20** After a confirmed change, the gateway uses the new route from the next request onward. The Live Requests table and charts show the effect.
- **FR-21** A Viewer sees the routes but the change controls are disabled, with a short message saying only Admins can change routes.

### History

- **FR-22** Every confirmed change is saved with: time, who made it, feature, old model, new model, and whether it was made by clicking or through the chat panel.
- **FR-23** An Admin can **undo** the most recent change for a feature from the History screen. Undo is a new routing change and also goes through the review step.

### Ask your gateway (chat panel)

- **FR-24** A chat panel sits on the side of every screen. The user types a question or a request in plain language.
- **FR-25** The panel can do two kinds of things:
  - **Filter or explain:** for example "show failed requests from support-bot today". The Live Requests table updates its filters to match and the panel says what it did.
  - **Suggest a route change:** for example "move support-bot to a cheaper model". The panel does not apply it. It opens the same review step from FR-18.
- **FR-26** The panel can never change a route on its own. Only the Admin's Confirm click changes anything.
- **FR-27** If the panel does not understand, or the user is a Viewer asking for a change, it says so politely and suggests what it can do.
- **FR-28** The panel always shows what it understood, for example: "Filter: feature = support-bot, status = failed, time = today", so the user can trust it.

### Connection to the gateway

- **FR-29** Every screen reads its data from the gateway API: requests, models and prices, features, and routing rules.
- **FR-30** New requests arrive through a live stream, without the user reloading the page.
- **FR-31** If the live stream drops, the console shows a clear "disconnected" message, reconnects on its own, and fills in the requests it missed.
- **FR-32** Route changes are sent to the gateway API. The console shows the new route only after the gateway confirms it. If the change fails, the console shows an error and keeps the old route.

---

## 3. User flows

### Flow A: Watch live traffic

1. Sign in as a Viewer.
2. Land on Live Requests. Rows keep appearing.
3. Filter to one feature. Click a row to see its details.

### Flow B: Find out why a request failed

1. On Live Requests, filter by status = failed.
2. Click a failed row.
3. The detail panel shows the error and, if the backup model answered, shows the fallback explanation.

### Flow C: Move a feature to a cheaper model (by clicking)

1. Sign in as an Admin.
2. Open Routing. Find "support-bot", currently using the expensive model.
3. Choose a cheaper main model.
4. Review step shows old model to new model and the estimated saving.
5. Click Confirm.
6. Go to Live Requests: new rows for "support-bot" now use the new model. Cost & Speed shows the spend rate dropping.
7. The change appears in History.

### Flow D: Do the same thing by asking

1. As Admin, type in the chat panel: "move support-bot to a cheaper model".
2. The panel says what it understood and opens the review step with a suggested model.
3. Admin clicks Confirm (or Cancel).
4. The change appears in History, marked "via chat".

### Flow E: Ask a question

1. Type "show failed requests from the payments team today".
2. The panel shows what it understood and the table filters itself.

### Flow F: A Viewer tries to change a route

1. Sign in as a Viewer.
2. On Routing, the change controls are disabled with a short message.
3. In the chat panel, type "move support-bot to Grok".
4. The panel says only Admins can do that, and offers to show the current route instead.

### Flow G: Undo a change

1. As Admin, open History.
2. Click Undo on the latest change.
3. Review step opens. Confirm. The old route is back and a new entry appears in History.

### Flow H: The connection drops

1. The live stream is interrupted.
2. The console shows "disconnected" and keeps the data already on screen.
3. The console reconnects, fills in the missed requests, and the message goes away.

---

## 4. Data entities

### User

| Field | Meaning             |
| ----- | ------------------- |
| name  | The user's name     |
| role  | `viewer` or `admin` |

### Model

| Field                 | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| id                    | Short name, for example `claude-opus`                   |
| displayName           | Name shown on screen                                    |
| provider              | For example Anthropic, OpenAI, Google, xAI, Self-hosted |
| inputPricePerMillion  | Price for 1M input tokens                               |
| outputPricePerMillion | Price for 1M output tokens                              |

### Feature

| Field       | Meaning                                     |
| ----------- | ------------------------------------------- |
| id          | For example `support-bot`                   |
| displayName | Name shown on screen                        |
| team        | The team that owns it, for example Payments |

### RoutingRule

| Field           | Meaning                              |
| --------------- | ------------------------------------ |
| featureId       | Which feature this rule is for       |
| mainModelId     | The model used first                 |
| fallbackModelId | The model used if the main one fails |
| updatedAt       | When it last changed                 |

There is one current rule per feature.

### Request

| Field          | Meaning                                             |
| -------------- | --------------------------------------------------- |
| id             | Unique ID                                           |
| timestamp      | When it happened                                    |
| featureId      | Which feature sent it                               |
| team           | The team that owns the feature                      |
| plannedModelId | The model the rule said to use                      |
| servedModelId  | The model that actually answered                    |
| status         | `success`, `failed` or `fallback`                   |
| latencyMs      | How long it took                                    |
| inputTokens    | Size of the question                                |
| outputTokens   | Size of the answer                                  |
| cost           | Calculated from tokens and the model's price        |
| errorReason    | For failures, for example "timeout" or "rate limit" |

`status = fallback` means the planned model failed and the backup answered. `status = failed` means nothing answered.

### RouteChange (History)

| Field                                  | Meaning                               |
| -------------------------------------- | ------------------------------------- |
| id                                     | Unique ID                             |
| timestamp                              | When it was confirmed                 |
| changedBy                              | The user's name                       |
| featureId                              | Which feature changed                 |
| oldMainModelId, newMainModelId         | Main model before and after           |
| oldFallbackModelId, newFallbackModelId | Backup model before and after         |
| source                                 | `click`, `chat` or `undo`             |
| estimatedCostChangePercent             | The estimate shown in the review step |

### ChatMessage

| Field          | Meaning                                                       |
| -------------- | ------------------------------------------------------------- |
| id             | Unique ID                                                     |
| role           | `user` or `assistant`                                         |
| text           | The message                                                   |
| understood     | What the panel understood, for example the filters it applied |
| proposedChange | If the message suggested a route change, the details of it    |

---

## 5. Non-functional requirements

### Speed

- **NFR-1** The Live Requests table must stay smooth (about 60 frames per second while scrolling) with 10,000 or more rows. Only the rows on screen are drawn.
- **NFR-2** Applying a filter updates the table in under 100 ms with 10,000 rows.
- **NFR-3** New rows arriving at a high rate (for example 20 per second) must not freeze typing, scrolling or clicking.
- **NFR-4** The first screen loads fast. Charts and the chat panel load only when needed.

### Safety and trust

- **NFR-5** The chat panel can never apply a route change. Only the Confirm button can.
- **NFR-6** Viewers cannot change routes. This is blocked in the interface and also checked in the code that applies changes.
- **NFR-7** The chat panel never invents data. It only filters or summarises what is in the app, and only performs actions from a fixed list of allowed actions.
- **NFR-8** Secrets such as API keys are never placed in browser code.

### Ease of use

- **NFR-9** A new visitor should understand the app in under one minute. The first screen needs one short sentence explaining what they are looking at.
- **NFR-10** Works well on a laptop screen. Phones only need to be readable, not perfect.
- **NFR-11** Basic accessibility: all buttons work with the keyboard, text is easy to read, colours are not the only way to show status (use icons or labels too).
- **NFR-12** Clear empty, loading and error states on every screen.

### Quality

- **NFR-13** Written in TypeScript. State management with Zustand. Clean, small components.
- **NFR-14** Tests for the important logic: cost calculation, routing rules, role checks, and the chat panel's request understanding.
- **NFR-15** Deployed to a public link.

### Documentation

- **NFR-16** The README includes:
  - What the project is and a screenshot.
  - Measured numbers (rows, frame rate, filter speed) and one before/after improvement.
  - Key decisions and why (for example virtualised table, review-before-apply, why the chat panel cannot apply changes).
- **NFR-17** The README links to `decisions.md` for the design choices made to keep the project buildable.
