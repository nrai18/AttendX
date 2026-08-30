import React, { Component, ErrorInfo, ReactNode } from "react";
import { FeedbackModal } from "../support/FeedbackModal";
import { Toaster } from "sonner";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isFeedbackOpen: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isFeedbackOpen: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isFeedbackOpen: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground text-center">
          <h2 className="text-xl font-bold text-rose-500 mb-2">
            Something went wrong
          </h2>
          <pre className="text-xs bg-muted p-4 rounded-xl max-w-full overflow-auto text-left whitespace-pre-wrap text-rose-400">
            {this.state.error?.message}
          </pre>
          <div className="flex gap-4 mt-6">
            <button
              className="px-6 py-2 bg-muted text-foreground rounded-xl font-bold hover:bg-muted/80"
              onClick={() => this.setState({ isFeedbackOpen: true })}
            >
              Report Issue
            </button>
            <button
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
              onClick={() => (window.location.href = "/?reloaded=1")}
            >
              Restart App
            </button>
          </div>
          <FeedbackModal
            isOpen={this.state.isFeedbackOpen}
            onClose={() => this.setState({ isFeedbackOpen: false })}
            defaultIssue="UI Bug"
          />
          <Toaster 
            position="top-center" 
            theme="dark"
            duration={2500} 
            toastOptions={{ className: "rounded-xl border border-border shadow-lg" }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
