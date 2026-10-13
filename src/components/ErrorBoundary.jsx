import { Component } from 'react'

// Keeps a single render exception (e.g. a 3D node thrown outside the Canvas)
// from unmounting the whole app and leaving a blank screen. Shows the error
// and offers a reload instead.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('AgentScene crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash-screen">
          <div className="crash-card">
            <span className="crash-kicker">SOMETHING BROKE</span>
            <p className="crash-message">{this.state.error.message || 'An unexpected error occurred.'}</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
