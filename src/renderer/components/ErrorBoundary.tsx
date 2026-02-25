import React from 'react'

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('React error boundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: 16, color: 'var(--text-primary)', background: 'var(--bg-primary)',
          padding: 32,
        }}>
          <div style={{ fontSize: 48 }}>Something went wrong</div>
          <pre style={{
            maxWidth: '80%', overflow: 'auto', padding: 16, borderRadius: 8,
            background: 'var(--bg-secondary)', fontSize: 13, color: 'var(--text-secondary)',
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px', borderRadius: 6, background: 'var(--accent)',
              color: 'var(--bg-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              border: 'none',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
