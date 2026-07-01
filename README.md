# Uni Buddy

An AI-powered study assistant for university students. Upload your lecture notes and Uni Buddy generates personalised practice questions, grades your answers in real time, and tracks your mastery across your course's learning outcomes.

**[Live](https://uni-buddy-2kmr.vercel.app)**

*Demo user access available on resume or upon request.*

---

## What it does

- **PDF ingestion** - upload lecture slides and course outlines; the app extracts topics and learning outcomes using Claude
- **AI question generation** - generates written, multiple-choice, and fill-in-the-blank questions grounded in your actual course materials
- **Real-time answer grading** - Claude evaluates free-text answers semantically, not just keyword-matching, with confidence-weighted scoring
- **Mastery tracking** - tracks per-outcome mastery over time, weighted by how confident you were when answering
- **Study recommendations** - post-session AI advice identifies weak areas and suggests what to focus on next
- **Bug reporting** - in-app bug report form

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 7 |
| Auth | Supabase Auth with SSR session management |
| AI | Anthropic Claude (Sonnet 4 for generation, Haiku for grading) |
| File storage | Supabase Storage (private bucket, signed URL access) |
| Rate limiting | Upstash Redis |
| Email | Resend |
| Deployment | Vercel |

---

## Architecture highlights

### Document-grounded AI
Course PDFs are stored privately in Supabase Storage. On every AI request, the app fetches the relevant documents and sends them to Claude via Anthropic's document API. All generated questions and grading are grounded in the actual course material - the model only references content present in the uploaded documents.

### Security
- PDF magic-byte validation on upload - rejects files that aren't actually PDFs regardless of what the client claims
- 50 MB upload cap; 20 MB cap on AI ingestion
- Private storage only - no public URLs; signed URLs generated on demand with short expiry
- Prompt injection sanitisation on user input before it reaches AI prompts
- Ownership checks on every private API route
- Tiered rate limiting via Upstash Redis (10 req/min on AI endpoints, 60 req/min general)

### Data integrity
- Database transactions on mastery score updates - no partial writes
- Cascade deletes throughout - removing a course cleans up all related data atomically
- Race condition handling in user creation flow

### Testing
- 46 unit tests across 5 files using Vitest
- Covers mastery calculation, rate limiting, document loading, JSON parsing, and input sanitisation

---

## Data model

```
User
└── Course
    ├── Topic
    │   ├── LearningOutcome ──── MasteryScore (per user)
    │   └── Questions
    ├── StudySession
    │   └── QuestionAttempts
    └── Document
```

---

## Running locally

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in the values - see Environment Variables section below

# Push schema to database
npx prisma db push

# Run dev server
npm run dev
```

```bash
# Run tests
npm test
```

---

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `RESEND_API_KEY` | Resend API key |
| `NOTIFY_EMAIL` | Email address for bug report notifications |
| `RESEND_FROM_EMAIL` | Sender address for outgoing emails |

---

## Future improvements

- **RAG pipeline** - replace full PDF injection with a retrieval-augmented generation system: chunk documents at upload time, embed them, and retrieve only the most relevant sections per query. This would reduce token usage and support larger document sets
- **Spaced repetition** - replace the current mastery algorithm with SM-2 or similar for smarter session scheduling
- **Streaming responses** - stream AI responses token-by-token instead of waiting for the full response
- **Error monitoring** - add Sentry for production visibility
- **Pagination** - paginate the questions list for courses with large question banks
