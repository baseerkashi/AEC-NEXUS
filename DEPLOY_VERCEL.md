# Deploying AEC NEXUS (Open BIM Studio) to Vercel

This project is configured to deploy directly to Vercel with a Vite/React/Three.js frontend and Node.js/Edge Serverless Functions under `/api`.

## 1. Vercel Dashboard Settings

When importing this repository in the Vercel Dashboard, use these exact settings (also encoded in [`vercel.json`](./vercel.json)):

| Setting | Value |
| --- | --- |
| **Framework Preset** | `Vite` |
| **Root Directory** | `./` (repository root) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install --legacy-peer-deps` |
| **Node.js Version** | `20.x` or newer (`engines.node >= 20`) |

## 2. Environment Variables

Copy values from [`.env.example`](./.env.example) into **Vercel Project Settings → Environment Variables** as needed:

| Variable | Required? | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Optional | Leave empty for same-origin `/api` routing on Vercel. |
| `APS_CLIENT_ID` | Optional | Autodesk Platform Services (APS) Client ID for server-side `.rvt`/`.nwd`/`.dwg` → `.ifc` conversion (`/api/convert`). |
| `APS_CLIENT_SECRET` | Optional | Autodesk Platform Services (APS) Client Secret. |
| `APS_BUCKET` | Optional | APS OSS bucket name (defaults to `openbimstudio-convert`). |
| `OBS_SERVER_TOKEN` | Optional | Bearer token (min 16 chars) to protect `/api/*` endpoints. |
| `OBS_ALLOWED_ORIGINS` | Optional | Comma-separated CORS origins. On Vercel, same-origin requests are allowed automatically. |
| `OBS_DATA_DIR` | Optional | Data directory (automatically defaults to `/tmp/openbimstudio-data` on Vercel). |
| `OBS_MAX_BODY` | Optional | Max request body size in bytes (subject to Vercel's 4.5 MB serverless payload cap). |

## 3. Going Live

### Option A: Vercel CLI
```bash
npx vercel --prod
```

### Option B: GitHub Integration
1. Push this repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), click **Add New… → Project** and import the repository.
3. Confirm the **Build & Development Settings** match Section 1 (auto-detected from `vercel.json`).
4. Add any required **Environment Variables** from Section 2.
5. Click **Deploy**.

## 4. Serverless Limitations & Caveats

- **Ephemeral Storage (`/tmp`):** `server/index.mjs` stores workshare projects (`projects.json`), collaboration rooms (`rooms.json`), and uploaded conversion files in `/tmp/openbimstudio-data` when running on Vercel. `/tmp` is per-instance and resets between cold starts.
  - *Cloud alternative:* Back `/api/projects/:id` and `/api/rooms/:room` with **Vercel KV (Upstash Redis)** or **Supabase / Neon Postgres**.
- **4.5 MB Upload Limit (`/api/convert`):** Vercel Serverless Functions enforce a 4.5 MB request body limit. Large `.rvt`/`.nwd`/`.dwg` uploads should use direct-to-cloud presigned URLs (e.g., **Vercel Blob**, **AWS S3**, or **Cloudflare R2**) or the local desktop **Navisworks Bridge** (`tools/navisworks-bridge`).
- **SSE Connection Timeouts (`/api/rooms/:room/events`):** Serverless functions have execution time limits (10s on Hobby, up to 60s on Pro). Live SSE streams will disconnect at the timeout and automatically reconnect via `EventSource` (`retry: 2000`).
  - *Cloud alternative:* For persistent real-time collaboration, use **Ably**, **Pusher**, **PartyKit**, or a dedicated Node.js / Cloudflare Durable Objects server.
- **Local-Only Integrations:** Client-side options for local Ollama (`http://localhost:11434`), LM Studio (`http://localhost:1234`), and the local Navisworks NWC Bridge (`http://127.0.0.1:8424`) require those tools to be running on the end user's own machine.
