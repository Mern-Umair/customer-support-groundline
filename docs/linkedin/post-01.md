# Post #1: announcement (week 1, publish 8–9 Oct 2026)

Attach: a screenshot of the feature table in PLAN.md, or a 10-second screen recording of the repo with the CI badge. Honest, no metrics yet.

---

I'm building an AI customer-support platform in public over the next 8 weeks. Here's the plan.

Last week I read 30+ job postings for "AI support chatbot" work. Clients in the UK, US, UAE, Netherlands and Malta all asked for the same thing: an AI that answers from *our* documents, hands off to a human when it can't, and comes with a way to measure whether the answers are actually right.

So that's what I'm building. A small version of what Intercom Fin and Chatbase do, called Groundline:

→ Add your website URL and PDFs. Crawled, chunked, embedded (RAG).
→ One script tag puts a chat widget on your site.
→ Answers stream in with source citations.
→ Can't answer? A human gets pinged in real time and takes over the chat.
→ Agent tools (look up an order, create a ticket) with a human approval step.
→ Evals: a test set per customer, accuracy numbers, regression checks in CI.

Stack: Next.js + TypeScript, Node + Socket.io, MongoDB Atlas Vector Search, Gemini, Stripe. Unit + e2e tests and CI from the first commit.

Total budget: $0. Free tiers only. That's a real engineering constraint (free servers sleep, rate limits are tight) and I'll show how I work around it.

Every week I'll post one screenshot, one real problem I hit, and the numbers as they come. No invented metrics.

Week 1 goal: sign up, upload a PDF, see it chunked and searchable.

If you've built or run one of these in production: what broke first? I'd rather learn it in week 1 than in week 6.

#buildinpublic #RAG #AI #CustomerSupport #TypeScript #NextJS

---

Notes:
- Target reader is an engineer, founder or recruiter abroad; no Pakistan-specific context.
- Comment under the post within the first hour with the GitHub link once the repo is public.
- Optional tag for Dr. Munir Ahmad pending Umair's answer.
