import * as React from "react";

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    const state = (this as any).state;
    const props = (this as any).props;

    if (state.hasError) {
      return (
        <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <h2 className="text-2xl font-bold tracking-tighter text-red-600 mb-4">SYSTEM_CRITICAL_ERROR</h2>
            <div className="bg-[#F5F5F3] border border-[#141414] p-4 mb-6 font-mono text-xs overflow-auto max-h-40">
              {state.error?.message || "An unexpected error occurred."}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#141414] text-white font-bold hover:bg-opacity-90 transition-all"
            >
              REBOOT_SYSTEM
            </button>
          </div>
        </div>
      );
    }

    return props.children;
  }
}
