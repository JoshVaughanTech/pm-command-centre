'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

export type Notification = {
  id: string;
  type: 'message' | 'stale' | 'risk';
  title: string;
  detail: string;
  at: string;
  read: boolean;
  projectId?: string;
};

type NotificationsDropdownProps = {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClickNotification: (n: Notification) => void;
};

// ── Icons ──────────────────────────────────────────────────────────────────

function BellIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 1.5A3.5 3.5 0 004.5 5v2.5L3 9.5h10l-1.5-2V5A3.5 3.5 0 008 1.5z" />
      <path d="M6.5 9.5a1.5 1.5 0 003 0" />
    </svg>
  );
}

function MessageIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="2" width="10" height="7" rx="1.5" />
      <path d="M4 8.5L3 11l2.5-1.5" />
    </svg>
  );
}

function StaleIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" />
      <path d="M6 3.5v3l1.5 1.5" />
    </svg>
  );
}

function RiskIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 1.5L11 10.5H1z" />
      <path d="M6 5v2.5M6 9v.5" strokeWidth="1.2" />
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_META: Record<Notification['type'], { label: string; colorClass: string; IconComponent: React.FC<{ size?: number }> }> = {
  message: {
    label: 'msg',
    colorClass: 'notif-item-icon--message',
    IconComponent: MessageIcon,
  },
  stale: {
    label: 'stale',
    colorClass: 'notif-item-icon--stale',
    IconComponent: StaleIcon,
  },
  risk: {
    label: 'risk',
    colorClass: 'notif-item-icon--risk',
    IconComponent: RiskIcon,
  },
};

// ── Component ──────────────────────────────────────────────────────────────

