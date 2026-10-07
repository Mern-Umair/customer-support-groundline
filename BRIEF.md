# Project brief: AI customer-support platform (working folder D:\support-ai)

Written 7 October 2026 from a planning conversation. Read this first; it is the whole context.

## Who
Umair Tahir, MERN developer in Lahore, job hunting. Writes in Roman Urdu; wants code, UI and public copy in English. Already shipped FormKB (https://formkb.com, Next.js static site, folder D:\formtayyar) with 178 automated tests. That project is finished and is NOT to be touched from this folder.

## Goal of this project
A portfolio project whose purpose is to get Umair hired remotely by companies abroad (US, UK, Europe, UAE) and to win Upwork work. It must be the same kind of product those companies build themselves, so their engineers recognise it. Target audience for the LinkedIn posts: engineers, founders and recruiters abroad, not Pakistan.

## What we decided to build
A multi-tenant AI customer-support platform, a small version of Chatbase / Intercom Fin / Tidio Lyro:
1. A business signs up, gives its website URL and uploads PDFs/docs.
2. The system crawls and chunks the content, stores embeddings (RAG).
3. The business gets an embeddable chat widget (one script tag) for its site.
4. Visitors ask questions; answers stream in real time, with source citations, grounded in the business's own documents.
5. When the AI cannot answer, it hands off to a human: the owner's dashboard rings in real time (WebSockets), and the owner takes over the chat live.
6. Agent actions with tools (e.g. look up an order, book an appointment, create a ticket), with human approval where needed.
7. Dashboard: live conversations, % resolved by AI vs handed off, thumbs up/down per answer, questions the AI could not answer, cost and latency per conversation.
8. Evals: a test-question set per tenant, accuracy numbers, regression check. Public evals page. This is the differentiator; hiring managers want numbers.
9. Multi-tenant SaaS basics: tenant isolation, team roles, Stripe billing in test mode (free and paid plan).

Why this one: research on 7 Oct 2026 of 30+ Upwork postings from the previous 48 hours (clients in UAE, Malta, UK, US, Netherlands, Latvia, Italy) showed the most repeated request is "AI support chatbot over our documents, production grade, with a way to measure answer quality" ($1.5k–$12k projects, $20–80/h). Job-market reports: AI integration hiring +178%, chatbot development +71%; LLM/RAG skills get 3–5x more callbacks. Hiring managers scan for: live URL, README as product spec with architecture, eval numbers, cost/latency figures, tests.

## Hard constraints
- Zero cost. Free tiers only: Gemini API free tier (or Groq) for the LLM and embeddings; MongoDB Atlas free M0 with vector search; Vercel free for the Next.js app; Render/Fly free (or Supabase Realtime free) for the WebSocket server; Stripe test mode; GitHub free; a .vercel.app address is fine. Note free servers sleep after idle.
- Everything tested (unit + e2e), CI on GitHub Actions, nothing that breaks later. Umair asks repeatedly for this.
- English only in product and posts. Honest claims only; no invented metrics.
- Git: commit as the user, not the machine's global identity (global identity belongs to another person). Ask which name/email to use for this repo before the first commit.

## Stack agreed
Next.js + TypeScript (app and API), Node + Socket.io for real time (separate small server), MongoDB Atlas (+ vector search), Gemini/Groq API, Stripe, Docker, Vitest/Playwright, GitHub Actions.

## Timeline agreed
First working version in 3–4 weeks, polished with evals in 6–8 weeks, at 3–4 hours a day.

## LinkedIn plan (part of the project)
- Weekly "build in public" post in English: one screenshot or 30-second video, one real problem solved.
- Follow and comment on engineers/founders at Intercom, Chatbase, Tidio, Botpress, Crisp, Voiceflow and small AI-support startups.
- Launch post tagging those companies: "built a small version of what X do, here are the numbers".
- Also apply on Upwork to the same kind of postings with the live demo link, and to YC remote roles.
- Umair's teacher Dr. Munir Ahmad is to be mentioned/tagged in posts (he presented the FormKB idea; ask whether to tag him on this project too).

## Next step when this folder is opened
Planning session: final feature list for v1, product name, week-by-week plan, repo setup, and the first LinkedIn post. Then build.
