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
→ 113 unit/integration tests, 28 browser tests, CI on every push

The numbers (demo workspace, [[model]] judged by [[judge model]], run [[date]]):
• Answer accuracy: [[xx]]% on 30 answerable questions (strict: "partial" doesn't count)
• Cited the right document: [[xx]]%
• Correct refusals on 10 unanswerable questions: [[xx]]%
• Over-refusal: [[xx]]%
• Median latency: [[xxx]] ms · cost per answer: $[[0.000x]]

What I'd do differently: [[one honest sentence from the eval failures]].

Live demo: [[url]] (try the widget on the demo shop)
Public evals: [[url]]/evals
Code and architecture notes: https://github.com/Mern-Umair/customer-support-groundline

Stack: Next.js 16, TypeScript, MongoDB Atlas Vector Search, Gemini, Groq, Socket.io, Stripe, Vitest, Playwright.

I'm looking for a remote role (or contract work) building exactly this kind of product. If your team ships AI support, or you've run one in production and see something I got wrong, I'd like to hear it.

[[Optional: tag Dr. Munir Ahmad, pending Umair's decision]]

#AI #RAG #CustomerSupport #TypeScript #NextJS #OpenSource
