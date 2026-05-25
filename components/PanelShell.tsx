'use client';

import type { DragEvent, ReactNode } from 'react';

type PanelShellProps = {
  title: string;
  allowedW: Array<4 | 6 | 8 | 12>;
  currentW: 4 | 6 | 8 | 12;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onResize: () => void;
  onRemove: () => void;
  bodyKind: string;
  children: ReactNode;
};

function widthLabel(width: 4 | 6 | 8 | 12) {
  if (width === 4) return '1/3';
  if (width === 6) return '1/2';
  if (width === 8) return '2/3';
  return 'full';
}

export function PanelShell({
  title,
  allowedW,
  currentW,
  onDragStart,
  onDragEnd,
  onResize,
  onRemove,
  bodyKind,
  children,
}: PanelShellProps) {
  return (
    <section className={`console-panel console-panel--${bodyKind}`}>
      <div className="console-panel-head" draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <span className="console-panel-grip">⋮⋮</span>
        <span className="console-panel-title">{title}</span>
        <div className="console-panel-spacer" />
        {allowedW.length > 1 && (
          <button
            className="console-panel-btn console-panel-width"
            onClick={(event) => {
              event.stopPropagation();
              onResize();
            }}
            type="button"
          >
            {widthLabel(currentW)}
          </button>
        )}
        <button
          className="console-panel-btn"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          type="button"
        >
          ×
        </button>
      </div>
      <div className="console-panel-body">{children}</div>
    </section>
  );
}
