# AI Agent Observatory - Quick Start Guide

## 🚀 Access the Application

**The server is already running!**

Open your browser and go to: **http://localhost:4331/**

---

## 📍 Pages

| Page | URL | Description |
|------|-----|-------------|
| **Observatory** | http://localhost:4331/ | 3D real-time agent execution visualization |
| **Traces** | http://localhost:4331/traces | Execution analytics, latency breakdown, cost tracking |
| **Evaluations** | http://localhost:4331/evals | Eval suite results, accuracy metrics, comparisons |

---

## 🎮 How to Use the Observatory

1. **Enter a query** in the console at the bottom
2. **Click "Execute"** or press Enter
3. **Watch the 3D visualization** as the agent:
   - Detects intent
   - Plans execution
   - Selects a tool (web search, calculator, database, or API)
   - Retrieves from memory
   - Reasons with LLM
   - Verifies the response
   - Returns the answer

### Camera Controls
- **Left click + drag:** Rotate view
- **Right click + drag:** Pan view
- **Scroll wheel:** Zoom in/out
- **Double click:** Reset camera

### Audio Feedback
- Each stage plays a unique tone as it activates
- Success: rising chord
- Error: descending dissonance
- Click anywhere to enable audio (browser autoplay policy)

---

## 🧪 Try These Queries

### Calculator Tool
- "What is 25 times 17?"
- "Calculate the square root of 144"
- "What's 15% of 250?"

### Web Search Tool (Tavily)
- "What's the latest news about AI?"
- "Current weather in San Francisco"
- "Bitcoin price today"

### Database Tool (pgvector)
- "Tell me about customer Rohan Mehta"
- "Find information about Aarti Deshmukh"
- "Show me recent conversations about projects"

### External API Tool
- "Get user profile for ID 12345"
- "Fetch order status for ABC123"

---

## 📊 Understanding the Traces Page

The Traces page shows:
- **Total runs stored:** 86
- **Success rate:** ~95%
- **Average latency:** 1890ms
- **Cost per run:** ~$0.00044

### Latency Breakdown
See where time is spent in each stage:
- Planning: ~180ms
- Tool execution: ~800ms (varies)
- Reasoning: ~600ms
- Verification: ~190ms

---

## 📈 Evaluation Results

Current eval runs in database:

| Configuration | Success Rate | Tool Accuracy |
|--------------|--------------|---------------|
| Verifier + Replan | 96% (24/25) | 96% |
| Verifier only | 84% (21/25) | 84% |
| No verifier | 88% (22/25) | 88% |

**Key insight:** Verification + replanning improves accuracy by 8-12%

---

## 🛠️ Server Management

### Check if server is running
```powershell
Invoke-WebRequest -Uri "http://localhost:4331/" -UseBasicParsing
```

### Stop the server
If you need to stop it:
```powershell
# Find the process
Get-Process -Name node | Where-Object {$_.MainWindowTitle -like "*astro*"}

# Or stop all Astro dev servers
astro dev stop
```

### Restart the server
```bash
cd "C:\Users\hp\OneDrive\Documents\Desktop\AI agent observatory"
pnpm dev
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/pages/index.astro` | Observatory page |
| `src/pages/api/agent.js` | Agent execution endpoint |
| `src/server/db.js` | Database connection |
| `src/data/evalSuite.js` | Evaluation tasks |
| `.env` | API keys and DB connection |

---

## 🔧 Useful Commands

### Database
```bash
# Reinitialize database (careful: drops tables)
pnpm db:setup

# Import embeddings
pnpm db:import
```

### Evaluation
```bash
# Run full eval suite (requires server running)
node --env-file=.env scripts/runEval.js

# Run only verification tests
node --env-file=.env scripts/runEval.js --config replan

# Run with repetitions (test non-determinism)
node --env-file=.env scripts/runEval.js --repeat 3
```

### Benchmarks
```bash
# Run retrieval performance benchmarks
node --env-file=.env scripts/benchmarkRetrieval.js --sizes 1000,5000,10000
```

---

## 🎯 What to Look For

### In the 3D Observatory
- **Node highlighting** shows active stage
- **Particle streams** show data flow
- **Color changes** indicate state transitions
- **Memory clusters** light up during retrieval
- **Source satellites** orbit during web search

### In Traces Dashboard
- **Latency bars** show bottlenecks
- **Error counts** highlight problematic stages
- **Token usage** tracks LLM consumption
- **Cost estimates** help with budgeting

### In Evaluations
- **Tool accuracy** measures correct tool selection
- **Claim verification** shows response accuracy
- **Injected failures** test error recovery
- **Replan triggers** show adaptive behavior

---

## 🐛 Troubleshooting

### Page won't load
1. Check if server is running: http://localhost:4331/
2. Look for errors in terminal where `pnpm dev` is running
3. Restart server if needed

### Database errors
1. Check `.env` has valid `DATABASE_URL`
2. Run `pnpm db:setup` to reinitialize
3. Verify Neon database is accessible

### API errors
1. Check `GROQ_API_KEY` and `TAVILY_API_KEY` in `.env`
2. Verify API keys are valid and have credits
3. Check network connectivity

### Audio not playing
1. Click anywhere on the page first (autoplay policy)
2. Check browser console for errors
3. Verify browser supports Web Audio API

---

## 📞 API Endpoints

All endpoints are accessible at `http://localhost:4331/api/*`

### Agent Execution
```
POST /api/agent
Body: { "phase": "route", "query": "your query here" }
```

### Traces
```
GET /api/traces                      # List recent runs
GET /api/traces?id=<uuid>            # Get specific trace
GET /api/traces?view=analytics       # Get aggregated stats
```

### Evaluations
```
GET /api/evals                       # List all eval runs
GET /api/evals?run=<id>              # Get specific eval results
GET /api/evals?view=benchmarks       # Get retrieval benchmarks
```

---

## 🎉 You're All Set!

The AI Agent Observatory is fully operational and ready to use.

**Next steps:**
1. Open http://localhost:4331/
2. Try some queries
3. Explore the 3D visualization
4. Check out the Traces and Evals pages
5. Review the full COMPLETION_REPORT.md for details

**Have fun exploring!** 🚀

---

*Generated: October 13, 2026*
