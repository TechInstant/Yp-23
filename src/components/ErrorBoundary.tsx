import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Last line of defence against a blank white page. Without this, any throw
 * during render unmounts the whole tree and leaves the user staring at nothing,
 * with the only clue buried in the browser console.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the attendance portal:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4">
          <h1 className="text-lg font-semibold text-red-800">Something broke on this page</h1>
          <p className="mt-2 text-sm text-red-800">
            The rest of the portal is fine — reload, or go back to the home page.
          </p>
          <pre className="mt-4 overflow-x-auto rounded bg-white/70 p-3 text-xs text-red-900">
            {error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <a href="/" className="btn-ghost">
              Home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
