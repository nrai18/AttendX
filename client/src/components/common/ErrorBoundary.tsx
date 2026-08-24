import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground text-center">
          <h2 className="text-xl font-bold text-rose-500 mb-2">Something went wrong</h2>
          <pre className="text-xs bg-muted p-4 rounded-xl max-w-full overflow-auto text-left whitespace-pre-wrap text-rose-400">
            {this.state.error?.message}
          </pre>
          <button 
            className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold"
            onClick={() => window.location.href = "/?reloaded=1"}
          >
            Restart App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
