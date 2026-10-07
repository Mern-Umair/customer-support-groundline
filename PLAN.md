# Groundline — v1 plan

Planning session held 7 October 2026. Companion to BRIEF.md (context); this file holds the decisions.

## 1. Product name: Groundline

"Grounded answers, on your support line." Short, English, no obvious conflict in the AI-support space (checked 7 Oct 2026: nothing called Groundline in this category; a Groundline Engineering exists in NZ, unrelated). Repo: `groundline`. Demo: `groundline.vercel.app` (or whatever Vercel assigns).

Runner-ups, in case Umair prefers another: **Replyn**, **Citewise**, **Handoff** (too generic). Rejected: Citeline (a large pharma-data company), Rafiq (Rafiki.ai exists in sales AI).

## 2. Free-tier reality check (verified 7 Oct 2026)

| Service | Status | Consequence |
|---|---|---|
| Gemini API free tier | Still free, no card. Since 1 Apr 2026 only Flash / Flash-Lite models are free; Pro is paid-only; quotas were cut and are now shown per-project in AI Studio (roughly ~10 RPM and a few hundred to 1,500 requests/day for Flash). Gemini Embedding stays free. | Gemini Flash + Gemini Embedding as primary. Build an `LLMProvider` interface so we can switch. |
| Groq free tier | 30 RPM; llama-3.1-8b: 14,400 req/day, 500K tokens/day; llama-3.3-70b: 1,000 req/day, 100K tokens/day. | Second provider behind the same interface. Useful for eval runs (many calls) and as fallback. |
| MongoDB Atlas M0 | Free forever, 500 MB, Vector Search included. One M0 per project; several projects allowed. | One cluster for prod, one for CI/tests. |
| Vercel Hobby | Free. Serverless functions are time-limited; no WebSockets. | Next.js app + API + SSE streaming here. |
| Render free web service | Free; sleeps after ~15 min idle, 30–60 s cold start. | Socket.io server here. Widget connects lazily; dashboard shows "connecting"; an external uptime ping is optional. |
| Stripe | Test mode is free. | Billing in week 7. |

## 3. Final feature list

### v1 — "first working version" (end of week 4, 4 Nov 2026)
1. **Accounts & tenants** — email/password sign-up, one workspace per sign-up (tenant), workspace API key. Every DB query is tenant-scoped, and this is tested.
2. **Knowledge sources** — add a website URL (sitemap first, then same-domain crawl, page cap per plan) and upload PDF / Markdown / TXT. Content is cleaned, chunked, embedded, stored in Atlas with a vector index. Ingestion status visible in the dashboard; re-sync button.
3. **Grounded chat API** — retrieve top-k chunks for the tenant, answer with Gemini Flash, stream tokens over SSE, return citations (source title + URL/page). Refuses when retrieval is weak ("I don't know, let me get a human"). Per-message log of tokens, cost (from published prices) and latency.
4. **Embeddable widget** — one script tag renders an iframe chat bubble, streams answers, shows citations, thumbs up/down per answer. Built as a single JS file served from the Next.js app.
5. **Human handoff** — when the AI cannot answer or the visitor asks for a person, the conversation is flagged; the owner's dashboard rings in real time (Socket.io); the owner replies live in the same thread; the visitor sees it instantly; owner can hand back to AI.
6. **Dashboard** — live conversations list and transcript view; metrics: conversations, % resolved by AI vs handed off, feedback score, unanswered questions, average cost and latency per conversation.
7. **Engineering baseline** — TypeScript strict, Vitest unit tests, Playwright e2e, GitHub Actions CI on every PR, Dockerfile for the realtime server, README with architecture.

### v2 — "polished with evals" (weeks 5–8, to 2 Dec 2026)
8. **Evals** — per-tenant test set (question, expected answer, expected source); runner scores answers (LLM-as-judge for correctness plus a deterministic check that the right source was cited); results stored per run; CI job runs the demo tenant's set and fails on regression beyond a threshold; **public evals page** with the real numbers.
9. **Agent actions** — tool registry (`lookupOrder`, `createTicket`, `bookAppointment`) against a mock backend; the model picks tools; side-effecting tools require owner approval in the dashboard before executing.
10. **Teams & billing** — invite teammates, roles (owner / agent), Stripe test-mode checkout with Free and Pro plans, plan limits enforced (pages indexed, messages per month).
11. **Launch polish** — demo tenant with public docs, README as product spec, architecture diagram, 60-second demo video, security pass (tenant-isolation tests, prompt-injection tests, rate limiting).

### Explicitly out of scope
WhatsApp / Slack / email channels, multi-language UI, SSO, custom domains, analytics export, fine-tuning. Listed in the README as "not built" so the scope reads as deliberate.

## 4. Week-by-week plan (3–4 h/day, ~22 h/week)

