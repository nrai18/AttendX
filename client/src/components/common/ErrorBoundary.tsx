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

  private errorLog: any[] = [];
  private originalConsoleError = console.error;

  componentDidMount() {
    console.error = (...args: any[]) => {
      this.errorLog.push({ timestamp: new Date().toISOString(), args: args.map(a => a?.toString ? a.toString() : String(a)) });
      if (this.errorLog.length > 50) this.errorLog.shift(); // Keep last 50
      this.originalConsoleError.apply(console, args);
    };
  }

  componentWillUnmount() {
    console.error = this.originalConsoleError;
  }

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
        <div className="flex flex-col items-center justify-center min-h-screen p-6 md:p-12 bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-50 text-center font-sans antialiased">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-[#E63946] mb-8 leading-none">
            Something went wrong
          </h2>
          <pre className="text-xs bg-white dark:bg-[#111111] border-2 border-black dark:border-[#333333] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#222222] p-6 max-w-2xl w-full overflow-auto text-left whitespace-pre-wrap font-mono text-[#E63946]">
            {this.state.error?.message}
          </pre>
          <div className="flex flex-col md:flex-row gap-4 mt-8 w-full max-w-2xl justify-center">
            <button
              className="px-6 py-4 bg-[#E63946] text-white border-2 border-black dark:border-[#222222] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#111111] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_#111111] font-black uppercase tracking-widest text-xs transition-all w-full md:w-auto"
              onClick={() => this.setState({ isFeedbackOpen: true })}
            >
              Report Issue
            </button>
            <button
              className="px-6 py-4 bg-[#48CAE4] text-[#050505] border-2 border-black dark:border-[#222222] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#111111] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_#111111] font-black uppercase tracking-widest text-xs transition-all w-full md:w-auto"
              onClick={() => (window.location.href = "/?reloaded=1")}
            >
              Restart App
            </button>
          </div>
          <FeedbackModal
            isOpen={this.state.isFeedbackOpen}
            onClose={() => this.setState({ isFeedbackOpen: false })}
            defaultIssue="UI Bug"
            errorDetails={{
              consoleErrors: this.errorLog,
              message: this.state.error?.message,
              name: this.state.error?.name,
              stack: this.state.error?.stack
            }}
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
