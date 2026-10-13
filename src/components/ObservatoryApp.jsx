import ErrorBoundary from './ErrorBoundary.jsx'
import AgentScene from './AgentScene.jsx'

export default function ObservatoryApp() {
  return (
    <ErrorBoundary>
      <AgentScene />
    </ErrorBoundary>
  )
}