export function NotificationsDropdown({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClickNotification,
}: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;

  const close = useCallback(() => setOpen(false), []);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        close();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);

  function handleItemClick(n: Notification) {
    if (!n.read) onMarkRead(n.id);
    onClickNotification(n);
    close();
  }

  return (
    <>
      {/* Scoped styles — inlined so the component is self-contained */}
      <style>{STYLES}</style>

      <div className="notif-wrap" ref={wrapRef}>
        {/* Bell trigger */}
        <button
          className={`notif-trigger${open ? ' notif-trigger--open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ''}`}
          aria-expanded={open}
          aria-haspopup="true"
        >
          <BellIcon size={14} />
          {hasUnread && (
            <span className="notif-badge" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            className="notif-panel"
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="notif-panel-head">
              <span className="notif-panel-title">notifications</span>
              {hasUnread && (
                <span className="notif-panel-count">{unreadCount} unread</span>
              )}
              <div className="notif-panel-spacer" />
              <button
                className="notif-mark-all"
                onClick={onMarkAllRead}
                disabled={!hasUnread}
              >
                mark all read
              </button>
            </div>

            {/* List */}
            {notifications.length === 0 ? (
              <div className="notif-empty">No notifications</div>
            ) : (
              <ul className="notif-list" role="list">
                {notifications.map((n) => {
                  const meta = TYPE_META[n.type];
                  const Icon = meta.IconComponent;
                  return (
                    <li key={n.id}>
                      <button
                        className={`notif-item${n.read ? ' notif-item--read' : ''}`}
                        onClick={() => handleItemClick(n)}
                      >
                        {/* Unread dot */}
                        <span
                          className={`notif-dot${n.read ? ' notif-dot--read' : ''}`}
                          aria-hidden="true"
                        />

                        {/* Type icon */}
                        <span className={`notif-item-icon ${meta.colorClass}`} aria-hidden="true">
                          <Icon size={11} />
                        </span>

                        {/* Body */}
                        <span className="notif-item-body">
                          <span className="notif-item-title">{n.title}</span>
                          <span className="notif-item-detail">{n.detail}</span>
                        </span>

                        {/* Right side: type tag + time */}
                        <span className="notif-item-meta">
                          <span className={`notif-type-tag notif-type-tag--${n.type}`}>{meta.label}</span>
                          <span className="notif-item-at">{n.at}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
// Scoped under .notif-* to avoid conflicts. Mirrors the app's hairline-border,
// warm-gray, monospace aesthetic from globals.css.

const STYLES = `
/* ── wrapper (positioning anchor) ─────────────────────────── */
.notif-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* ── trigger button ────────────────────────────────────────── */
.notif-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 9px;
  font-family: var(--tl-mono);
  font-size: 11.5px;
  color: var(--tl-text-2);
  border: 1px solid var(--tl-line);
  border-radius: 4px;
  background: var(--tl-bg);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.notif-trigger:hover {
  background: var(--tl-surface-alt);
  color: var(--tl-text);
}

.notif-trigger--open {
  background: var(--tl-ink);
  color: var(--tl-bg);
  border-color: var(--tl-ink);
}

/* ── unread count badge ─────────────────────────────────────── */
.notif-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--tl-bad);
  color: #fff;
  font-family: var(--tl-mono);
  font-size: 9.5px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  pointer-events: none;
  letter-spacing: 0;
}

/* ── dropdown panel ─────────────────────────────────────────── */
.notif-panel {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  z-index: 60;
  width: 360px;
  max-width: calc(100vw - 24px);
  max-height: 400px;
  display: flex;
  flex-direction: column;
  background: var(--tl-surface);
  border: 1px solid var(--tl-line);
  border-radius: 7px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px var(--tl-line-2);
  overflow: hidden;
}

/* dark theme elevation boost */
.console-root--dark .notif-panel {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--tl-line);
}

/* ── panel header ───────────────────────────────────────────── */
.notif-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--tl-line);
  background: var(--tl-surface);
  flex-shrink: 0;
}

.notif-panel-title {
  font-family: var(--tl-mono);
  font-size: 10.5px;
  color: var(--tl-text-2);
  letter-spacing: 0.02em;
}

.notif-panel-count {
  font-family: var(--tl-mono);
  font-size: 10px;
  color: var(--tl-bad);
  letter-spacing: 0.02em;
}

.notif-panel-spacer {
  flex: 1;
}

.notif-mark-all {
  font-family: var(--tl-mono);
  font-size: 10px;
  color: var(--tl-text-3);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
  letter-spacing: 0.01em;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.notif-mark-all:not(:disabled):hover {
  background: var(--tl-surface-alt);
  color: var(--tl-text);
  border-color: var(--tl-line);
}

.notif-mark-all:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── scrollable list ────────────────────────────────────────── */
.notif-list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* subtle scrollbar styling */
.notif-list::-webkit-scrollbar {
  width: 4px;
}
.notif-list::-webkit-scrollbar-track {
  background: transparent;
}
.notif-list::-webkit-scrollbar-thumb {
  background: var(--tl-line-strong);
  border-radius: 2px;
}

/* ── empty state ────────────────────────────────────────────── */
.notif-empty {
  padding: 32px 20px;
  text-align: center;
  font-family: var(--tl-mono);
  font-size: 11.5px;
  color: var(--tl-text-4);
}

/* ── notification item ──────────────────────────────────────── */
.notif-item {
  display: grid;
  grid-template-columns: 8px 20px 1fr auto;
  gap: 8px;
  align-items: flex-start;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  background: none;
  border: none;
  border-bottom: 1px solid var(--tl-line-2);
  cursor: pointer;
  transition: background 0.1s;
}

.notif-list li:last-child .notif-item {
  border-bottom: 0;
}

.notif-item:hover {
  background: var(--tl-surface-alt);
}

.notif-item--read {
  opacity: 0.65;
}

.notif-item--read:hover {
  opacity: 1;
}

/* ── unread indicator dot ───────────────────────────────────── */
.notif-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tl-ink);
  margin-top: 5px;
  flex-shrink: 0;
  transition: background 0.15s;
}

.notif-dot--read {
  background: transparent;
  border: 1px solid var(--tl-line-strong);
}

/* ── type icon ──────────────────────────────────────────────── */
.notif-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
}

.notif-item-icon--message {
  background: #e8f0fb;
  color: #2563eb;
}

.notif-item-icon--stale {
  background: var(--tl-warn-bg);
  color: var(--tl-warn);
}

.notif-item-icon--risk {
  background: var(--tl-bad-bg);
  color: var(--tl-bad);
}

/* dark-mode icon tints */
.console-root--dark .notif-item-icon--message {
  background: #1a2540;
  color: #6ea5f5;
}

/* ── item body ──────────────────────────────────────────────── */
.notif-item-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.notif-item-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--tl-text);
  line-height: 1.35;
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-item-detail {
  font-size: 11px;
  color: var(--tl-text-3);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── right-side meta (type tag + timestamp) ─────────────────── */
.notif-item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  padding-top: 1px;
}

.notif-type-tag {
  font-family: var(--tl-mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  padding: 1px 5px;
  border-radius: 3px;
}

.notif-type-tag--message {
  background: #e8f0fb;
  color: #2563eb;
}

.notif-type-tag--stale {
  background: var(--tl-warn-bg);
  color: var(--tl-warn);
}

.notif-type-tag--risk {
  background: var(--tl-bad-bg);
  color: var(--tl-bad);
}

.console-root--dark .notif-type-tag--message {
  background: #1a2540;
  color: #6ea5f5;
}

.notif-item-at {
  font-family: var(--tl-mono);
  font-size: 10px;
  color: var(--tl-text-4);
  white-space: nowrap;
}
`;
