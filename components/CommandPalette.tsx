'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
};

type CommandPaletteProps = {
  projects: Array<Project>;
  onSelectProject: (id: string) => void;
  onAction: (action: string) => void;
  onClose: () => void;
};

type ResultItem =
  | { kind: 'project'; project: Project }
  | { kind: 'action'; id: string; label: string; hint: string };

const ACTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'new-project',       label: 'New project',        hint: 'Create a new project record'        },
  { id: 'log-risk',          label: 'Log risk',           hint: 'Add a risk to the active project'   },
  { id: 'generate-ai-moves', label: 'Generate AI moves',  hint: 'Run AI suggested next actions'      },
  { id: 'toggle-theme',      label: 'Toggle theme',       hint: 'Switch between light and dark mode' },
  { id: 'import-projects',   label: 'Import projects',    hint: 'Load projects from CSV or JSON'     },
];

export function CommandPalette({ projects, onSelectProject, onAction, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Build filtered results
  const results: ResultItem[] = (() => {
    const q = query.trim().toLowerCase();

    const matchedProjects = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q),
    );

    const matchedActions = ACTIONS.filter(
      (a) =>
        q === '' ||
        a.label.toLowerCase().includes(q) ||
        a.hint.toLowerCase().includes(q),
    );

    const items: ResultItem[] = [
      ...matchedProjects.map((p): ResultItem => ({ kind: 'project', project: p })),
      ...matchedActions.map((a): ResultItem => ({ kind: 'action', ...a })),
    ];

    return items;
  })();

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = results[activeIndex];
        if (!item) return;
        if (item.kind === 'project') {
          onSelectProject(item.project.id);
        } else {
          onAction(item.id);
        }
        onClose();
      }
    },
    [results, activeIndex, onSelectProject, onAction, onClose],
  );

  function handleItemClick(item: ResultItem) {
    if (item.kind === 'project') {
      onSelectProject(item.project.id);
    } else {
      onAction(item.id);
    }
    onClose();
  }

  // Separate into sections for rendering
  const projectItems = results.filter((r): r is Extract<ResultItem, { kind: 'project' }> => r.kind === 'project');
  const actionItems  = results.filter((r): r is Extract<ResultItem, { kind: 'action'  }> => r.kind === 'action');

  // Compute flat index offset for actions section
  const actionOffset = projectItems.length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0, 0, 0, 0.35)',
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: 'fixed',
          top: '18vh',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 201,
          width: '100%',
          maxWidth: 560,
          background: 'var(--tl-surface)',
          border: '1px solid var(--tl-line)',
          borderRadius: 8,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 0 0 1px var(--tl-line)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 14px',
            borderBottom: '1px solid var(--tl-line)',
          }}
        >
          {/* Search icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0, color: 'var(--tl-text-4)' }}
          >
            <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.25" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects or run a command…"
            aria-label="Command search"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              height: 46,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--tl-sans)',
              fontSize: 13.5,
              color: 'var(--tl-text)',
              caretColor: 'var(--tl-ink)',
            }}
          />

          {/* Escape hint */}
          <kbd
            style={{
              flexShrink: 0,
              fontFamily: 'var(--tl-mono)',
              fontSize: 10.5,
              color: 'var(--tl-text-4)',
              border: '1px solid var(--tl-line)',
              borderRadius: 4,
              padding: '2px 5px',
              lineHeight: 1.6,
              background: 'var(--tl-bg)',
              userSelect: 'none',
            }}
          >
            esc
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            maxHeight: 360,
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                fontFamily: 'var(--tl-mono)',
                fontSize: 12,
                color: 'var(--tl-text-4)',
              }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {/* Projects section */}
              {projectItems.length > 0 && (
                <div>
                  <SectionLabel>Projects</SectionLabel>
                  {projectItems.map((item, i) => {
                    const flatIndex = i;
                    return (
                      <ResultRow
                        key={item.project.id}
                        isActive={activeIndex === flatIndex}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => handleItemClick(item)}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--tl-mono)',
                            fontSize: 10.5,
                            color: 'var(--tl-text-4)',
                            minWidth: 72,
                            flexShrink: 0,
                          }}
                        >
                          {item.project.code}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: 'var(--tl-text)',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.project.name}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--tl-mono)',
                            fontSize: 11,
                            color: 'var(--tl-text-3)',
                            flexShrink: 0,
                            maxWidth: 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.project.client}
                        </span>
                      </ResultRow>
                    );
                  })}
                </div>
              )}

              {/* Actions section */}
              {actionItems.length > 0 && (
                <div>
                  <SectionLabel>Actions</SectionLabel>
                  {actionItems.map((item, i) => {
                    const flatIndex = actionOffset + i;
                    return (
                      <ResultRow
                        key={item.id}
                        isActive={activeIndex === flatIndex}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => handleItemClick(item)}
                      >
                        {/* Action icon placeholder — consistent-width dot */}
                        <span
                          style={{
                            fontFamily: 'var(--tl-mono)',
                            fontSize: 10.5,
                            color: 'var(--tl-text-4)',
                            minWidth: 72,
                            flexShrink: 0,
                          }}
                        >
                          cmd
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: 'var(--tl-text)',
                            flex: 1,
                          }}
                        >
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--tl-mono)',
                            fontSize: 11,
                            color: 'var(--tl-text-3)',
                            flexShrink: 0,
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.hint}
                        </span>
                      </ResultRow>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid var(--tl-line)',
            padding: '6px 14px',
            display: 'flex',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <FooterHint keys={['↑', '↓']} label="navigate" />
          <FooterHint keys={['↵']} label="select" />
          <FooterHint keys={['esc']} label="close" />
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--tl-mono)',
        fontSize: 10.5,
        color: 'var(--tl-text-4)',
        padding: '8px 14px 4px',
        userSelect: 'none',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

type ResultRowProps = {
  isActive: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  children: React.ReactNode;
};

function ResultRow({ isActive, onMouseEnter, onClick, children }: ResultRowProps) {
  return (
    <button
      type="button"
      data-active={isActive}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 14px',
        textAlign: 'left',
        background: isActive ? 'var(--tl-surface-alt)' : 'transparent',
        border: 'none',
        borderLeft: isActive ? '2px solid var(--tl-ink)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background 0.08s',
      }}
    >
      {children}
    </button>
  );
}

type FooterHintProps = {
  keys: string[];
  label: string;
};

function FooterHint({ keys, label }: FooterHintProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--tl-mono)',
        fontSize: 10.5,
        color: 'var(--tl-text-4)',
        userSelect: 'none',
      }}
    >
      {keys.map((k) => (
        <kbd
          key={k}
          style={{
            border: '1px solid var(--tl-line)',
            borderRadius: 3,
            padding: '1px 4px',
            background: 'var(--tl-bg)',
            lineHeight: 1.6,
          }}
        >
          {k}
        </kbd>
      ))}
      <span style={{ color: 'var(--tl-text-4)', marginLeft: 2 }}>{label}</span>
    </span>
  );
}

// ── Hook: open palette with Cmd/Ctrl+K ─────────────────────────────────────

/**
 * Call this in your root component to wire up the global Cmd+K / Ctrl+K
 * shortcut. Pass in a callback that sets your open state to true.
 *
 * Example:
 *   useCommandPaletteShortcut(() => setPaletteOpen(true));
 */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onOpen]);
}
