# Intent: AI Gateway Console

> **Status: FROZEN (2026-10-20).** Do not edit. Clarifications and changes go in `decisions.md` as new entries (see D13).

## 1. Problem statement

Companies now use AI inside many of their products. One team uses it for customer support, another for code review, another for search. Each feature talks to an AI model such as Claude, GPT, Gemini or Grok.

As this grows, nobody can easily see what is happening. The people in charge cannot answer simple questions:

- Which feature is using which model right now?
- How much is each model costing us?
- Why did this request fail? Did it switch to another model?
- If a model is too expensive or too slow, how do we move traffic to another one safely?

Today the answers are spread across logs, bills and scripts. Changing a model often means asking an engineer to change code.

We need one place where a person can see every AI request, understand what it costs, and change where traffic goes, without touching code.

## 2. Solution idea

One web console where an employee of the company can:

1. **See** every AI request as it happens: which feature sent it, which model answered, how long it took, what it cost.
2. **Understand cost** for each model and each feature.
3. **Change the route** with a few clicks. For example, move "support-bot" from an expensive model to a cheaper one. The console shows what will change and the estimated saving, and waits for a confirm click.
4. **Ask in plain language** through a chat panel: "show failed requests from support-bot today" or "move support-bot to a cheaper model". The AI helps, but it never changes anything without the user's confirm.

## 3. What success looks like

The project is a success if:

- A new visitor opens the console and, within one minute, understands what it shows.
- They can change a route, review what will change, confirm it, and see the change recorded in the history.
- They can type a question in plain language and the screen filters itself.
- The request log stays smooth with 10,000 or more rows.
- The README explains the problem and the key decisions, and shows measured numbers (for example "10,000 rows at 60fps, filters respond in under 100 ms").
- It is deployed and works well on a laptop screen.
