'use client';

import Link from 'next/link';

const FEATURES = [
  {
    title: 'AI Agent',
    desc: 'An AI that knows your projects and takes action — sends emails, updates health, logs risks',
  },
  {
    title: 'Import Projects',
    desc: 'Connect Smartsheet, Asana, Monday.com, or upload CSV from MS Project',
  },
  {
    title: 'Client Portal',
    desc: 'Share a password-protected project view with clients — status, milestones, messaging',
  },
  {
    title: 'Email Integration',
    desc: 'Connect Microsoft 365 or Gmail — inbox signals auto-linked to projects',
  },
  {
    title: 'Team Workspaces',
    desc: 'Invite your team, share projects, manage with role-based access',
  },
  {
    title: 'Smart Dashboard',
    desc: 'Drag, resize, and customise panels — dark mode, saved views, mobile responsive',
  },
] as const;

export default function LandingPage() {
  return (
    <div className="land-root">
      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="land-nav">
        <div className="land-nav-inner">
          <span className="land-brand-mark">SNTRI</span>
          <div className="land-nav-actions">
            <Link href="/auth/signin" className="land-btn-ghost">
              Sign in
            </Link>
            <Link href="/auth/signup" className="land-btn-primary">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="land-hero">
        <div className="land-hero-inner">
          <p className="land-hero-eyebrow">Project management, reimagined</p>
          <h1 className="land-hero-headline">
            Your projects, risks, and clients —{' '}
            <span className="land-hero-headline-em">one command centre</span>
          </h1>
          <p className="land-hero-sub">
            SNTRI gives project managers a single dashboard with AI-powered recommendations,
            real-time integrations, and client portals.
          </p>
          <div className="land-hero-ctas">
            <Link href="/auth/signup" className="land-btn-primary land-btn-lg">
              Get started free
            </Link>
            <Link href="/auth/signin" className="land-btn-ghost land-btn-lg">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="land-features">
        <div className="land-features-inner">
          <div className="land-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="land-feature-card">
                <div className="land-feature-title">{f.title}</div>
                <p className="land-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="land-footer">
        <div className="land-footer-inner">
          <span className="land-footer-copy">Built for project managers</span>
          <span className="land-brand-mark land-brand-mark--sm">SNTRI</span>
        </div>
      </footer>

      <style>{`
        .land-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--tl-bg);
          color: var(--tl-text);
          font-family: var(--tl-sans);
        }

        /* ── nav ── */
        .land-nav {
          position: sticky;
          top: 0;
          z-index: 30;
          border-bottom: 1px solid var(--tl-line);
          background: var(--tl-surface);
        }

        .land-nav-inner {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 24px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .land-brand-mark {
          font-family: var(--tl-mono);
          font-size: 11px;
          font-weight: 600;
          background: var(--tl-ink);
          color: var(--tl-bg);
          padding: 2px 5px;
          border-radius: 3px;
          letter-spacing: 0.02em;
        }

        .land-brand-mark--sm {
          font-size: 10px;
        }

        .land-nav-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── buttons ── */
        .land-btn-primary {
          display: inline-flex;
          align-items: center;
          padding: 6px 14px;
          background: var(--tl-ink);
          color: var(--tl-bg);
          border: 1px solid var(--tl-ink);
          border-radius: 5px;
          font-family: var(--tl-sans);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          letter-spacing: -0.003em;
          white-space: nowrap;
        }

        .land-btn-primary:hover {
          opacity: 0.9;
        }

        .land-btn-ghost {
          display: inline-flex;
          align-items: center;
          padding: 6px 14px;
          background: transparent;
          color: var(--tl-text-2);
          border: 1px solid var(--tl-line);
          border-radius: 5px;
          font-family: var(--tl-sans);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          letter-spacing: -0.003em;
          white-space: nowrap;
        }

        .land-btn-ghost:hover {
          background: var(--tl-surface-alt);
          color: var(--tl-text);
          border-color: var(--tl-line-strong);
        }

        .land-btn-lg {
          padding: 10px 22px;
          font-size: 14px;
        }

        /* ── hero ── */
        .land-hero {
          flex: 1;
          border-bottom: 1px solid var(--tl-line);
        }

        .land-hero-inner {
          max-width: 720px;
          margin: 0 auto;
          padding: 80px 24px 88px;
        }

        .land-hero-eyebrow {
          font-family: var(--tl-mono);
          font-size: 11px;
          color: var(--tl-text-3);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0 0 20px;
        }

        .land-hero-headline {
          font-size: 42px;
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 1.12;
          margin: 0 0 22px;
          color: var(--tl-text);
          text-wrap: balance;
        }

        .land-hero-headline-em {
          color: var(--tl-text-3);
        }

        .land-hero-sub {
          font-size: 16px;
          line-height: 1.6;
          color: var(--tl-text-2);
          margin: 0 0 36px;
          max-width: 560px;
          text-wrap: pretty;
          letter-spacing: -0.005em;
        }

        .land-hero-ctas {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* ── features ── */
        .land-features {
          background: var(--tl-surface);
          border-bottom: 1px solid var(--tl-line);
        }

        .land-features-inner {
          max-width: 1080px;
          margin: 0 auto;
          padding: 64px 24px;
        }

        .land-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--tl-line);
          border: 1px solid var(--tl-line);
          border-radius: 8px;
          overflow: hidden;
        }

        .land-feature-card {
          background: var(--tl-surface);
          padding: 24px 22px;
        }

        .land-feature-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.01em;
          margin-bottom: 6px;
          color: var(--tl-text);
        }

        .land-feature-desc {
          font-size: 12.5px;
          color: var(--tl-text-3);
          line-height: 1.55;
          margin: 0;
          text-wrap: pretty;
        }

        /* ── footer ── */
        .land-footer {
          background: var(--tl-surface);
          border-top: 1px solid var(--tl-line);
        }

        .land-footer-inner {
          max-width: 1080px;
          margin: 0 auto;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .land-footer-copy {
          font-family: var(--tl-mono);
          font-size: 11px;
          color: var(--tl-text-4);
        }

        /* ── responsive ── */
        @media (max-width: 900px) {
          .land-features-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .land-hero-headline {
            font-size: 32px;
          }
        }

        @media (max-width: 600px) {
          .land-features-grid {
            grid-template-columns: 1fr;
          }

          .land-hero-inner {
            padding: 52px 16px 60px;
          }

          .land-hero-headline {
            font-size: 26px;
          }

          .land-hero-sub {
            font-size: 14px;
          }

          .land-features-inner {
            padding: 40px 16px;
          }

          .land-nav-inner {
            padding: 0 16px;
          }

          .land-footer-inner {
            padding: 16px;
          }

          .land-btn-lg {
            padding: 9px 18px;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
