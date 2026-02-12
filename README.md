# Agentic Recruitment Orchestrator

An AI-powered recruitment pipeline that parses Job Descriptions and Resumes, performs gap analysis using LLM reasoning, and drafts personalised outreach emails — all orchestrated by a multi-agent CrewAI crew.

> **Note:** Live link may not work since backend deployment is not done as it gets charged due to heavy models used. However, it works locally. Comments are added throughout the project for better understanding.

## Demo

<video src="https://github.com/coderpawan/Agentic-Recruitment-Orchestrator/blob/main/Recruitment%20Orchestration%20DEMO.mp4" width="100%" controls>
  Your browser does not support the video tag.
</video>

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js 14 Frontend                           │
│  ┌────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │ Upload     │  │ Candidate      │  │ Email Preview/Edit   │   │
│  │ Panel +    │  │ Cards + AI     │  │ Modal                │   │
│  │ Top-N Ctrl │  │ Insights       │  │                      │   │
│  └────────────┘  └────────────────┘  └──────────────────────┘   │
└─────────────────────────┬────────────────────────────────────────┘
                          │ REST API (proxied via Next.js rewrites)
┌─────────────────────────▼────────────────────────────────────────┐
│                  FastAPI Backend (async)                          │
│  ┌──────────┐  ┌──────────────────────────────────────────────┐  │
│  │ Ingestion│  │          CrewAI Agent Pipeline               │  │
│  │ Engine   │  │  ┌────────────┐ ┌───────────┐ ┌──────────┐  │  │
│  │ (PyMuPDF)│  │  │ Researcher │→│ Evaluator │→│  Writer  │  │  │
│  └──────────┘  │  └────────────┘ └───────────┘ └──────────┘  │  │
│  ┌──────────┐  └──────────────────────────────────────────────┘  │
│  │ ChromaDB │    ↑ Human-in-the-Loop approval gate               │
│  │ (Vectors)│    ↑ Session isolation (auto-reset per JD)         │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer         | Technology                                                      |
| ------------- | --------------------------------------------------------------- |
| LLM Provider  | **Groq** (Llama 3.3 70B Versatile) via CrewAI + LiteLLM        |
| Embeddings    | **all-MiniLM-L6-v2** (local, sentence-transformers — no API key needed) |
| Vector DB     | **ChromaDB** (persistent, cosine similarity)                    |
| Agents        | **CrewAI** (sequential 3-agent crew)                            |
| PDF Parsing   | **PyMuPDF** (fitz)                                              |
| Backend       | **FastAPI** (async, in-memory state)                            |
| Frontend      | **Next.js 14** + React 18 + Tailwind CSS + Radix UI            |

## The Three Agents

| Agent          | Role                                                                 |
| -------------- | -------------------------------------------------------------------- |
| **Researcher** | Analyses the JD → extracts technical reqs, soft skills, culture fit  |
| **Evaluator**  | Scores candidates with reasoning & gap analysis (trainable skills)   |
| **Writer**     | Drafts personalised outreach emails referencing specific projects    |

## Human-in-the-Loop Flow

1. Upload JD + Resumes
2. Set **Top-N candidates** to analyse (defaults to 5, clamped to resume count)
3. Launch pipeline → Researcher + Evaluator run automatically
4. **Pipeline pauses** at "Awaiting Approval"
5. User reviews AI shortlist, selects approved candidates
6. Writer drafts emails only for approved candidates
7. User can edit emails before sending

## Session Management

- **Automatic reset:** Uploading a new JD clears all previous state — documents, pipeline runs, and ChromaDB embeddings
- **Explicit reset:** `POST /api/session/reset` wipes everything for a clean slate
- **No cross-session leakage:** Each JD upload starts a fresh session with no stale data

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Groq API key ([console.groq.com](https://console.groq.com))

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

# Create .env with your Groq API key
echo GROQ_API_KEY=gsk_your_key_here > .env

# Run
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable         | Required | Default                    | Description                          |
| ---------------- | -------- | -------------------------- | ------------------------------------ |
| `GROQ_API_KEY`   | **Yes**  | —                          | Groq API key for LLM calls          |
| `GROQ_MODEL`     | No       | `llama-3.3-70b-versatile`  | Groq model identifier               |
| `EMBEDDING_MODEL`| No       | `all-MiniLM-L6-v2`         | Local sentence-transformers model    |
| `DEFAULT_TOP_N`  | No       | `5`                        | Default number of top candidates     |
| `FRONTEND_URL`   | No       | `http://localhost:3000`    | Allowed CORS origin                  |

## API Endpoints

| Method | Endpoint                                  | Description                              |
| ------ | ----------------------------------------- | ---------------------------------------- |
| POST   | `/api/upload/jd`                          | Upload a Job Description (PDF/TXT) — resets session |
| POST   | `/api/upload/resumes`                     | Upload multiple Resume PDFs              |
| GET    | `/api/documents`                          | List all uploaded documents              |
| POST   | `/api/pipeline/start`                     | Start the agent pipeline (top_n clamped to resume count) |
| GET    | `/api/pipeline/{run_id}`                  | Poll pipeline status & results           |
| POST   | `/api/pipeline/{run_id}/approve`          | Approve shortlisted candidates (HITL)    |
| PUT    | `/api/pipeline/{run_id}/emails/{rid}`     | Edit a drafted outreach email            |
| POST   | `/api/session/reset`                      | Explicitly reset all session state       |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py           # Env-based configuration (Groq keys, paths)
│   │   ├── models.py           # Pydantic schemas
│   │   ├── ingestion.py        # PDF/TXT extraction (PyMuPDF)
│   │   ├── vector_store.py     # ChromaDB embeddings, search & reset
│   │   ├── agents.py           # CrewAI agent definitions (Groq-powered)
│   │   └── main.py             # FastAPI application & endpoints
│   ├── uploads/                # Uploaded files (gitignored)
│   ├── chroma_db/              # Persistent vector store (gitignored)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx        # Command Center dashboard
│   │   ├── components/
│   │   │   ├── ui/             # Shadcn/UI primitives
│   │   │   ├── CandidateCard.tsx   # Match scores, AI insights, gap analysis
│   │   │   ├── EmailModal.tsx      # Edit outreach emails
│   │   │   ├── UploadPanel.tsx     # JD/resume upload + Top-N control
│   │   │   └── StatusBanner.tsx    # Pipeline status indicator
│   │   └── lib/
│   │       ├── api.ts          # API client (incl. session reset)
│   │       ├── types.ts        # TypeScript types
│   │       └── utils.ts        # cn() utility
│   ├── package.json
│   ├── next.config.js          # API proxy rewrites to FastAPI
│   ├── tailwind.config.js
│   └── tsconfig.json
└── README.md
```

## Key Design Decisions

- **Groq-only** — all LLM calls use Groq (Llama 3.3 70B); no OpenAI dependency
- **Local embeddings** — sentence-transformers `all-MiniLM-L6-v2` runs locally; no embedding API key needed
- **No keyword matching** — all evaluation uses LLM chain-of-thought reasoning
- **Session isolation** — uploading a new JD auto-resets ChromaDB and in-memory state to prevent cross-session data leakage
- **Dynamic Top-N** — user chooses how many candidates to analyse; backend clamps to actual resume count
- **Async pipeline** — FastAPI background tasks with 3-second polling from the frontend
- **Human-in-the-loop** — pipeline pauses for approval before email drafting
- **Chunked embeddings** — resumes are chunked (2000 chars, 200 overlap) for better retrieval
- **Cosine similarity** — ChromaDB uses cosine distance for semantic search
