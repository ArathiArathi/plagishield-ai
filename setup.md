# PlagiShield AI — Local Setup Guide

This guide walks you through taking the project out of GitHub and running it on your own machine, from a fresh clone to a fully working app with authentication, document upload, analysis, and PDF report generation.

---

## 1. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Git** | 2.30+ | To clone the repository |
| **Node.js** | 20+ | Runtime |
| **Bun** | 1.1+ (recommended) | Package manager & script runner. npm/pnpm work too, but the project is tuned for Bun |
| **A Supabase project** | — | Backend: Postgres, Auth, Storage. Created in Lovable Cloud or at supabase.com |

Check your tooling:

```bash
git --version      # 2.30+
node --version     # 20+
bun --version      # 1.1+
```

---

## 2. Clone the Repository

```bash
git clone <repo-url> plagishield-ai
cd plagishield-ai
```

Replace `<repo-url>` with the HTTPS or SSH URL of your GitHub repository (find it under **Code → Clone** on the repo page).

---

## 3. Install Dependencies

```bash
bun install
# or
npm install
```

This installs the full stack: TanStack Start (React 19 + Vite 7), Tailwind CSS v4, shadcn/ui, Recharts, jsPDF, and the Supabase client libraries.

---

## 4. Create the `.env` File

Create a file named `.env` in the project root:

```bash
touch .env
```

Then paste and fill in the following:

```bash
# ---------- Client-side (safe to expose, VITE_ prefix required) ----------
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your publishable (anon) key>"
VITE_SUPABASE_PROJECT_ID="<your-project-ref>"

# ---------- Server-side (never expose these) ----------
SUPABASE_URL="https://<your-project-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<your publishable (anon) key>"
SUPABASE_SERVICE_ROLE_KEY="<your service role key>"

# ---------- Lovable AI Gateway (powers the analysis engine) ----------
LOVABLE_API_KEY="<your Lovable AI gateway key>"
```

### Where to find these values

- **Project ref & URL** — your Supabase project's settings page; the URL looks like `https://<ref>.supabase.co`.
- **Publishable (anon) key** — safe for the browser; it is protected by Row-Level Security.
- **Service role key** — server-only. It bypasses RLS, so never commit it or ship it to the browser.
- **`LOVABLE_API_KEY`** — the Lovable AI Gateway key used by the analysis server functions (Gemini via the gateway).

> **Note for Lovable Cloud users:** when the project was built inside Lovable, these values are managed for you in the preview/published environment. The `.env` file is only needed when running the codebase yourself outside Lovable.

---

## 5. Set Up the Database

The schema, Row-Level Security policies, triggers, and the `has_role()` security-definer function all live in migration files under `supabase/migrations/`.

### Option A — Supabase CLI

```bash
# Install the Supabase CLI once (choose your platform):
npx supabase --version        # or: brew install supabase/tap/supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push
```

### Option B — Manual SQL

Open the SQL editor of your Supabase project and run the contents of every file in `supabase/migrations/` in filename order.

### What the migrations create

| Object | Purpose |
|--------|---------|
| `profiles` | Public user profile (first name, last name, institution) |
| `user_roles` | Role mapping (`student`, `faculty`, `institution_admin`, `super_admin`) |
| `documents` | Document records with type, author, title, status |
| `document_versions` | Each upload revision with storage path |
| `analyses` | Per-version results: similarity, AI, grammar, citation scores + stage progress |
| `handle_new_user()` trigger | Assigns the `student` role on signup |
| RLS policies | Owner-isolated access on every table — users only ever see their own rows |

---

## 6. Create the Storage Bucket

Documents are stored in a **private** bucket named `documents`.

- **Lovable Cloud:** the bucket and its policies are provisioned automatically.
- **Self-managed Supabase:** create it via dashboard (**Storage → New bucket → name `documents` → Private**) or run the storage policy statements included in the migrations. The bucket policies restrict every user to their own `{user_id}/` folder prefix.

---

## 7. Configure Authentication

1. **Email/password auth** is enabled by default.
2. **Google OAuth** — enable the Google provider in your auth settings and supply a Google OAuth client ID/secret. In Lovable Cloud this is brokered for you; on self-managed Supabase, configure **Auth → Providers → Google** with your own Google Cloud OAuth credentials.
3. The app's redirect URI uses `window.location.origin` (e.g. `http://localhost:8080` in development), so add that origin as an authorized redirect in your Google OAuth app.

> Roles are assigned automatically: new users get `student`. A super admin can promote users by inserting rows into `public.user_roles` directly.

---

## 8. Run the App

```bash
bun dev
# or
npm run dev
```

Open **http://localhost:8080**.

You will see the public welcome page with **Login** and **Register** buttons in the top-right corner.

### First run checklist

1. Click **Register** and create an account (you become a `student` by default).
2. Sign in — you land on your dashboard.
3. Go to **Documents**, upload a file (PDF, DOCX, or TXT). The upload dialog asks for the document type (research paper, assignment, thesis…), the author name, and the paper title.
4. The document enters the analysis queue — processed one at a time, with live stage progress (extracting → retrieving → scoring → rendering → completed).
5. Open **Analysis** to review plagiarism matches, AI-content passages, grammar issues, and citation findings, each with source evidence snippets.
6. Open **Reports** and download the DrillBit-style PDF reports (similarity, AI, grammar, citations — individually or as a batch).

---

## 9. Other Scripts

| Command | What it does |
|---------|--------------|
| `bun run build` | Production build (Vite) |
| `bun run preview` | Serve the production build locally |
| `bun run lint` | ESLint check |
| `bun run format` | Prettier formatting |

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Missing Supabase environment variable(s)` in the console | `.env` missing or misnamed | Re-check section 4; the file must be at the project root and named exactly `.env` |
| Blank page / hydration error on load | Client env vars absent | Ensure the `VITE_`-prefixed variables are set |
| Upload fails with storage error | `documents` bucket missing or policies not applied | Re-run migrations; verify the private `documents` bucket exists |
| "Unsupported provider" on Google sign-in | Google provider not configured | Enable the Google provider (section 7) |
| Vercel asks visitors to log in / "Team owners emailed. After they approve your request..." | Vercel Deployment Protection (Vercel Authentication) is enabled on preview deployments | Turn off **Vercel Authentication** in Vercel Dashboard → Project Settings → **Deployment Protection** (or add domain to Exceptions) |
| Analysis stuck at 0% | Queue jammed or stale job | Wait ~20s (the queue self-recovers and fails jobs older than 6 minutes) or reload the page |
| Analysis fails immediately | `LOVABLE_API_KEY` missing/invalid or file has < 200 extractable characters | Verify the gateway key; try a plain-text-heavy document |
| Migrations error out | Running combined statements where separate ones are required | Run each migration file individually |

---

## 11. Deployment Notes

- The app targets **Cloudflare Workers (edge)** hosting.
- Env vars bind at **request time** on the edge runtime — keep `process.env` reads inside handlers (the codebase already does this).
- For production, set the same env vars in your hosting provider's secret/environment settings; never commit `.env` to Git (it is git-ignored by default).

---

## 12. Where to Go Next

- **`README.md`** — feature overview and tech stack.
- **`docs/PROJECT_OVERVIEW.md`** — brand phrases, positioning, and product modules.
- **`docs/PHASES.md`** — build-phase status (what's complete, what's pending).
- **`devlog.md`** — development log and architecture notes.

---

© 2026 PlagiShield AI. All rights reserved.
