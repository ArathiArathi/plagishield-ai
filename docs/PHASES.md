# PlagiShield AI — Project Phases

> *Defend originality. Detect AI. Deliver trust.*

Status of every build phase: what is done, and what is still pending.

---

## ✅ Completed

### Phase 0 — Product definition & design system
*Beyond plagiarism — true content authenticity.*
- Brand, tagline, positioning for students, faculty, institutions.
- Semantic design tokens, light/dark theme, typography and shadow scale.
- Responsive app shell: collapsible sidebar, topbar, page header, stat cards.

### Phase 1 — Application surface
*One workspace for every integrity check.*
- Routes: Dashboard, Documents, Analysis, Reports, Analytics, Repository, Team, Subscription, Settings.
- Auth screens: sign in, register, forgot password, reset password, verify email.
- Per-route SEO metadata, charts, tables, empty states.

### Phase 2 — Authentication
*Trusted identity before trusted content.*
- Email + password sign-up and sign-in.
- Google sign-in via the managed OAuth broker (provider enabled), available on both the sign-in and register screens.
- Friendly error handling for duplicate emails, weak passwords, and network failures.
- Password recovery: request → email link → set new password.
- `profiles` auto-created on signup by a database trigger; session managed by a single auth-state subscriber; sign-out from the topbar.

### Phase 3 — Role-based access control
*The right view for every role.*
- `app_role` enum: `student`, `faculty`, `institution_admin`, `super_admin`.
- Roles stored in a dedicated `user_roles` table (never on `profiles`).
- `has_role()` security-definer function backs all row-level security policies.
- `RoleGuard` enforces per-route access; sidebar hides routes the role cannot open.

| Route | Allowed roles |
| --- | --- |
| Dashboard, Documents, Analysis, Reports, Settings | all roles |
| Analytics, Repository | faculty, institution admin, super admin |
| Team, Subscription | institution admin, super admin |

### Phase 4 — Document upload, storage & versioning
*Every draft, every version, fully accounted for.*
- Private `documents` storage bucket with owner-scoped policies.
- `documents` + `document_versions` tables; re-uploading a file name creates version N+1.
- Drag-and-drop upload with progress, type and size validation.
- Short-lived signed URLs for secure downloads.

### Phase 5 — Analysis workflow
*Plagiarism, AI, grammar, citations — one verdict.*
- Each upload enqueues an `analyses` row and runs the server-side pipeline.
- Text extracted from the stored file and scored through the AI gateway.
- Persisted per document: similarity with source matches, AI-generation probability with confidence and reasoning, grammar issues with fixes, citation completeness.
- Lifecycle: `uploaded → processing → analyzed | failed`.

### Phase 6 — Live workspace, no dummy data
*From submission to certainty in seconds.*
- Dashboard, Analysis, **Reports, Analytics and Repository** all read real documents and analyses.
- All placeholder/mock datasets removed from the app surface.
- Reports render real scores, matched sources, and generated recommendations per document, with print/PDF export.
- Analytics computes real trends, similarity distribution, AI split, writing-quality radar, and most common grammar errors.
- Repository lists and searches real indexed documents.
- Honest loading skeletons and empty states everywhere.

---

## 🚧 Pending

### Phase 7 — Institution intelligence
*Integrity at the speed of research.*
- Cross-submission matching against the institutional repository (currently source matching only).
- Cohort and department analytics for faculty and administrators.
- Team invitations, seat management, and role assignment from the Team page (page is UI-only today).
- Subscription plans and usage-limit enforcement (page is UI-only today).

### Phase 8 — Reporting & integrations
- Branded server-generated PDF export (today: browser print export).
- Side-by-side original vs. source comparison view.
- Native parsing for PDF and DOCX beyond plain-text extraction.
- Notifications (email/in-app) when an analysis completes.
- LMS / API integrations for bulk submission.

---

## Verification checklist

1. Register an account (email or Google) and sign in.
2. Confirm the assigned role gates restricted routes.
3. Upload a document; confirm a version row and status moving to `analyzed`.
4. Open Analysis and Reports for that document; confirm real scores render.
5. Check Dashboard, Analytics, and Repository reflect the upload.
