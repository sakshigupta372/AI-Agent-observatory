import { MessageSquare, Route, Search, PenLine, ShieldCheck, CircleCheck, ListChecks, Layers, Scale, BarChart3, MousePointerClick, AlignLeft, TriangleAlert } from 'lucide-react'

// The agent's pipeline as the visitor sees it, with the one way back.
export const AGENT_FLOW = {
  label: 'How the agent answers: question, plan, search, write, fact-check, answer, with a retry from fact-check back to plan',
  steps: [
    { id: 'ask', title: 'Question', note: 'You ask', Icon: MessageSquare },
    { id: 'plan', title: 'Plan', note: 'Picks a tool', Icon: Route },
    { id: 'search', title: 'Search', note: 'Web, data or memory', Icon: Search },
    { id: 'write', title: 'Write', note: 'Drafts an answer', Icon: PenLine },
    { id: 'check', title: 'Fact-check', note: 'Checks each claim', Icon: ShieldCheck },
    { id: 'answer', title: 'Answer', note: 'Backed claims only', Icon: CircleCheck },
  ],
  loop: { from: 'check', to: 'plan', label: 'not backed? search again' },
}

// The four stages a planted failure can hit, for the demo cards.
export const DEMO_PATH = ['Plan', 'Search', 'Write', 'Check']

export const EVAL_FLOW = {
  label: 'How the test works: 25 questions, 3 setups, graded on facts, compared',
  steps: [
    { id: 'questions', title: '25 questions', note: 'Some with a planted failure', Icon: ListChecks },
    { id: 'setups', title: '3 setups', note: 'No check · check · check + retry', Icon: Layers },
    { id: 'grade', title: 'Grade', note: 'Expected facts, no planted ones', Icon: Scale },
    { id: 'compare', title: 'Compare', note: 'Success rate per setup', Icon: BarChart3 },
  ],
}

export const TRACE_FLOW = {
  label: 'How to read a trace: pick a run, read the steps, look for red',
  steps: [
    { id: 'pick', title: 'Pick a run', note: 'From the list', Icon: MousePointerClick },
    { id: 'read', title: 'Read the steps', note: 'Bars show when and how long', Icon: AlignLeft },
    { id: 'red', title: 'Look for red', note: 'A failed step or a retry', Icon: TriangleAlert },
  ],
}
