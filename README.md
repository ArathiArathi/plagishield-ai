# 🛡️ PlagiShield AI
### Intelligent Academic Integrity & Document Analysis Platform

<p align="center">
  <strong>Analyze. Understand. Improve.</strong><br/>
  A modern platform for academic document analysis, similarity insights, AI-generated content assessment, and writing quality improvement.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active%20Development-blue?style=for-the-badge" alt="Project Status"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/TanStack-Start-000000?style=for-the-badge" alt="TanStack Start"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white"/>
  <img src="https://img.shields.io/badge/Supabase-Backend-3FCF8E?style=flat-square&logo=supabase&logoColor=white"/>
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-Not_Specified-lightgrey?style=flat-square"/>
</p>

---

## 📌 Overview

**PlagiShield AI** is an academic document analysis platform designed to help students, educators, and institutions examine written submissions and gain useful insights into document originality and quality.

The platform brings together similarity analysis, AI-generated content assessment, writing and grammar feedback, and citation completeness checks in one workspace.

It also provides dashboards, document management, reports, and role-based access for different types of users.

> **Our goal:** Make academic document review more accessible, understandable, and efficient.

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🔍 Similarity Analysis
- Similarity and source-match insights
- Stored analysis results
- Source-match review

</td>
<td width="50%">

### 🤖 AI Content Assessment
- AI-generated content probability
- Confidence information
- Explanations and reasoning

</td>
</tr>
<tr>
<td width="50%">

### ✍️ Writing Quality
- Grammar issue identification
- Suggested corrections
- Writing improvement insights

</td>
<td width="50%">

### 📚 Citation Review
- Citation completeness insights
- Reference review support
- Academic writing assistance

</td>
</tr>
<tr>
<td width="50%">

### 📊 Analytics & Reports
- Analysis dashboards
- Document-level reporting
- Analytics and activity views

</td>
<td width="50%">

### 🔐 Secure Document Management
- Private document storage
- Document version tracking
- Role-based access control

</td>
</tr>
</table>

---

## 🧭 How It Works

```mermaid
flowchart TD
    A([Start]) --> B[User Authentication]
    B --> C[Upload Academic Document]
    C --> D[Secure Document Storage]
    D --> E[Server-side Text Extraction]
    E --> F[Analysis Pipeline]
    F --> G[Similarity & Source Insights]
    F --> H[AI Content Assessment]
    F --> I[Grammar & Citation Review]
    G --> J[Persist Analysis Results]
    H --> J
    I --> J
    J --> K[Dashboard & Reports]
    K --> L([Review Results])
```

### Analysis lifecycle

| Stage | Description |
|---|---|
| `UPLOADED` | Document has been submitted |
| `PROCESSING` | Document is being prepared and analyzed |
| `ANALYZED` | Analysis results are available |
| `FAILED` | Processing encountered an error |

---

## 👥 User Roles

PlagiShield AI supports role-based access for different users.

| Role | Purpose |
|---|---|
| 🎓 Student | Submit and review academic documents |
| 👨‍🏫 Faculty | Review submissions and analysis insights |
| 🏛️ Institution Admin | Manage institutional-level access and oversight |
| ⚙️ Super Admin | Administrative platform management |

Access permissions are enforced through application-level role checks and database security policies.

---

## 🛠️ Technology Stack

### Frontend
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

- React
- TypeScript
- TanStack Start
- TanStack Router
- Tailwind CSS
- shadcn/ui
- Radix UI
- Recharts

### Backend & Data
![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)

- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Storage
- Row Level Security (RLS)
- Server-side analysis functions

### Development Tools

- Bun
- Vite
- ESLint
- Git
- GitHub

---

## 🏗️ Application Architecture

```mermaid
flowchart TB
    U[Users] --> UI[React Application]
    UI --> ROUTES[TanStack Routes]
    ROUTES --> AUTH[Authentication & Role Guards]
    ROUTES --> API[Server Functions]
    API --> ENGINE[Analysis Engine]
    ENGINE --> EXTRACT[Text Extraction]
    ENGINE --> AI[AI Analysis Gateway]
    API --> DB[(Supabase PostgreSQL)]
    API --> STORAGE[Private Document Storage]
    DB --> RESULTS[Persisted Analysis Results]
    RESULTS --> UI
```

The application separates the user interface, server-side processing, database operations, and private document storage. This supports a structured approach to document handling and access control.

---

## 🔐 Security

Security is an important part of the platform.

Current implementation includes:

- Authentication and protected application routes.
- Role-based authorization.
- Private document storage.
- Owner-scoped storage access policies.
- Short-lived signed URLs for document access.
- Database-level Row Level Security policies.
- Server-side handling of privileged operations.

**Important:** Keep service-role credentials on the server. Never expose privileged keys through frontend environment variables or commit secrets to Git.

---

## ⚠️ Important Notes

- Similarity analysis and AI-content assessment provide indicators, not definitive proof of plagiarism or AI authorship.
- Results should be interpreted by qualified reviewers and considered alongside the original document and relevant context.
- Cross-submission institutional matching is planned development, not a feature to assume is currently available.
- Native PDF/DOCX parsing capabilities and export functionality may evolve as development progresses.
- No license file is currently included in the repository.

---

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test your changes.
5. Submit a pull request with a clear description.

For significant changes, consider opening an issue first to discuss the proposed implementation.

---

## 👩‍💻 Project

**Repository:** [ArathiArathi / plagishield-ai](https://github.com/ArathiArathi/plagishield-ai)

**Project:** PlagiShield AI

---

<p align="center">
  <strong>🛡️ PlagiShield AI</strong><br/>
  <sub>Promoting originality, strengthening academic integrity, and improving academic writing.</sub>
</p>
