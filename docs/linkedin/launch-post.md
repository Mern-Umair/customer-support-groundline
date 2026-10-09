# Launch post (the only post; publish when the live URL and a real-provider eval run exist)

Fill every `[[…]]` from the real run before posting. Do not post with placeholders. Attach: a 60-second screen recording (script in docs/demo-script.md) or the overview + handoff screenshots.

---

I built a small version of what Intercom Fin and Chatbase sell, end to end, in 8 weeks, on free tiers only. Here are the numbers.

Groundline is an AI customer-support platform: a business adds its website and PDFs, pastes one script tag, and visitors get answers grounded in that content, with citations. When the AI can't answer, a human is paged in real time and takes over the same chat.

What's in it:
→ RAG with tenant-scoped vector search (MongoDB Atlas) and a citation validator, because a prompt alone can't guarantee real citations
→ Streaming answers, tokens / cost / latency logged per message
→ Human handoff over Socket.io, with HTTP polling fallback because the free server sleeps
→ Agent tools with a human approval step (order lookup runs now; tickets and bookings wait for a teammate)
→ Evals: a 40-question golden set, deterministic refusal and citation checks, an LLM judge with a pinned rubric, results published at a public URL
→ Teams, roles, Stripe test-mode billing, rate limits
→ 123 unit/integration tests, 28 browser tests, CI on every push

The numbers (demo workspace, gemini-3.5-flash-lite with gemini-embedding-001, judged by gemini-3.5-flash-lite on a pinned rubric, run 9 Oct 2026, results committed in the repo):
• Answer accuracy: 87% on 30 answerable questions (strict: 26 fully correct, 4 partial, 0 wrong)
• Cited the right document: 100%
• Correct refusals on 10 unanswerable questions: 100%
• Over-refusal: 0%
• Average latency: 3.0 s end to end · model cost per answer: about $0.0005 at list prices (the free tier pays $0)

What the numbers don't say: the judge is the same model family as the system under test (a Groq judge is used automatically when a key exists), and 40 questions over 4 documents is a small set. Both are stated on the public evals page.

Live demo: [[url]] (try the widget on the demo shop)
Public evals: [[url]]/evals
Code and architecture notes: https://github.com/Mern-Umair/customer-support-groundline

Stack: Next.js 16, TypeScript, MongoDB Atlas Vector Search, Gemini, Groq, Socket.io, Stripe, Vitest, Playwright.

I'm looking for a remote role (or contract work) building exactly this kind of product. If your team ships AI support, or you've run one in production and see something I got wrong, I'd like to hear it.

[[Optional: tag Dr. Munir Ahmad, pending Umair's decision]]

#AI #RAG #CustomerSupport #TypeScript #NextJS #OpenSource
