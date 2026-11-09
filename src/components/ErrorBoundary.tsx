import { Component, ErrorInfo, ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen w-full flex items-center justify-center p-6 bg-zinc-950 text-zinc-100"
        >
          <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-zinc-900/90 border border-rose-500/30 shadow-2xl shadow-rose-950/40 text-center space-y-5 animate-fade-in">
            <div
              aria-hidden="true"
              className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-3xl shadow-inner shadow-rose-500/20"
            >
              ⚠️
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Arena Glitch Encountered
              </h1>
              <p className="text-sm text-zinc-400">
                Something unexpected occurred in the arcade runtime. Your saved stats and settings remain intact.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-left overflow-x-auto">
                <p className="text-xs font-mono text-rose-400 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-sm transition shadow-lg shadow-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-sm transition border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Back to Hub
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
