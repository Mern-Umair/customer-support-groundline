# Architecture

Groundline is three deployables and one database, all on free tiers.

```mermaid
flowchart LR
  subgraph Customer site
    W[widget.js loader] --> F[iframe /embed/key]
  end
  subgraph Vercel: apps/web (Next.js 16)
    F -->|POST /api/widget/chat SSE| API[Route handlers]
    D[Dashboard] -->|POST /api/chat SSE| API
    API --> RAG[answerQuestion: retrieve → prompt → stream → validate citations]
    RAG --> EMB[Embedder: Gemini embedding-001 / fake]
    RAG --> LLM[LLMProvider: Gemini / Groq / fake]
    ING[Ingestion: crawl → extract → chunk → embed] --> DB
    API --> ING
  end
  subgraph Render: apps/realtime (Socket.io)
    RT[/emit + rooms/]
  end
  DB[(MongoDB Atlas M0\nusers · workspaces · sources · pages · chunks(+vector index) · conversations · messages · ratelimits)]
  API --> DB
  API -->|POST /emit, shared secret| RT
  RT -->|workspace room| D
  RT -->|conversation room| F
  D -. polling fallback .-> API
  F -. polling fallback .-> API
```

## Request paths

**Ingest a website.** `POST /api/sources` creates the source and its first page. The browser then calls `POST /api/sources/:id/process` repeatedly; each call works for up to 25 s (sitemap discovery, then page by page: fetch → Readability/body extraction → recursive chunking at ~512 tokens → batched embeddings → insert chunks) and returns progress. This keeps every serverless invocation short and makes ingestion resumable.

**Answer a question.** The visitor message is stored and broadcast. If the conversation is in human mode, or the visitor asks for a person, no model is called. Otherwise `$vectorSearch` runs with a `workspaceId` pre-filter (tenant isolation inside the index), chunks under the score gate are dropped, the prompt numbers the sources, the model streams, citation markers are validated against the prompt, and the assistant message is stored with tokens, cost, latency and first-token time. A refusal on the widget channel requests a handoff.

**Handoff.** The web app flags the conversation, stores a system note, and POSTs to the realtime server's `/emit`. Agents in the workspace room get a toast; the visitor's iframe gets the status change. Agent replies go through the web app (stored first) and are broadcast the same way. Without the socket, both sides poll every 4 s.

## Tenant isolation

Every tenant-owned document carries `workspaceId`. All reads and writes go through `scoped(workspaceId, filter)`, which injects the id and throws if a filter targets another workspace. The vector index declares `workspaceId` as a filter field, so other tenants' chunks are never candidates. Integration tests assert both.

## Why these choices

| Decision | Reason |
|---|---|
| Native MongoDB driver, no ORM | One fewer abstraction over a schema that is already typed; `scoped()` is the one rule that matters |
| Resumable ingestion driven from the browser | Vercel functions are time-limited; no queue service on the free tier |
| Embedder / LLM behind interfaces with offline fakes | CI and local dev run without API keys; swapping providers is a config change |
| Realtime server emits only what the web app already stored | The database stays the single source of truth; a dead socket loses nothing |
| MongoDB rate-limit counters | Serverless instances share no memory; a free Redis that never sleeps does not exist |
| Citations validated after generation | A prompt cannot guarantee real citations; the validator can |
