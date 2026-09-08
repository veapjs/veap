"use client";

import { warn } from "../../../infrastructure/logging";
import * as React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: number;
}

/**
 * Client-side error boundary for the Veap unstable router.
 *
 * Wraps route segments to catch rendering errors and display
 * a recoverable fallback UI. Supports custom fallback components
 * or renders a default error panel.
 *
 * Reset is implemented via internal key increment, which forces
 * React to remount the children subtree.
 */
export class RouterErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (process.env.NODE_ENV === "development") {
      warn(
        "veap:Router",
        "[UnstableErrorBoundary] Caught error during rendering:",
        error,
        errorInfo,
      );
    }
  }

  private reset = (): void => {
    this.setState((prev) => ({
      error: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  override render(): React.ReactNode {
    const { error, resetKey } = this.state;
    const { children, fallback: Fallback } = this.props;

    if (error !== null) {
      if (Fallback) {
        return <Fallback error={error} reset={this.reset} />;
      }

      return (
        <div
          role="alert"
          style={{
            padding: "2rem",
            borderRadius: "0.5rem",
            border: "1px solid #fca5a5",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1.125rem",
              fontWeight: 600,
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              margin: "0 0 1rem",
              fontSize: "0.875rem",
              color: "#b91c1c",
            }}
          >
            {error.message}
          </p>
          <button
            type="button"
            onClick={this.reset}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#ffffff",
              backgroundColor: "#dc2626",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return <React.Fragment key={resetKey}>{children}</React.Fragment>;
  }
}