| Week | Dates | Build | Done when | LinkedIn post |
|---|---|---|---|---|
| 1 | 8–14 Oct | Repo + CI + deploy skeleton; auth + tenant model; ingestion: upload PDF, crawl URL, chunk, embed, vector index; ingestion status page. | A signed-in user uploads a PDF and runs a raw vector search against it from a debug page. CI green, skeleton on Vercel. | #1 announcement (docs/linkedin/post-01.md) |
| 2 | 15–21 Oct | `LLMProvider` (Gemini, Groq); RAG chat API with SSE streaming, citations, refusal; dashboard Playground page; per-message token/cost/latency logging; feedback endpoint. | Ask in the playground, see a streamed answer with a correct citation, see cost/latency. Unit tests for chunking, retrieval, prompt building. | "Streaming RAG answers with citations: what the prompt looks like" |
| 3 | 22–28 Oct | Widget package (script tag to iframe); conversation persistence; Socket.io server on Render; handoff flow; owner live reply; hand back to AI. | Widget on a test page, AI fails, dashboard rings, owner answers, visitor sees it. e2e test for this path. | "Human handoff over WebSockets on a free server that sleeps" |
| 4 | 29 Oct–4 Nov | Dashboard metrics; unanswered-questions list; ingestion UX polish; Playwright e2e suite; README v1; demo tenant. **v1 live.** | Public demo URL works end to end; README has an architecture diagram. | "v1 is live: what it does and what it costs to run ($0)" |
| 5 | 5–11 Nov | Evals: test-set model + editor; runner; LLM-judge + citation scoring; results page; CI regression job; public evals page. | Demo tenant has 40+ questions, a baseline accuracy number is published, CI fails on regression. | "First eval numbers (including the ones I'm not proud of)" |
| 6 | 12–18 Nov | Agent tools with approval: registry, mock order/ticket/calendar backend, approval UI, audit log. | Visitor asks about order 1234, AI proposes a lookup, owner approves, answer returned. Tests. | "Agent tools with a human approval step" |
| 7 | 19–25 Nov | Team invites + roles; Stripe test billing; plan limits; rate limiting; tenant-isolation and prompt-injection test suites. | Two tenants cannot see each other's data (tested); Pro checkout works in test mode. | "Multi-tenant isolation: the tests I wrote to prove it" |
| 8 | 26 Nov–2 Dec | Polish, demo video, README as product spec, evals re-run, launch. Update Upwork profile; apply to 5 matching postings and YC remote roles with the demo link. | Launch post published; 5 applications sent. | Launch post tagging Intercom, Chatbase, Tidio, Botpress, Crisp, Voiceflow |

Buffer: weeks 5–8 each carry ~4 h of slack. If weeks 1–4 slip, evals (week 5) is protected; agent tools (week 6) is the first thing to shrink.

## 5. Repo setup

Monorepo with npm workspaces (pnpm is not installed; npm 11 is fine). Node 24 is installed locally.

```
groundline/
├── apps/
│   ├── web/            Next.js 15 (App Router, TS strict): dashboard, API routes, SSE chat, widget host
│   └── realtime/       Node + Socket.io server, Dockerfile, deployed to Render
├── packages/
│   ├── shared/         zod schemas, types, constants shared by web/realtime/widget
│   └── widget/         embeddable script (Vite build to one JS file copied into apps/web/public)
├── evals/              test sets (JSON per tenant), runner, results history
├── docs/
│   ├── architecture.md
│   └── linkedin/       one file per post
├── .github/workflows/ci.yml   lint, typecheck, unit (Vitest), e2e (Playwright), evals regression
├── BRIEF.md  PLAN.md  README.md
└── package.json        workspaces + root scripts
```

Decisions:
- **Auth** (changed 7 Oct): stateless session cookie signed with `jose` + a Data Access Layer (`verifySession`, `getCurrentContext`), exactly the pattern in the Next.js 16 authentication guide. Avoids the Auth.js beta dependency; OAuth can be added later.
- **DB access** (changed 7 Oct): native MongoDB driver + zod + typed collection helpers, no Mongoose. Tenant isolation via `scoped(workspaceId, filter)` in `src/lib/tenant.ts`, which forces `workspaceId` into every query on tenant-owned data and throws on a cross-tenant filter. Unit-tested.
- **Tests use a separate database** (`groundline_test`, via `MONGODB_URI_TEST`) for Vitest integration tests and the Playwright dev server; the main database is never touched by tests.
- **Streaming**: SSE from a Next.js route handler (works on Vercel); WebSockets only for handoff and live view.
- **Tests**: Vitest (unit, with a test Atlas cluster for retrieval tests), Playwright (e2e against the local dev server with a seeded tenant). CI secrets: `MONGODB_URI_TEST`, `GEMINI_API_KEY`, `GROQ_API_KEY`.
- **Docker**: Dockerfile for `apps/realtime` only (Vercel builds web). Docker is not installed on this machine; the Dockerfile is validated by the Render build.
- **Git**: this folder is the repo root. Identity is set per repo (`git config user.name` / `user.email` without `--global`), awaiting Umair's name and email. GitHub repo `groundline`, public, created via the web UI (no `gh` CLI installed).
- **Branching**: `main` protected by CI; feature branches such as `week-1/ingestion`; squash merge.

## 6. Open questions for Umair
1. Name **Groundline**: OK?
2. Git identity for this repo: name + email to commit as.
3. ~~GitHub username~~ → github.com/Mern-Umair/customer-support-groundline (done 8 Oct).
4. Tag Dr. Munir Ahmad in post #1 and later posts?
