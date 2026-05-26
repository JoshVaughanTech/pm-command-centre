'use client';

import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  override render() {
    if (this.state.hasError) {
      return <ErrorDisplay message={this.state.message} />;
    }
    return this.props.children;
  }
}

// --------------------------------------------------------------------------
// Presentational component — kept separate so it can be read without needing
// a class component mental model.
// --------------------------------------------------------------------------

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div
      className="err-root"
      style={{
        minHeight: '100dvh',
        background: 'var(--tl-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div
        className="err-card"
        style={{
          background: 'var(--tl-surface)',
          border: '1px solid var(--tl-line)',
          borderRadius: '8px',
          padding: '40px 44px',
          maxWidth: '520px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Brand mark */}
        <div
          className="err-brand"
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--tl-text-2)',
          }}
        >
          SNTRI
        </div>

        {/* Heading */}
        <h1
          className="err-heading"
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--tl-text)',
            lineHeight: 1.3,
          }}
        >
          Something went wrong
        </h1>

        {/* Error message */}
        <pre
          className="err-message"
          style={{
            margin: 0,
            padding: '14px 16px',
            background: 'var(--tl-bg)',
            border: '1px solid var(--tl-line)',
            borderLeft: '3px solid var(--tl-bad)',
            borderRadius: '4px',
            fontFamily: 'var(--tl-mono, monospace)',
            fontSize: '12px',
            color: 'var(--tl-bad)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}
        >
          {message}
        </pre>

        {/* Reload button */}
        <div className="err-actions">
          <button
            className="err-reload"
            type="button"
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 20px',
              background: 'transparent',
              border: '1px solid var(--tl-line)',
              borderRadius: '4px',
              color: 'var(--tl-text)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--tl-text-2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--tl-line)';
            }}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
