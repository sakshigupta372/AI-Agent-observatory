# AI Agent Observatory

> **Watch an AI agent work — not just see its answer.**

AI Agent Observatory is a **real-time 3D observability tool** for AI agents. It visualizes the agent's actual execution path from intent detection to final verification.

### 🔍 What it shows

```text
User
 ↓
Intent → Planner → Tool → Memory
 ↓
Reasoning → Verification → Response
```

* Real agent execution visualized in 3D
* Dynamic tool selection
* Web Search, Database, Calculator & External API
* Semantic memory with `pgvector`
* Real-time streaming with SSE
* Claim-level response verification
* Tool/API latency and execution trace

### 🛠️ Tech Stack

**Astro · React · Three.js · React Three Fiber · Groq · Tavily · PostgreSQL · pgvector · Neon · Transformers.js · SSE**

### 🧠 Architecture

```text
User → Intent → Planner → Tool Hub
                    ↓
             Tool Execution
                    ↓
              pgvector Memory
                    ↓
                Reasoning
                    ↓
               Verifier
                    ↓
                Response
```

The orchestration is implemented directly instead of using LangChain/LlamaIndex, keeping routing, retrieval, tool execution, and verification visible.

> **The graph isn't just showing what the agent could do. It shows what the agent actually did.**
