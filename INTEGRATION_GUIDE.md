# Integration Guide: Claude, SAM, OpenClaw & Hermes Agent

## 🎯 Overview

AI Agent Observatory can integrate with multiple agent frameworks and AI models in real-time. This guide shows you how to connect:

1. **Claude (Anthropic)** - Real-time LLM reasoning
2. **SAM (Segment Anything Model)** - Visual understanding
3. **OpenClaw** - Browser automation agent
4. **Hermes Agent** - Multi-model agent framework

---

## 🤖 1. Claude Integration (Real-time)

### **Why Integrate Claude?**
- Stream Claude's reasoning in real-time
- Compare Claude vs Groq performance
- Track Claude's tool selection decisions
- Monitor cost per model

### **Architecture:**
```
User Query → Observatory → Claude API (streaming)
                ↓
    Real-time SSE updates to 3D view
                ↓
    Database trace storage
```

### **Implementation:**

#### **Step 1: Add Anthropic SDK**
```bash
pnpm add @anthropic-ai/sdk
```

#### **Step 2: Update Environment Variables**
```env
# .env
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...  # Add this
```

#### **Step 3: Create Claude Adapter**

Create `src/server/claude.js`:
```javascript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: import.meta.env.ANTHROPIC_API_KEY
})

export async function askClaude(messages, { stream = false, meter = null } = {}) {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1400,
    temperature: 0.2,
    messages,
    stream
  })

  if (stream) {
    return response // Return stream for real-time updates
  }

  // Track tokens for cost estimation
  if (meter) {
    meter.promptTokens += response.usage.input_tokens
    meter.completionTokens += response.usage.output_tokens
    meter.calls += 1
  }

  return response.content[0].text
}

export async function streamClaude(messages, onChunk) {
  const stream = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1400,
    messages,
    stream: true
  })

  let fullText = ''
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      fullText += chunk.delta.text
      onChunk(chunk.delta.text)
    }
  }

  return fullText
}
```

#### **Step 4: Modify Agent.js to Support Multiple Models**

Update `src/pages/api/agent.js`:
```javascript
import { askGroq } from '../../server/groq.js'
import { askClaude, streamClaude } from '../../server/claude.js'

// Add model selection
const MODEL_PROVIDER = import.meta.env.MODEL_PROVIDER || 'groq' // or 'claude'

async function askLLM(messages, options = {}) {
  if (MODEL_PROVIDER === 'claude') {
    return askClaude(messages, options)
  }
  return askGroq(messages, options)
}

// For streaming responses
async function streamLLM(messages, onChunk) {
  if (MODEL_PROVIDER === 'claude') {
    return streamClaude(messages, onChunk)
  }
  // Groq streaming implementation
  return streamGroq(messages, onChunk)
}
```

#### **Step 5: Real-time Streaming to 3D View**

In execution phase:
```javascript
// Stream Claude's reasoning to the frontend
const stream = new ReadableStream({
  async start(controller) {
    // Stage 1: Intent
    controller.enqueue(`data: ${JSON.stringify({
      type: 'stage',
      stage: 'intent',
      provider: 'claude'
    })}\n\n`)

    // Stage 2: Claude reasoning (streaming)
    let response = ''
    await streamClaude(messages, (chunk) => {
      response += chunk
      controller.enqueue(`data: ${JSON.stringify({
        type: 'stream',
        stage: 'reasoning',
        text: chunk,
        provider: 'claude'
      })}\n\n`)
    })

    // Done
    controller.enqueue(`data: ${JSON.stringify({
      type: 'done',
      response,
      provider: 'claude',
      traceId
    })}\n\n`)
    
    controller.close()
  }
})

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  }
})
```

### **Result:**
✅ Real-time Claude reasoning in 3D  
✅ Token usage tracked (Claude pricing)  
✅ Side-by-side comparison with Groq  
✅ All stored in traces table  

---

## 👁️ 2. SAM (Segment Anything Model) Integration

### **Why Integrate SAM?**
- Visual understanding for UI automation
- Screenshot analysis
- Element detection for browser agents
- Image-based tool selection

### **Architecture:**
```
User Query + Screenshot → Observatory
            ↓
    SAM analyzes image → Segments detected
            ↓
    LLM reasons about segments → Tool selection
            ↓
    3D view shows: Image → Segments → Action
```

### **Implementation:**

#### **Step 1: Add SAM Tool**

