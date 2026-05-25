import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="min-h-dvh flex flex-col items-center justify-center gap-4 p-8 text-center"
          style={{ background: 'var(--bg, #070A12)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-2"
            style={{ background: 'rgba(255,92,122,0.15)', border: '1px solid rgba(255,92,122,0.3)' }}
          >
            ⚠️
          </div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text, #fff)' }}>
            Algo deu errado
          </h1>
          <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>
            Ocorreu um erro inesperado. Recarregue a página — se o problema
            persistir, entre em contato com o suporte.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent, #35D07F)', color: '#070A12' }}
          >
            Recarregar página
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
