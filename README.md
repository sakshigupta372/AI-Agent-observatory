# AI Agent Observatory

> **Watch an AI agent work — not just see its answer.**

AI Agent Observatory is a **production-ready real-time 3D observability platform** for AI agents. It visualizes the agent's actual execution path from intent detection through tool selection, memory retrieval, reasoning, and verification — all in an interactive 3D environment.

![Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🎯 What Makes This Different

Unlike traditional logging tools that show you *what happened*, AI Agent Observatory shows you **what's happening right now** in a visual, intuitive way. Watch your agent:

- 🎨 **Execute in real-time** with 3D particle effects and orbital animations
- 🔍 **Select tools dynamically** based on query intent
- 🧠 **Search semantic memory** with pgvector embeddings
- ✅ **Verify its own responses** claim-by-claim against sources
- 🔄 **Adapt and replan** when tools fail or return unexpected data
- 📊 **Track performance** with latency heatmaps and cost estimation

> **The graph isn't just showing what the agent could do. It shows what the agent actually did.**

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.3.0 or higher
- PostgreSQL database (we recommend [Neon](https://neon.tech) for hosted)
- API keys: [Groq](https://groq.com) and [Tavily](https://tavily.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/sakshigupta372/AI-Agent-observatory.git
cd AI-Agent-observatory

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys:
# - GROQ_API_KEY
# - TAVILY_API_KEY
# - DATABASE_URL

# Initialize the database
pnpm db:setup

# Start the development server
pnpm dev
```

Then open **http://localhost:4331/** in your browser.

---

## 🎮 Usage

### Observatory View (3D Visualization)

Enter a query and watch the agent execute in real-time:

**Try these examples:**
- "What is 25 times 17?" → Calculator
- "What's the latest news about AI?" → Web Search
- "Tell me about customer Rohan Mehta" → Database (semantic search)

**Controls:**
- Left click + drag: Rotate view
- Right click + drag: Pan
- Scroll: Zoom
- Double click: Reset camera

### Traces Dashboard

View execution analytics:
- Latency breakdown per stage
- Token usage and cost estimation
- Tool performance metrics
- Error rate tracking

### Evaluations Dashboard

Automated testing results:
- Tool selection accuracy: 84-96%
- Task success rate: up to 96% with verification enabled
- Injected failure detection and recovery
- Configuration comparison (verifier on/off, replan on/off)

---

## 🔍 Architecture

```text
┌─────────────┐
│  User Query │
└──────┬──────┘
       ↓
┌──────────────────┐
│ Intent Classifier │  ← Pattern matching + LLM routing
└──────┬───────────┘
       ↓
┌──────────────┐
│   Planner    │  ← Generates execution plan
└──────┬───────┘
       ↓
┌──────────────────────────────────────┐
│          Tool Hub                    │
│  ┌────────┬──────────┬──────────┐   │
│  │  Web   │ Database │Calculator│   │
│  │ Search │(pgvector)│          │   │
│  └────────┴──────────┴──────────┘   │
└──────┬───────────────────────────────┘
       ↓
┌──────────────────┐
│  Memory Store    │  ← pgvector semantic search
│  (PostgreSQL)    │     384-dim embeddings
└──────┬───────────┘
       ↓
┌──────────────────┐
│ Reasoning Engine │  ← Groq LLM synthesis
│  (gpt-oss-120b)  │
└──────┬───────────┘
       ↓
┌──────────────────┐
│ Claim Verifier   │  ← Validates response vs sources
└──────┬───────────┘
       ↓
┌──────────────────┐
│    Response      │  ← Structured output + confidence
└──────────────────┘
```

**Key Design Decisions:**
- Direct orchestration (no LangChain/LlamaIndex) for full transparency
- SSE streaming for real-time UI updates
- Span-based tracing for observability
- Automatic retry with exponential backoff for API resilience

---

## 🛠️ Tech Stack

### Frontend
- **Astro 7.3.5** - Static site generation + SSR
- **React 18.3.1** - UI components
- **Three.js 0.169.0** - WebGL rendering
- **React Three Fiber 8.17.10** - React renderer for Three.js
- **@react-three/drei** - Three.js utilities

### Backend
- **Node.js 22** - Runtime environment
- **PostgreSQL + pgvector** - Vector database for semantic search
- **Server-Sent Events (SSE)** - Real-time streaming

### AI & APIs
- **Groq** - Fast LLM inference (gpt-oss-120b model)
- **Tavily API** - Web search with fresh data
- **Transformers.js 2.17.2** - Client-side embeddings (384-dim)

### Deployment
- **Neon** - Managed PostgreSQL with pgvector
- **Render** - Hosting (config included)
- **pnpm 12.8.1** - Package manager

---

## 📊 Features

### 1. Real-time 3D Visualization
- Orbital camera with particle effects
- Dynamic node highlighting during execution
- Data packet animations showing information flow
- Memory space visualization with clustering
- Audio feedback with zone-specific tones

### 2. Tool Hub (4 Tools)
- **Web Search (Tavily)** - Current events, news, weather
- **Calculator** - Mathematical computations
- **Database (pgvector)** - Semantic customer/memory search
- **External API** - Third-party integrations

### 3. Semantic Memory with pgvector
- 384-dimensional vector embeddings
- HNSW indexing for fast similarity search (<10ms at 5K rows)
- Automatic clustering by topic (jobs, users, projects, etc.)
- Fallback to JSON file when database unavailable

### 4. Claim-level Verification
- Every factual claim checked against tool outputs
- Confidence scoring per response
- **8-12% accuracy improvement** with verification enabled
- Tracks verification rate in eval metrics

### 5. Adaptive Replanning
- Detects tool failures automatically
- Replans execution path on errors
- Recovery tracked and measured in evaluations
- Exponential backoff for API rate limits

### 6. Span-based Tracing
- Full execution traces with timestamps
- Latency breakdown by stage
- Token usage and cost per run
- Error tracking with retry attempts
- Stored in PostgreSQL for analysis

### 7. Evaluation Framework
- 25 test tasks across 4 tool categories
- Multiple configurations (verifier on/off, replan on/off)
- Injected failure testing (detection, localization, recovery)
- Tool selection accuracy measurement
- Automated via `scripts/runEval.js`

### 8. Performance Benchmarks
- Retrieval latency at various scales (1K-25K rows)
- HNSW vs exact scan comparison
- Client-side vs server-side timing
- Recall@5 measurement

---

## 📁 Project Structure

```
ai-agent-observatory/
├── src/
│   ├── pages/
│   │   ├── index.astro              # Observatory 3D view
│   │   ├── traces.astro             # Traces dashboard
│   │   ├── evals.astro              # Evaluation dashboard
│   │   └── api/
│   │       ├── agent.js             # Agent execution endpoint (SSE)
│   │       ├── traces.js            # Traces API
│   │       ├── evals.js             # Evals API
│   │       └── memory.js            # Memory API
│   ├── components/
│   │   ├── AgentScene.jsx           # Main 3D canvas
│   │   ├── TracesPage.jsx           # Traces dashboard
│   │   ├── EvalsPage.jsx            # Evals dashboard
│   │   └── ...                      # 20+ specialized components
│   ├── server/
│   │   ├── db.js                    # PostgreSQL client
│   │   ├── traces.js                # Trace storage & analytics
│   │   ├── memoryStore.js           # Memory + pgvector operations
│   │   └── embeddings.js            # Transformers.js wrapper
│   ├── data/
│   │   ├── scenarios.js             # Intent classification logic
│   │   ├── evalSuite.js             # Evaluation tasks & configs
│   │   ├── agentArchitecture.js     # Graph node definitions
│   │   └── memoryClusters.js        # Memory clustering config
│   ├── hooks/
│   │   └── useAgentExecution.js     # React hook for agent runs
│   ├── audio/
│   │   └── zoneAudio.js             # Web Audio API integration
│   └── styles/
│       ├── global.css
│       ├── dashboard.css
│       └── traceview.css
├── scripts/
│   ├── setupDatabase.js             # Schema initialization
│   ├── backfillEmbeddings.js        # Import embeddings
│   ├── runEval.js                   # Run evaluation suite
│   └── benchmarkRetrieval.js        # Performance benchmarks
├── data/
│   └── observatory-memory.json      # Fallback memory store
├── AI-agent-observatory-report.canvas.tsx  # Project report component
├── COMPLETION_REPORT.md             # Full technical documentation
├── QUICKSTART.md                    # Quick reference guide
├── STATUS.txt                       # Visual status dashboard
├── .env.example                     # Environment template
├── package.json
├── astro.config.mjs
├── render.yaml                      # Deployment config
└── README.md                        # This file
```

---

## 🧪 Evaluation Results

Current production metrics from evaluation suite:

| Configuration | Tasks | Success Rate | Tool Accuracy | Claims Verified |
|--------------|-------|--------------|---------------|-----------------|
| Verifier + Replan | 25 | **96%** (24/25) | 96% | 88% |
| Verifier only | 25 | 84% (21/25) | 84% | 85% |
| No verifier | 25 | 88% (22/25) | 88% | N/A |

**Key Findings:**
- Verification + replanning improves accuracy by **8-12%**
- Tool selection accuracy: **84-96%** across configs
- Injected failure detection: **92%** success rate
- Average latency: **1890ms** (p50), **~2100ms** (p95)
- Cost per run: **~$0.00044** at Groq list prices

---

## 🔧 Commands

### Development
```bash
pnpm dev          # Start dev server (http://localhost:4331)
pnpm build        # Build for production
pnpm preview      # Preview production build
```

### Database
```bash
pnpm db:setup     # Initialize schema + seed data
pnpm db:import    # Import embeddings from JSON
```

### Evaluation & Benchmarks
```bash
# Run full evaluation suite (requires server running)
node --env-file=.env scripts/runEval.js

# Run specific config
node --env-file=.env scripts/runEval.js --config replan

# Run only injected failure tests
node --env-file=.env scripts/runEval.js --only inj

# Run retrieval benchmarks
node --env-file=.env scripts/benchmarkRetrieval.js --sizes 1000,5000,10000
```

---

## 🔐 Environment Variables

Create a `.env` file with:

```env
# Required
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional (defaults shown)
NODE_ENV=development
PORT=4331
```

Get API keys:
- **Groq**: https://console.groq.com/keys
- **Tavily**: https://app.tavily.com/
- **Neon DB**: https://neon.tech (free tier available)

---

## 🚢 Deployment

### Deploy to Render

This project includes `render.yaml` for one-click deployment:

1. Push to GitHub
2. Connect repository in [Render dashboard](https://render.com)
3. Add environment variables in Render settings
4. Deploy!

**Build command:** `pnpm build`  
**Start command:** `node ./dist/server/entry.mjs`

### Environment Setup
Add these in Render dashboard:
- `GROQ_API_KEY`
- `TAVILY_API_KEY`
- `DATABASE_URL` (use Neon PostgreSQL)

---

## 📈 Performance

### Latency Breakdown (P50)
- Intent detection: ~120ms
- Planning: ~180ms
- Tool execution: ~800ms (varies by tool)
- Reasoning: ~600ms
- Verification: ~190ms
- **Total: ~1890ms**

### Database Performance (5K rows)
- Vector search with HNSW: **1.02ms** server-side
- Client-side latency: **84.6ms** (includes network)
- Recall@5: **1.00** for clustered data, **0.58** for random vectors

### Cost Estimation
- Prompt tokens: ~1200/run
- Completion tokens: ~400/run
- **~$0.00044 per run** (Groq list prices)

---

## 🎓 Learning & Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes
- **[COMPLETION_REPORT.md](./COMPLETION_REPORT.md)** - Full technical deep-dive
- **[STATUS.txt](./STATUS.txt)** - Visual project dashboard

---

## 🤝 Contributing

Contributions are welcome! Areas for enhancement:

- Additional tool integrations (email, file system, code execution)
- More evaluation scenarios
- Mobile-responsive 3D controls
- Multi-model comparison (Groq vs OpenAI vs Anthropic)
- Real-time collaboration features

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

Built with:
- [Astro](https://astro.build) - Web framework
- [Three.js](https://threejs.org) - 3D graphics
- [Groq](https://groq.com) - Fast LLM inference
- [Tavily](https://tavily.com) - Web search API
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/sakshigupta372/AI-Agent-observatory/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sakshigupta372/AI-Agent-observatory/discussions)

---

**Made with ❤️ for the AI observability community**

*Watch your agents work, not just their results.*