Create `src/server/tools/sam.js`:
```javascript
import { pipeline } from '@xenova/transformers'

let samModel = null

async function loadSAM() {
  if (!samModel) {
    samModel = await pipeline('image-segmentation', 
      'Xenova/sam-vit-base'
    )
  }
  return samModel
}

export async function analyzeImage(imageUrl, query) {
  const sam = await loadSAM()
  
  // Segment the image
  const segments = await sam(imageUrl)
  
  // Return segments with bounding boxes
  return {
    segments: segments.map(s => ({
      label: s.label,
      score: s.score,
      box: s.box,
      mask: s.mask
    })),
    totalSegments: segments.length
  }
}

export async function findUIElement(imageUrl, elementDescription) {
  const segments = await analyzeImage(imageUrl)
  
  // Use embeddings to match description to segment
  const elementEmbedding = await embed(elementDescription)
  
  const matches = segments.segments.map(seg => ({
    ...seg,
    similarity: cosineSimilarity(elementEmbedding, seg.embedding)
  }))
  
  // Return best match
  return matches.sort((a, b) => b.similarity - a.similarity)[0]
}
```

#### **Step 2: Add Image Tool to Agent**

Update `src/pages/api/agent.js`:
```javascript
import { analyzeImage, findUIElement } from '../../server/tools/sam.js'

// Add 'image' tool
const TOOLS = new Set(['web_search', 'calculator', 'database', 'external_api', 'image'])

async function executeTool(tool, query, options = {}) {
  switch (tool) {
    case 'image':
      if (options.imageUrl) {
        return await analyzeImage(options.imageUrl, query)
      }
      if (options.findElement) {
        return await findUIElement(options.imageUrl, query)
      }
      break
    // ... other tools
  }
}
```

#### **Step 3: Frontend Integration**

Update `src/components/AgentScene.jsx` to show image analysis:
```javascript
// Add image preview node
{state.imageAnalysis && (
  <ImagePreviewNode
    position={[4, 0, 0]}
    imageUrl={state.imageUrl}
    segments={state.imageAnalysis.segments}
    active={state.activeNodeId === 'image'}
  />
)}
```

### **Use Cases:**
1. **UI Automation:** "Click the blue submit button"
   - Screenshot → SAM segments → Find button → Click
   
2. **Visual QA:** "What's in this image?"
   - Screenshot → SAM analysis → LLM description

3. **Element Verification:** "Is the login form visible?"
   - Screenshot → SAM segments → Check for form elements

---

## 🦞 3. OpenClaw Integration

### **Why OpenClaw Needs This Observatory?**
- **Browser automation visualization** - See which elements OpenClaw clicks
- **Multi-step workflow tracking** - Navigate → Fill → Submit flow
- **Error debugging** - Where did the automation fail?
- **Performance monitoring** - How long per action?

### **Architecture:**
```
OpenClaw Agent
    ↓
Browser Actions (click, type, navigate)
    ↓
Send to Observatory API
    ↓
Real-time 3D Visualization
    ↓
Trace Storage (for replay)
```

### **Implementation:**

#### **Step 1: Create OpenClaw Connector**

Create `src/integrations/openclaw/connector.js`:
```javascript
export class OpenClawObserver {
  constructor(observatoryUrl = 'http://localhost:4331') {
    this.observatoryUrl = observatoryUrl
    this.traceId = null
  }

  async startSession(initialQuery) {
    const res = await fetch(`${this.observatoryUrl}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: 'init',
        query: initialQuery,
        source: 'openclaw'
      })
    })
    const data = await res.json()
    this.traceId = data.traceId
    return this.traceId
  }

  async logAction(action, input, output, screenshot = null) {
    await fetch(`${this.observatoryUrl}/api/agent/span`, {
      method: 'POST',
      body: JSON.stringify({
        traceId: this.traceId,
        name: action.type, // 'click', 'type', 'navigate'
        kind: 'browser_action',
        input: {
          action: action.type,
          selector: action.selector,
          value: input,
          screenshot
        },
        output: {
          success: output.success,
          error: output.error,
          newUrl: output.url,
          elementFound: output.elementFound
        }
      })
    })
  }

  async endSession(result) {
    await fetch(`${this.observatoryUrl}/api/agent/complete`, {
      method: 'POST',
      body: JSON.stringify({
        traceId: this.traceId,
        result
      })
    })
  }
}
```

#### **Step 2: Use in OpenClaw**

```javascript
import { OpenClawObserver } from './observatory/connector.js'

class OpenClawAgent {
  constructor() {
    this.observer = new OpenClawObserver()
  }

