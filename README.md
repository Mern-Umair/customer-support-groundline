# Groundline

Multi-tenant AI customer-support platform. A business adds its website URL and documents, gets a one-line chat widget, and its visitors get streamed answers grounded in that content with citations. When the AI cannot answer, a human is paged in real time and takes over the conversation. Accuracy is measured with a per-workspace eval set and published.

**Status:** week 7 of 8 (auth, ingestion, vector search, grounded chat with citations, embeddable widget, live human handoff, insights dashboard, evals with a public results page, agent tools with human approval, team invites and roles, Stripe test-mode billing) · [CI](https://github.com/Mern-Umair/customer-support-groundline/actions) ![CI](https://github.com/Mern-Umair/customer-support-groundline/actions/workflows/ci.yml/badge.svg) See [PLAN.md](PLAN.md) for the feature list and schedule, [BRIEF.md](BRIEF.md) for the why.

## Stack

Next.js 16 + TypeScript (dashboard, API, SSE streaming) · Node + Socket.io (handoff, live view) · MongoDB Atlas + Vector Search · Gemini / Groq behind one provider interface · Stripe (test mode) · Vitest + Playwright · GitHub Actions.

Runs entirely on free tiers.

## Evals

Each workspace keeps a test set (question, reference answer, expected source, or "unanswerable"). A run asks every question to the live assistant, checks refusals and citations deterministically, and has a judge model grade correctness with a pinned rubric (`correctness-v1`). Headline numbers: answer accuracy, cited-the-right-source rate, correct refusals, over-refusal, latency, cost. Runs are stored, so regressions are visible; owners can publish the latest run at `/evals/<workspace>`. The repo ships a 40-question golden set over fictional "Ali Shoes" documents (`apps/web/src/lib/evals/demo`), used by the dashboard's "Load demo set" and by the CI gate (`EVALS_REAL=1` + `GEMINI_API_KEY`, thresholds in `evals/baseline.json`).

## Agent tools

With tools enabled (Settings), the model can call `lookupOrder` (read-only, runs immediately), `createTicket` and `bookAppointment` (side effects: recorded as pending, the dashboard is alerted, and nothing runs until a teammate approves; the visitor is told the team will confirm, and sees the result in the same thread). Tool calling is native on Gemini (`functionDeclarations`) and Groq (OpenAI `tools`), with a deterministic stand-in offline. The built-in tools read and write a mock store backend per workspace; a real deployment would point them at the customer's systems.

## Teams, plans and security

Owners invite teammates by link (7-day, single-use; no email sending on the free tier). Roles: **owner** (everything) and **agent** (conversations, playground, approving actions). Users can belong to several workspaces and switch in the sidebar. Plans: Free and Pro with enforced limits (sources, pages per site, AI answers per month, seats); Stripe Checkout and the customer portal in test mode when `STRIPE_*` keys are set, with a signature-verified, idempotent webhook. Security measures covered by tests: tenant isolation at the data layer and inside the vector index, owner-only mutations, public-API rate limits and monthly quota, login brute-force limits, and prompt-injection containment (retrieved text is fenced as data).

## How it works

See [docs/architecture.md](docs/architecture.md) for the diagram and request paths, and [docs/deploy.md](docs/deploy.md) for the free-tier deployment (Vercel + Render + Atlas).

## Repo layout

```
apps/web          Next.js app: dashboard, API routes, widget host
apps/realtime     Socket.io server (Dockerfile, deploys to Render)
packages/shared   zod schemas, types, constants shared across apps
evals/            per-tenant test sets, runner, results
docs/             architecture notes, LinkedIn posts
```

## Local development

```bash
npm install
cp .env.example apps/web/.env.local   # fill in MONGODB_URI, AUTH_SECRET, GEMINI_API_KEY
npm run dev                            # web on http://localhost:3000
npm run dev:realtime                   # socket server on http://localhost:4000 (reads apps/realtime/.env)
```

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
