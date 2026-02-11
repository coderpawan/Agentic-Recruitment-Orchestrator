# Agentic Recruitment Orchestrator

An AI-powered recruitment pipeline that parses Job Descriptions and Resumes, performs gap analysis using LLM reasoning, and drafts personalised outreach emails — all orchestrated by a multi-agent CrewAI crew.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js 14 Frontend                           │
│  ┌────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │ Upload     │  │ Candidate      │  │ Email Preview/Edit   │   │
│  │ Panel      │  │ Cards + AI     │  │ Modal                │   │
│  │            │  │ Insights       │  │                      │   │
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
│  │ (Vectors)│                                                    │
│  └──────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## The Three Agents

| Agent        | Role                                                                 |
| ------------ | -------------------------------------------------------------------- |
| **Researcher** | Analyses the JD → extracts technical reqs, soft skills, culture fit |
| **Evaluator**  | Scores candidates with reasoning & gap analysis (trainable skills)  |
| **Writer**     | Drafts personalised outreach emails referencing specific projects   |

## Human-in-the-Loop Flow

1. Upload JD + Resumes
2. Launch pipeline → Researcher + Evaluator run automatically
3. **Pipeline pauses** at "Awaiting Approval"
4. User reviews AI shortlist, selects approved candidates
5. Writer drafts emails only for approved candidates
6. User can edit emails before sending

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An OpenAI API key (or Anthropic API key)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

# Configure your API keys
copy .env.example .env       # Windows
# cp .env.example .env       # macOS/Linux
# Edit .env with your actual API keys

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

## API Endpoints

| Method | Endpoint                                  | Description                              |
| ------ | ----------------------------------------- | ---------------------------------------- |
| POST   | `/api/upload/jd`                          | Upload a Job Description (PDF/TXT)       |
| POST   | `/api/upload/resumes`                     | Upload multiple Resume PDFs              |
| GET    | `/api/documents`                          | List all uploaded documents              |
| POST   | `/api/pipeline/start`                     | Start the agent pipeline                 |
| GET    | `/api/pipeline/{run_id}`                  | Poll pipeline status & results           |
| POST   | `/api/pipeline/{run_id}/approve`          | Approve shortlisted candidates (HITL)    |
| PUT    | `/api/pipeline/{run_id}/emails/{rid}`     | Edit a drafted outreach email            |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py           # Env-based configuration
│   │   ├── models.py           # Pydantic schemas
│   │   ├── ingestion.py        # PDF/TXT extraction (PyMuPDF)
│   │   ├── vector_store.py     # ChromaDB embeddings & search
│   │   ├── agents.py           # CrewAI agent definitions
│   │   └── main.py             # FastAPI application & endpoints
│   ├── uploads/                # Uploaded files (gitignored)
│   ├── chroma_db/              # Persistent vector store (gitignored)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx        # Command Center dashboard
│   │   ├── components/
│   │   │   ├── ui/             # Shadcn/UI primitives
│   │   │   ├── CandidateCard.tsx
│   │   │   ├── EmailModal.tsx
│   │   │   ├── UploadPanel.tsx
│   │   │   └── StatusBanner.tsx
│   │   └── lib/
│   │       ├── api.ts          # API client
│   │       ├── types.ts        # TypeScript types
│   │       └── utils.ts        # cn() utility
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
└── README.md
```
               |

## Key Design Decisions

- **No keyword matching** — all evaluation uses LLM chain-of-thought reasoning
- **Async pipeline** — FastAPI background tasks with polling from the frontend
- **Human-in-the-loop** — pipeline pauses for approval before email drafting
- **Chunked embeddings** — resumes are chunked with overlap for better retrieval
- **Cosine similarity** — ChromaDB uses cosine distance for semantic search