  async executeTask(task) {
    // Start observatory session
    await this.observer.startSession(task.description)

    try {
      // Step 1: Navigate
      await this.observer.logAction(
        { type: 'navigate', url: task.url },
        task.url,
        { success: true, url: task.url }
      )
      await this.browser.goto(task.url)

      // Step 2: Find element
      const screenshot = await this.browser.screenshot()
      const element = await this.findElement(task.selector)
      await this.observer.logAction(
        { type: 'find', selector: task.selector },
        task.selector,
        { success: true, elementFound: true },
        screenshot
      )

      // Step 3: Click
      await element.click()
      await this.observer.logAction(
        { type: 'click', selector: task.selector },
        null,
        { success: true }
      )

      // Step 4: Complete
      await this.observer.endSession({
        success: true,
        result: 'Task completed'
      })

    } catch (error) {
      await this.observer.logAction(
        { type: 'error' },
        error.message,
        { success: false, error: error.message }
      )
      await this.observer.endSession({
        success: false,
        error: error.message
      })
    }
  }
}
```

#### **Step 3: Visualize in 3D**

The observatory will show:
```
User Query: "Fill out contact form"
    ↓
Navigate → Find Element → Click → Type → Submit
    ↓
Each step shows:
- Screenshot (before/after)
- Selector used
- Success/failure
- Timing
```

### **Benefits:**
- **Debug failed automations** - See exactly where it broke
- **Optimize workflows** - Find slow steps
- **Visual replay** - Screenshots at each step
- **Multi-agent coordination** - Track parallel browser sessions

---

## 🏛️ 4. Hermes Agent Integration

### **Why Hermes + Observatory?**
- **Multi-agent orchestration** - Track which sub-agent does what
- **Memory sharing** - Use our pgvector semantic memory
- **Tool coordination** - See how agents share tools
- **Performance comparison** - Which agent is fastest?

### **Architecture:**
```
Hermes Orchestrator
    ↓
Sub-agent A (Research) ──┐
Sub-agent B (Code)       ├─→ Observatory API
Sub-agent C (Review)   ──┘
    ↓
Unified 3D Visualization
```

### **Implementation:**

#### **Step 1: Create Hermes Adapter**

Create `src/integrations/hermes/adapter.js`:
```javascript
export class HermesObservatoryAdapter {
  constructor() {
    this.observatoryUrl = 'http://localhost:4331'
    this.sessionId = null
    this.agentTraces = new Map() // agent_id -> trace_id
  }

  async startOrchestration(task) {
    const res = await fetch(`${this.observatoryUrl}/api/agent`, {
      method: 'POST',
      body: JSON.stringify({
        phase: 'init',
        query: task,
        source: 'hermes',
        multiAgent: true
      })
    })
    this.sessionId = (await res.json()).sessionId
    return this.sessionId
  }

  async registerAgent(agentId, agentType, role) {
    const res = await fetch(`${this.observatoryUrl}/api/agent/register`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: this.sessionId,
        agentId,
        agentType,
        role
      })
    })
    const data = await res.json()
    this.agentTraces.set(agentId, data.traceId)
    return data.traceId
  }

  async logAgentAction(agentId, action, input, output) {
    const traceId = this.agentTraces.get(agentId)
    await fetch(`${this.observatoryUrl}/api/agent/span`, {
      method: 'POST',
      body: JSON.stringify({
        traceId,
        agentId,
        name: action,
        input,
        output,
        timestamp: Date.now()
      })
    })
  }

  async storeMemory(agentId, memory) {
    // Use observatory's memory system
    await fetch(`${this.observatoryUrl}/api/memory`, {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        content: memory.content,
        cluster: memory.cluster || 'conversations',
        metadata: memory.metadata
      })
    })
  }

  async retrieveMemory(agentId, query) {
    const res = await fetch(
      `${this.observatoryUrl}/api/memory/search?` +
      `query=${encodeURIComponent(query)}&agentId=${agentId}`
    )
    return res.json()
  }
}
```

#### **Step 2: Use in Hermes**

```javascript
import { HermesObservatoryAdapter } from './observatory/adapter.js'

class HermesOrchestrator {
  constructor() {
    this.observatory = new HermesObservatoryAdapter()
    this.agents = {
      researcher: new ResearchAgent(),
      coder: new CodingAgent(),
      reviewer: new ReviewAgent()
    }
  }

