# PlagiShield AI — Build Phases

> *Defend originality. Detect AI. Deliver trust.*

This document tracks the delivery phases of PlagiShield AI, the phrases that define
each phase, and the exact state of completion.

---

## Phase 0 — Product Definition & Design System

**Phrase:** *Beyond plagiarism — true content authenticity.*

- Brand, tagline, and positioning for students, researchers, universities, publishers, enterprises.
- Enterprise design system: semantic color tokens, dark/light theme, typography scale, shadows.
- Responsive app shell: collapsible sidebar, topbar, page header, stat cards.

**Status: Complete**

---

## Phase 1 — Application Surface

**Phrase:** *One workspace for every integrity check.*

- Routes: Dashboard, Documents, Analysis, Reports, Analytics, Repository, Team, Subscription, Settings.
- Auth screens: Sign in, Register, Forgot password, Reset password, Verify email.
- Charts, tables, tabs, empty states, and per-route SEO metadata.

**Status: Complete**

---

## Phase 2 — Authentication

**Phrase:** *Trusted identity before trusted content.*

- Email + password sign-up and sign-in via Lovable Cloud Auth.
- Google sign-in through the managed OAuth broker.
- Password recovery: reset request → email link → set new password.
- `profiles` table auto-populated on signup by a database trigger.
- Session state via a single `onAuthStateChange` subscriber; unauthenticated
  visitors are redirected to `/login`; topbar shows identity + sign-out.

**Status: Complete**

---

## Phase 3 — Role-Based Access Control

**Phrase:** *The right view for every role.*

- `app_role` enum: `student`, `faculty`, `institution_admin`, `super_admin`.
- Roles stored in a dedicated `user_roles` table (never on `profiles`) to prevent
  privilege escalation.
- `has_role()` security-definer function powers all row-level security policies.
- `RoleGuard` enforces per-route role requirements; the sidebar hides routes the
  current role cannot open.

| Route | Allowed roles |
| --- | --- |
| Dashboard, Documents, Analysis, Reports, Settings | all roles |
| Analytics, Repository | faculty, institution admin, super admin |
| Team, Subscription | institution admin, super admin |

**Status: Complete**

---

## Phase 4 — Document Upload, Storage & Versioning

**Phrase:** *Every draft, every version, fully accounted for.*

- Private `documents` storage bucket with owner-scoped access policies.
- `documents` + `document_versions` tables; re-uploading the same file name
  creates version N+1 rather than overwriting.
- Drag-and-drop upload with progress, type/size validation.
- Short-lived signed URLs for secure downloads.

**Status: Complete**

---

## Phase 5 — Analysis Workflow

**Phrase:** *Plagiarism, AI, grammar, citations — one verdict.*

- Every upload enqueues an `analyses` row and runs a server-side pipeline.
- Text is extracted from the stored file and scored through the Lovable AI Gateway.
- Structured output persisted per document: similarity score with source matches,
  AI-generation probability with confidence and reasoning, grammar issues with
  suggested fixes, citation completeness and format issues.
- Document lifecycle: `uploaded → processing → analyzed | failed`.

**Status: Complete**

---

## Phase 6 — Live Dashboard & Analysis Workspace

**Phrase:** *From submission to certainty in seconds.*

- Dashboard reads real documents and analyses: quality score, similarity,
  AI detection, grammar, citation, total documents.
- Real submission trend (last 7 months), similarity distribution buckets,
  AI-content split, and recent activity feed.
- Analysis workspace loads a selected document's stored results across the
  Plagiarism, AI Detection, Grammar, Citation, and Recommendations tabs.
- Honest empty states when no documents have been analyzed yet.

**Status: Complete**

---

## Phase 7 — Institution Intelligence (Next)

**Phrase:** *Integrity at the speed of research.*

- Cross-submission repository matching against prior institutional documents.
- Cohort and department analytics for faculty and administrators.
- Team invitations, seat management, and role assignment from the Team page.
- Exportable PDF integrity reports and subscription/billing enforcement.

**Status: Planned**

---

## Verification Checklist

1. Register an account, confirm email, sign in.
2. Assign a role in `user_roles`; confirm restricted routes appear or block accordingly.
3. Upload a document; confirm a version row is created and the status moves to `analyzed`.
4. Open the Analysis page for that document; confirm real scores render.
5. Return to the Dashboard; confirm stats and activity reflect the upload.
