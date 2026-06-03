# PlagiShield AI

> AI-powered plagiarism intelligence and content authenticity platform for students, researchers, universities, publishers, and enterprises.

PlagiShield AI combines plagiarism detection, AI-generated content detection, grammar analysis, and citation verification into a single enterprise-grade workspace — built with the polish of Grammarly, the rigor of Turnitin, and the clarity of modern SaaS.

---

## ✨ Features

### Content Integrity
- **Plagiarism Detection** — Source matching against academic, web, and internal repositories with similarity scoring and side-by-side source comparison.
- **AI Content Detection** — Probability heatmap identifying AI-generated passages (GPT, Claude, Gemini, and more).
- **Grammar & Style Analysis** — Severity-ranked issues with one-click fixes, tone insights, and readability scoring.
- **Citation Verification** — APA, MLA, IEEE, and Chicago citation validation with auto-correction suggestions.

### Workspace
- **Document Management** — Drag-and-drop upload (PDF, DOCX, TXT) with version history and secure download links.
- **Analysis Workspace** — Multi-tab review interface for plagiarism, AI, grammar, and citations.
- **Reports** — Export branded PDF reports with full source attribution.
- **Repository** — Indexed institutional repository with searchable historical submissions.

### Enterprise
- **Role-Based Access Control** — Student, Faculty, Institution Admin, and Super Admin roles.
- **Team Management** — Invite members, assign roles, monitor usage.
- **Analytics** — Submission trends, AI detection rates, writing quality radar.
- **Subscription Tiers** — Free, Pro, Institution, and Enterprise plans.

---

## 🛠 Tech Stack

| Layer | Technology |
|------|------------|
| Framework | TanStack Start v1 (React 19, SSR) |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 + custom design tokens (oklch) |
| UI | shadcn/ui + Radix primitives |
| Charts | Recharts |
| Backend | Lovable Cloud (Supabase: Postgres, Auth, Storage, RLS) |
| Hosting | Cloudflare Workers (edge) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ or Bun
- A Lovable Cloud–enabled project (for auth, database, storage)

### Install & Run

```bash
bun install
bun dev
```

The app boots at `http://localhost:8080`.

### Environment Variables

| Variable | Scope | Purpose |
|---------|-------|---------|
| `VITE_SUPABASE_URL` | client | Lovable Cloud project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | Publishable API key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Admin operations (never exposed) |

---

## 🗂 Project Structure

```
src/
├── components/
│   ├── auth/        # AuthShell, sign-in UI
│   ├── layout/      # AppSidebar, AppTopbar, PageHeader, StatCard
│   └── ui/          # shadcn primitives
├── lib/
│   └── mock-data.ts # Sample documents, charts, recommendations
├── routes/          # File-based routing (TanStack Start)
│   ├── index.tsx        # Dashboard
│   ├── analysis.tsx     # Analysis workspace
│   ├── documents.tsx    # Upload & manage
│   ├── analytics.tsx
│   ├── repository.tsx
│   ├── team.tsx
│   ├── subscription.tsx
│   ├── reports.tsx
│   ├── settings.tsx
│   ├── login.tsx / register.tsx / forgot-password.tsx
│   └── __root.tsx
└── styles.css       # Design tokens (oklch), gradients, shadows
```

---

## 👥 Roles & Permissions

| Role | Capabilities |
|------|--------------|
| **Student** | Upload own documents, view own analyses & reports |
| **Faculty** | All student capabilities + review assigned class submissions |
| **Institution Admin** | Manage members, configure org settings, view org-wide analytics |
| **Super Admin** | Platform-wide configuration, audit logs, billing |

Roles are stored in a dedicated `user_roles` table and enforced via `SECURITY DEFINER` functions and RLS policies — never on the profile table (prevents privilege escalation).

---

## 🔒 Security

- Row-Level Security (RLS) on all user-data tables
- Role checks via `has_role(user_id, role)` security-definer function
- Secure signed-URL downloads from Supabase Storage
- Server-side analysis pipeline (no service-role key in client)
- HIBP password leak protection on signup

---

## 📜 License

Proprietary © 2026 PlagiShield AI. All rights reserved.