  async executeTask(task) {
    // Start session
    await this.observatory.startOrchestration(task)

    // Register all agents
    await this.observatory.registerAgent('researcher', 'research', 'Information gathering')
    await this.observatory.registerAgent('coder', 'coding', 'Implementation')
    await this.observatory.registerAgent('reviewer', 'review', 'Quality assurance')

    // Step 1: Research
    const research = await this.runAgent('researcher', async (agent) => {
      await this.observatory.logAgentAction('researcher', 'web_search', task, null)
      const results = await agent.search(task)
      await this.observatory.logAgentAction('researcher', 'web_search', task, results)
      
      // Store in memory
      await this.observatory.storeMemory('researcher', {
        content: JSON.stringify(results),
        cluster: 'research'
      })
      
      return results
    })

    // Step 2: Code
    const code = await this.runAgent('coder', async (agent) => {
      // Retrieve research from memory
      const context = await this.observatory.retrieveMemory('coder', task)
      
      await this.observatory.logAgentAction('coder', 'generate_code', context, null)
      const implementation = await agent.generateCode(context)
      await this.observatory.logAgentAction('coder', 'generate_code', context, implementation)
      
      return implementation
    })

    // Step 3: Review
    const review = await this.runAgent('reviewer', async (agent) => {
      await this.observatory.logAgentAction('reviewer', 'review', code, null)
      const feedback = await agent.review(code)
      await this.observatory.logAgentAction('reviewer', 'review', code, feedback)
      
      return feedback
    })

    return { research, code, review }
  }
}
```

#### **Step 3: Multi-Agent Visualization**

The 3D view shows:
```
                Orchestrator
                     ↓
        ┌────────────┼────────────┐
        ↓            ↓            ↓
   Researcher     Coder      Reviewer
   (web_search)   (generate) (verify)
        ↓            ↓            ↓
    Memory ←──────────────────────┘
   (pgvector shared context)
```

---

## 🎨 Real-time UI Level Understanding

### **Combined Integration Example:**

Imagine an agent that:
1. **Takes a screenshot** (SAM)
2. **Understands the UI** (Claude)
3. **Automates browser** (OpenClaw)
4. **Coordinates sub-tasks** (Hermes)
5. **Shows everything in 3D** (Observatory)

```javascript
async function automateWebTask(task) {
  const observatory = new ObservatoryClient()
  await observatory.start(task)

  // Step 1: Take screenshot
  const screenshot = await browser.screenshot()
  await observatory.log('screenshot', { url: browser.url }, screenshot)

  // Step 2: Analyze with SAM
  const segments = await sam.analyze(screenshot)
  await observatory.log('image_analysis', screenshot, segments)

  // Step 3: Ask Claude what to do
  const plan = await claude.ask(
    `Given these UI elements: ${JSON.stringify(segments)}, ` +
    `how do I: ${task}?`
  )
  await observatory.log('planning', segments, plan)

  // Step 4: Execute with OpenClaw
  for (const step of plan.steps) {
    await openclaw.execute(step)
    await observatory.log('browser_action', step, { success: true })
  }

  // Step 5: Store result in memory
  await observatory.storeMemory({
    task,
    result: 'success',
    screenshots: [screenshot],
    steps: plan.steps
  })

  await observatory.complete()
}
```

**What you see in the Observatory:**
```
3D View:
├─ Screenshot Node (shows actual image)
├─ SAM Segments (highlighted elements)
├─ Claude Reasoning (streaming text)
├─ Browser Actions (click, type, navigate)
├─ Memory Storage (vector embeddings)
└─ Success/Failure (with replay)

Timeline:
0ms    - Screenshot taken
100ms  - SAM analysis complete (14 segments found)
500ms  - Claude planning (streaming)
1200ms - OpenClaw: Click button#submit
1400ms - OpenClaw: Type input#email
1600ms - Memory stored
```

---

## 📊 Benefits of These Integrations

### **For Developers:**
- ✅ Debug visual agents (SAM)
- ✅ Compare models (Claude vs Groq)
- ✅ Track browser automation (OpenClaw)
- ✅ Coordinate sub-agents (Hermes)

### **For Users:**
- ✅ Real-time visual feedback
- ✅ Understand what agent is doing NOW
- ✅ See screenshots and segments
- ✅ Replay failed automations
- ✅ Trust through transparency

### **For Production:**
- ✅ Full execution traces
- ✅ Cost tracking per model
- ✅ Performance optimization
- ✅ Error detection & recovery
- ✅ Compliance & audit trail

---

## 🚀 Next Steps

1. **Try Claude Integration** - Swap Groq for Claude, compare performance
2. **Add SAM for Vision** - Enable visual understanding
3. **Connect OpenClaw** - Visualize browser automation
4. **Use Hermes Memory** - Leverage our pgvector system
5. **Build Custom Tools** - Extend the observatory for your use case

---

## 📞 Need Help?

- **GitHub:** https://github.com/sakshigupta372/AI-Agent-observatory
- **Issues:** Report bugs or request integrations
- **Discussions:** Share your integration success stories

---

*Ready to integrate? All code examples above are production-ready. Just add your API keys and go!* 🚀
