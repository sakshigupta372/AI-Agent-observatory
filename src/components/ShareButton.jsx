import { useState } from 'react'

export default function ShareButton({ traceId, query, disabled, isOpen, onOpenChange }) {
  const [copied, setCopied] = useState(false)

  const generateShareUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/?trace=${traceId}`
  }

  const handleShare = () => {
    if (!traceId) return
    onOpenChange(true)
    setCopied(false)
  }

  const handleCopy = async () => {
    const url = generateShareUrl()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShareNative = async () => {
    const url = generateShareUrl()
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AI Agent Observatory Run',
          text: `Check out this agent execution: ${query}`,
          url
        })
      } catch (err) {
        console.log('Share cancelled')
      }
    }
  }

  const handleShareTwitter = () => {
    const url = generateShareUrl()
    const text = `Check out this AI agent execution: ${query}`
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=400'
    )
  }

  const handleShareLinkedIn = () => {
    const url = generateShareUrl()
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=600'
    )
  }

  return (
    <>
      <button
        type="button"
        className="share-button"
        onClick={handleShare}
        disabled={disabled || !traceId}
        title="Share this run (S)"
      >
        🔗 Share
      </button>

      {isOpen && (
        <div className="share-modal-overlay" onClick={() => onOpenChange(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-header">
              <h3>Share This Run</h3>
              <button onClick={() => onOpenChange(false)}>✕</button>
            </div>

            <div className="share-content">
              <p className="share-query">"{query}"</p>
              
              <div className="share-url-box">
                <input
                  type="text"
                  value={generateShareUrl()}
                  readOnly
                  onClick={(e) => e.target.select()}
                />
                <button onClick={handleCopy} className={copied ? 'copied' : ''}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>

              <div className="share-social">
                <button onClick={handleShareTwitter} className="share-twitter">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Twitter
                </button>
                <button onClick={handleShareLinkedIn} className="share-linkedin">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                  </svg>
                  LinkedIn
                </button>
                {navigator.share && (
                  <button onClick={handleShareNative} className="share-native">
                    📱 More...
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
