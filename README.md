# OkNexus

A comprehensive **Security Engagement Management Platform** for managing penetration testing engagements, tracking vulnerabilities, and generating client reports — powered by an autonomous AI agentic retest engine.

---

## 🚀 Key Features

- **Engagement & Finding Management** — Track assessments, findings (Critical → Info), and retest statuses
- **AI-Powered Retest Engine** — Autonomous agent that uses Playwright + Groq LLM to verify if vulnerabilities are patched
- **AI Writing Assistance** — Text refinement, executive summary generation, and finding explanations via Groq/Gemini
- **Template Wizard** — Multi-turn AI chat to design custom pentest report templates
- **RAG-Powered Suggestions** — Local semantic search (Transformers.js + BGE embeddings) to ground AI suggestions in your project data
- **Client & Engineer Management** — Full profiles, engagement history, and analytics
- **Report Generation** — PDF/JSON export with custom branding, charts, and findings presentation

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Auth | NextAuth.js (Google OAuth) |
| AI (Frontend) | Groq SDK + Google Gemini SDK |
| AI (Engine) | Groq `llama-3.3-70b-versatile` |
| Local Embeddings | `@xenova/transformers` (BAAI/bge-small-en-v1.5) |
| Browser Automation | Playwright (Python) |
| Engine Server | Python + Flask |
| Charts | Recharts |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+, Python 3.11+

### Install
```bash
npm install
pip install -r retest_engine/requirements.txt
python -m playwright install chromium
```

### Configure `.env.local`
```env
# Auth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# AI
GROQ_API_KEY=...
GEMINI_API_KEY=...          # optional but recommended
NEXT_PUBLIC_AI_ENABLED=true
```

### Run
```bash
npm run dev:all   # starts Next.js + Python engine together
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📂 Project Structure

```
/app              Next.js App Router pages and API routes
/components       Reusable UI components
/lib              Utility functions, types, AI services, storage
/retest_engine    Autonomous Python vulnerability verification agent
/docs             All project documentation (see below)
/public           Static assets
```

---

## 📖 Documentation

All documentation lives in the [`/docs`](./docs) folder:

| Document | Description |
|---|---|
| [retest-engine.md](./docs/retest-engine.md) | Retest engine setup, API reference, action types, SSE events, troubleshooting |
| [deployment.md](./docs/deployment.md) | Deploying to Vercel (Next.js) and Railway (Python engine Docker) |
| [ai-layer.md](./docs/ai-layer.md) | AI provider setup (Groq + Gemini), Transformers.js local embeddings, feature reference |

---

## 🤝 Contributing

Contributions are welcome! Please open a Pull Request.

## 📄 License

[MIT](LICENSE)
