# Deploying on free tiers

Three things to deploy: the Next.js app (Vercel), the realtime server (Render), and the database (already on Atlas). Total cost: $0.

## 1. MongoDB Atlas (done)

Use the production database `groundline` (not `groundline_test`). Network access must allow `0.0.0.0/0` because Vercel and Render use dynamic IPs.

## 2. Realtime server on Render

1. Sign in at https://render.com with GitHub.
2. New → **Blueprint** → select the repo. Render reads `render.yaml` at the repo root and proposes the `groundline-realtime` web service (Docker, free plan).
3. Set the environment variables it asks for:
   - `AUTH_SECRET`: the same value as the web app's `AUTH_SECRET`.
   - `REALTIME_SECRET`: any long random string (e.g. `openssl rand -hex 24`). Keep it; the web app needs it too.
   - `ALLOWED_ORIGINS`: your Vercel URL, e.g. `https://groundline.vercel.app` (comma-separate more if needed).
4. Deploy. Note the service URL, e.g. `https://groundline-realtime.onrender.com`. `GET /health` should return `{"ok":true}`.

Free Render services sleep after ~15 minutes idle and take 30–60 s to wake. The app handles this: chat never depends on the socket, and both dashboard and widget poll while it is down.

## 3. Web app on Vercel

1. Sign in at https://vercel.com with GitHub → **Add New → Project** → import the repo.
2. **Root Directory**: `apps/web`. Framework: Next.js (auto-detected). Leave build settings default; Vercel installs from the monorepo root and `transpilePackages` handles `@groundline/shared`.
3. Environment variables (Production):
   - `MONGODB_URI`: the production Atlas string (SRV form is fine on Vercel).
   - `AUTH_SECRET`: `openssl rand -base64 32`.
   - `GEMINI_API_KEY`: from https://aistudio.google.com/apikey (free tier).
   - `GROQ_API_KEY`: optional fallback.
   - `REALTIME_URL`: the Render URL from step 2.
   - `REALTIME_SECRET`: same as Render.
   - `NEXT_PUBLIC_REALTIME_URL`: the Render URL again (this one is inlined into the browser bundle).
4. Deploy. The first deployment creates the vector index on first ingestion (allow a minute before retrieval returns results).
5. Go back to Render and make sure `ALLOWED_ORIGINS` matches the final Vercel URL.

## 4. After deploy checklist

- Sign up, add a source, ask in the playground: citations appear.
- Open `/demo` on the Vercel URL: the widget answers.
- Ask "can I talk to a human?" in the widget while the dashboard is open in another tab: toast appears, reply arrives live.
- `README.md`: replace the demo URL placeholder.

## Local equivalents

`apps/web/.env.local` and `apps/realtime/.env` hold the same variables for `npm run dev` and `npm run dev:realtime`.
