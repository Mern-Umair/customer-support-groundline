# Launch post (the only post)

Attach the three images in `docs/linkedin/images/` in this order: 1-widget-cited-answer, 2-dashboard-overview, 3-public-evals. Post text below; everything in it comes from the live site and the committed eval run.

---

I built an AI customer-support platform from scratch and it is live today.

Groundline answers your customers' questions using only your own website and documents, with a source citation on every answer. When it can't answer, it says so and hands the chat to a real person in real time instead of guessing.

How it works for a business:
1. Add your website URL or PDFs.
2. Paste one script tag on your site.
3. Visitors get answers with citations. Your team gets a live inbox, and every unanswered question shows up as a gap to fix.

How it works for the visitor:
→ Ask a question in the chat bubble.
→ Get a short answer plus the exact document it came from.
→ Ask for a human and a teammate joins the same chat.

Measured, not promised (public evals page, 40-question test set, Gemini 3.5 Flash Lite):
• Answer accuracy: 87%
• Cited the right document: 100%
• Correct refusals on unanswerable questions: 100%
• Average cost per answer: under $0.001

Under the hood: Next.js 16, TypeScript, MongoDB Atlas Vector Search, Gemini, Socket.io for live handoff, Stripe billing, 150+ automated tests, CI on every push. Runs entirely on free tiers.

Try it (no sign-up needed for the demo):
Live demo: https://customer-support-groundline.vercel.app/demo
Public evals: https://customer-support-groundline.vercel.app/evals
Code: https://github.com/Mern-Umair/customer-support-groundline

If you run a business and want a support assistant like this on your own website, or your team is building AI products and needs a full-stack engineer who ships end to end, send me a message. I'm open to remote roles and contract work.

Grateful to Dr. Munir Ahmad for the guidance and direction on this one.

#AI #CustomerSupport #RAG #NextJS #TypeScript #MongoDB #SaaS #BuildInPublic #Hiring #OpenToWork
