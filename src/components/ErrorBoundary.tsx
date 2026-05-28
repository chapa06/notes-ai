import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border p-8 rounded-2xl shadow-xl">
            <h2 className="text-2xl font-bold tracking-tighter text-danger mb-4">SYSTEM_CRITICAL_ERROR</h2>
            <div className="bg-surface border border-border p-4 mb-6 font-mono text-xs overflow-auto max-h-40 rounded-xl">
              {this.state.error?.message || "An unexpected error occurred."}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all"
            >
              REBOOT_SYSTEM
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}