import { useState, useEffect } from 'react'

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to AI Agent Observatory! 🚀',
    description: 'Watch your AI agent execute in real-time with 3D visualization. Let me show you around.',
    position: 'center',
    highlight: null
  },
  {
    id: 'query',
    title: 'Enter Your Query Here',
    description: 'Type what you want the agent to do. Try: "What is 25 times 17?" or "Latest AI news"',
    position: 'bottom',
    highlight: '.run-console'
  },
  {
    id: 'nodes',
    title: '3D Execution Flow',
    description: 'Watch the agent move through stages: Intent → Tool → Memory → Reasoning → Verify. Active nodes light up!',
    position: 'center',
    highlight: null
  },
  {
    id: 'tools',
    title: 'Available Tools',
    description: 'The agent picks: Web Search, Calculator, Database, or External API based on your query.',
    position: 'right',
    highlight: null
  },
  {
    id: 'response',
    title: 'Response Panel',
    description: 'Your answer appears here with sources, confidence score, and verification status.',
    position: 'bottom-right',
    highlight: '.response-panel'
  },
  {
    id: 'controls',
    title: 'Camera Controls',
    description: 'Left-click drag: rotate | Right-click drag: pan | Scroll: zoom | Double-click: reset',
    position: 'center',
    highlight: null
  },
  {
    id: 'done',
    title: 'You\'re All Set! 🎉',
    description: 'Press SPACE to run, ESC to stop, R to replay. Click "Show Tutorial" anytime to see this again.',
    position: 'center',
    highlight: null
  }
]

export default function TutorialOverlay({ onComplete }) {
  const [step, setStep] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Check if user has seen tutorial
    const hasSeenTutorial = localStorage.getItem('observatory_tutorial_seen')
    if (!hasSeenTutorial) {
      setTimeout(() => setShow(true), 1000)
    }
  }, [])

  const handleNext = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleComplete()
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleComplete = () => {
    localStorage.setItem('observatory_tutorial_seen', 'true')
    setShow(false)
    if (onComplete) onComplete()
  }

  if (!show) return null

  const currentStep = TUTORIAL_STEPS[step]
  const progress = ((step + 1) / TUTORIAL_STEPS.length) * 100

  return (
    <>
      {/* Backdrop */}
      <div className="tutorial-backdrop" onClick={handleSkip} />
      
      {/* Tutorial Card */}
      <div className={`tutorial-card tutorial-${currentStep.position}`}>
        <div className="tutorial-progress">
          <div className="tutorial-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        
        <div className="tutorial-content">
          <h2>{currentStep.title}</h2>
          <p>{currentStep.description}</p>
          
          <div className="tutorial-footer">
            <span className="tutorial-step-count">
              {step + 1} of {TUTORIAL_STEPS.length}
            </span>
            
            <div className="tutorial-actions">
              <button 
                type="button" 
                className="tutorial-skip" 
                onClick={handleSkip}
              >
                Skip
              </button>
              <button 
                type="button" 
                className="tutorial-next" 
                onClick={handleNext}
              >
                {step < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Got it!'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Highlight element if specified */}
      {currentStep.highlight && (
        <style>{`
          ${currentStep.highlight} {
            position: relative;
            z-index: 10001 !important;
            box-shadow: 0 0 0 4px rgba(127, 217, 255, 0.4), 
                        0 0 40px rgba(127, 217, 255, 0.6) !important;
            animation: tutorialPulse 2s ease-in-out infinite;
          }
          
          @keyframes tutorialPulse {
            0%, 100% { box-shadow: 0 0 0 4px rgba(127, 217, 255, 0.4), 0 0 40px rgba(127, 217, 255, 0.6); }
            50% { box-shadow: 0 0 0 8px rgba(127, 217, 255, 0.6), 0 0 60px rgba(127, 217, 255, 0.8); }
          }
        `}</style>
      )}
    </>
  )
}
