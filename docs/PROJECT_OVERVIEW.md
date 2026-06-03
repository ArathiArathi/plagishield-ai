# PlagiShield AI — Project Overview

## Tagline
**Plagiarism intelligence for the modern academic.**

## One-Line Pitch
PlagiShield AI safeguards content authenticity at scale — combining plagiarism detection, AI-content identification, grammar analysis, and citation verification in one enterprise-grade SaaS platform.

## Elevator Pitch
PlagiShield AI is the next-generation content authenticity platform built for the AI era. While legacy tools only check for copied text, PlagiShield combines **four authenticity signals** — plagiarism matching, AI-generated content detection, grammar & style scoring, and citation verification — into a single, beautifully designed workspace. Trusted by universities, publishers, and research institutions, PlagiShield helps educators uphold academic integrity, researchers protect original work, and enterprises ensure content authenticity at scale.

---

## Key Phrases & Positioning

### Brand Phrases
- **"Plagiarism intelligence for the modern academic."**
- **"Safeguard content authenticity at scale."**
- **"Beyond plagiarism — content authenticity for the AI era."**
- **"From submission to certified original — in seconds."**
- **"The integrity layer for academic and enterprise content."**

### Value Propositions
- **For Students** — *"Submit with confidence. Catch issues before your professor does."*
- **For Faculty** — *"Spend less time policing, more time teaching."*
- **For Institutions** — *"Institution-grade integrity. Zero-setup deployment."*
- **For Publishers** — *"Verify originality before publication, every time."*
- **For Enterprises** — *"Authentic content is brand-safe content."*

### Feature Phrases
- **AI Content Detection** — *"Detects GPT, Claude, Gemini and more — with passage-level probability heatmaps."*
- **Plagiarism Matching** — *"Billions of sources. Sub-second matches. Side-by-side comparison."*
- **Grammar & Style** — *"Severity-ranked fixes with one-click acceptance."*
- **Citation Verification** — *"APA, MLA, IEEE, Chicago — validated and auto-corrected."*
- **Repository** — *"Searchable institutional history. Forever indexed."*
- **Reports** — *"Audit-ready PDF reports with full source attribution."*

---

## Target Audiences

| Audience | Primary Need | Key Phrase |
|----------|--------------|-----------|
| Students | Submit clean, original work | *"Check before you submit."* |
| Researchers | Protect originality, verify citations | *"Originality, certified."* |
| Faculty | Triage submissions efficiently | *"Integrity at a glance."* |
| Universities | Org-wide integrity infrastructure | *"Integrity infrastructure for institutions."* |
| Publishers | Pre-publication verification | *"Publish authentic. Publish confidently."* |
| Enterprises | Brand-safe authentic content | *"Authenticity as a service."* |

---

## Differentiators

1. **Four signals, one workspace** — Plagiarism + AI + Grammar + Citations, unified.
2. **Built for the AI era** — Detects modern LLM output, not just copy-paste.
3. **Enterprise-ready from day one** — RBAC, SSO-ready, audit logs, branded reports.
4. **Beautiful by default** — Designed with the polish of Grammarly and the rigor of Turnitin.
5. **Sub-second analysis** — Edge-deployed pipeline for instant feedback.

---

## Core User Workflows

### 1. Submit & Analyze
> *Drag, drop, done.* — Upload a document and receive a full authenticity report in seconds.

### 2. Review & Resolve
> *See every issue. Fix with one click.* — Multi-tab workspace for plagiarism matches, AI passages, grammar fixes, and citation corrections.

### 3. Report & Archive
> *Audit-ready in one click.* — Export branded PDF reports; documents are securely archived to the institutional repository with version history.

### 4. Manage & Monitor
> *Org-wide integrity, at a glance.* — Admins manage members, monitor usage trends, and configure policies from a single dashboard.

---

## Roles & RBAC

| Role | Description |
|------|-------------|
| **Student** | Upload own documents, view own analyses and reports. |
| **Faculty** | Review assigned class submissions in addition to own work. |
| **Institution Admin** | Manage members, configure organization settings, view org-wide analytics. |
| **Super Admin** | Platform configuration, audit logs, billing oversight. |

---

## Product Modules

- **Dashboard** — Submission trends, AI detection rates, integrity score at a glance.
- **Documents** — Upload, organize, version, and download with secure signed URLs.
- **Analysis Workspace** — Plagiarism · AI Detection · Grammar · Citations (tabbed).
- **Reports** — Branded, exportable PDF reports with source attribution.
- **Repository** — Searchable institutional archive of all historical submissions.
- **Analytics** — Writing quality radar, submission heatmaps, AI trend lines.
- **Team** — Member invites, role assignment, usage monitoring.
- **Subscription** — Free · Pro · Institution · Enterprise tiers.
- **Settings** — Profile, notifications, API access, integrations.

---

## Subscription Tiers

| Tier | Audience | Phrase |
|------|----------|--------|
| **Free** | Individual students | *"Start safeguarding your work — free forever."* |
| **Pro** | Researchers, power users | *"Unlimited submissions, advanced AI detection."* |
| **Institution** | Universities, schools | *"Integrity infrastructure for your campus."* |
| **Enterprise** | Publishers, large orgs | *"Custom SLAs, SSO, dedicated support."* |

---

## Marketing Taglines (A/B candidates)

1. *"Plagiarism intelligence for the AI era."*
2. *"Beyond plagiarism — content authenticity, certified."*
3. *"The integrity layer for academic and enterprise content."*
4. *"Original. Verified. Certified."*
5. *"Submit with confidence. Publish with proof."*

---

## Tech & Trust

- Built on **Lovable Cloud** (Postgres, Auth, Storage with RLS)
- **Edge-deployed** for sub-second response times globally
- **Role-Based Access Control** stored in a separate `user_roles` table with `SECURITY DEFINER` functions
- **Signed-URL downloads** — files never publicly exposed
- **HIBP-protected** signup against leaked passwords
- **Audit logs** for every analysis, download, and admin action

---

© 2026 PlagiShield AI. All rights reserved.
