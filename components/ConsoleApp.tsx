'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { PanelShell } from './PanelShell';
import { TLIcon } from './icons';
import { TL_INBOX, TL_PORTFOLIO, TL_PROJECTS, TL_RISKS, type PanelId } from '@/lib/console-data';

type GridWidth = 4 | 6 | 8 | 12;
type LayoutItem = { id: PanelId; w: GridWidth };
type Theme = 'light' | 'dark';
type Density = 'compact' | 'roomy';

type PanelProps = {
  pinnedProjectId: string;
  onPin?: (id: string) => void;
  density: Density;
};

type PanelDefinition = {
  title: string;
  defaultW: GridWidth;
  allowedW: GridWidth[];
  Component: ComponentType<PanelProps>;
};

const STORAGE_LAYOUT = 'throughline.console.layout.v1';
const STORAGE_PINNED = 'throughline.console.pinned.v1';
const STORAGE_THEME = 'throughline.console.theme.v1';
const STORAGE_DENSITY = 'throughline.console.density.v1';

const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: 'daybook', w: 12 },
  { id: 'metrics', w: 12 },
  { id: 'moves', w: 8 },
  { id: 'pinned', w: 4 },
  { id: 'projects', w: 8 },
  { id: 'risks', w: 4 },
  { id: 'inbox', w: 8 },
  { id: 'comms', w: 4 },
];

// ── Sparkline ──────────────────────────────────────────────────────────────
function CPSpark({ data }: { data: number[] }) {
  const w = 56, h = 14, pad = 1;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(0.0001, max - min);
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((d - min) / range) * (h - 2 * pad);
    return [x, y] as const;
  });
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="cp-spark">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx={last[0]} cy={last[1]} r="1.5" fill="currentColor" />
    </svg>
  );
}

// ── Inline Bar ─────────────────────────────────────────────────────────────
function CPBar({ v }: { v: number }) {
  const cls = v < 50 ? 'bad' : v < 75 ? 'warn' : 'good';
  return (
    <span className="cp-inlinebar">
      <span className={`cp-inlinebar-fill cp-inlinebar-fill--${cls}`} style={{ width: `${v}%` }} />
    </span>
  );
}

const PANEL_CATALOG: Record<PanelId, PanelDefinition> = {
  daybook: {
    title: 'Today',
    defaultW: 12,
    allowedW: [12],
    Component: function DaybookPanel() {
      return (
        <div className="cp-daybook">
          <div className="cp-daybook-l">
            <div className="cp-daybook-eyebrow">Monday</div>
            <h1 className="cp-daybook-title">
              25 May<span className="cp-daybook-year">, 2026</span>
            </h1>
            <p className="cp-daybook-lede">
              Three projects need a move today. One client has been quiet for a week. Yesterday you closed two risks and shipped the access-control evidence pack.
            </p>
          </div>
          <div className="cp-daybook-r">
            <div className="cp-ledger">
              <div className="cp-ledger-row">
                <span className="cp-ledger-num">{TL_PORTFOLIO.active}</span>
                <span className="cp-ledger-lbl">active projects</span>
              </div>
              <div className="cp-ledger-row">
                <span className="cp-ledger-num">
                  {TL_PORTFOLIO.health}
                  <span className="cp-ledger-unit">%</span>
                </span>
                <span className="cp-ledger-lbl">portfolio health</span>
              </div>
              <div className="cp-ledger-row cp-ledger-row--warn">
                <span className="cp-ledger-num">
                  {TL_PORTFOLIO.risksHigh}
                  <span className="cp-ledger-unit">/{TL_PORTFOLIO.risksOpen}</span>
                </span>
                <span className="cp-ledger-lbl">high / open risks</span>
              </div>
              <div className="cp-ledger-row">
                <span className="cp-ledger-num">
                  {TL_PORTFOLIO.hoursSaved}
                  <span className="cp-ledger-unit">h</span>
                </span>
                <span className="cp-ledger-lbl">saved this week</span>
              </div>
            </div>
          </div>
        </div>
      );
    },
  },
  metrics: {
    title: 'Portfolio metrics',
    defaultW: 12,
    allowedW: [12, 8, 6],
    Component: function MetricsPanel() {
      const cells = [
        { lbl: 'portfolio.health', val: TL_PORTFOLIO.health, suf: '%', spark: [62, 68, 71, 65, 69, 70, 70] },
        { lbl: 'projects.active', val: TL_PORTFOLIO.active, suf: '', spark: [3, 3, 3, 4, 4, 4, 4] },
        { lbl: 'risks.open', val: TL_PORTFOLIO.risksOpen, suf: '', spark: [2, 3, 3, 4, 5, 4, 4], state: 'warn' },
        { lbl: 'risks.high', val: TL_PORTFOLIO.risksHigh, suf: '', spark: [0, 1, 1, 2, 2, 2, 2], state: 'bad' },
        { lbl: 'comms.due', val: TL_PORTFOLIO.updatesDue, suf: '', spark: [1, 1, 2, 2, 2, 2, 2] },
        { lbl: 'ai.hours_saved', val: TL_PORTFOLIO.hoursSaved, suf: 'h', spark: [4, 5, 6, 7, 8, 9, 9.5], state: 'good' },
      ];

      return (
        <div className="cp-strip">
          {cells.map((cell) => (
            <div key={cell.lbl} className={`cp-stripcell ${cell.state ? `cp-stripcell--${cell.state}` : ''}`}>
              <div className="cp-stripcell-lbl">{cell.lbl}</div>
              <div className="cp-stripcell-row">
                <div className="cp-stripcell-val">
                  {cell.val}
                  {cell.suf && <span className="cp-stripcell-suf">{cell.suf}</span>}
                </div>
                <CPSpark data={cell.spark} />
              </div>
            </div>
          ))}
        </div>
      );
    },
  },
  moves: {
    title: 'Priority moves',
    defaultW: 8,
    allowedW: [6, 8, 12],
    Component: function MovesPanel() {
      const projects = [...TL_PROJECTS].sort((a, b) => a.health - b.health).slice(0, 3);
      return (
        <ol className="cp-moves">
          {projects.map((project, index) => (
            <li key={project.id} className="cp-move">
              <div className="cp-move-num">{String(index + 1).padStart(2, '0')}</div>
              <div className="cp-move-body">
                <div className="cp-move-meta">
                  <span className={`cp-pill cp-pill--${project.risk.toLowerCase()}`}>{project.risk}</span>
                  <span className="cp-move-code">{project.code}</span>
                  <span className="cp-mid-dot" />
                  <span>{project.client}</span>
                  <span className="cp-mid-dot" />
                  <span className="cp-move-when">{project.nextWhen}</span>
                </div>
                <div className="cp-move-h">{project.move}</div>
                <div className="cp-move-p">{project.moveBody}</div>
              </div>
              <div className="cp-move-actions">
                <button className="cp-btn cp-btn--primary">{TLIcon.send(11)}<span>draft</span></button>
                <button className="cp-btn cp-btn--ghost">snooze</button>
              </div>
            </li>
          ))}
        </ol>
      );
    },
  },
  projects: {
    title: 'Projects',
    defaultW: 8,
    allowedW: [12, 8],
    Component: function ProjectsPanel({ pinnedProjectId, onPin }) {
      const [sortKey, setSortKey] = useState<'health' | 'comms'>('health');
      const sorted = useMemo(() => {
        return [...TL_PROJECTS].sort((a, b) => {
          if (sortKey === 'health') return a.health - b.health;
          return a.comms - b.comms;
        });
      }, [sortKey]);

      return (
        <table className="cp-table">
          <thead>
            <tr>
              <th className="cp-th-tight">&middot;</th>
              <th>code</th>
              <th>project</th>
              <th>client</th>
              <th>stage</th>
              <th className={`cp-th-num ${sortKey === 'health' ? 'is-sorted' : ''}`} onClick={() => setSortKey('health')}>
                health &darr;
              </th>
              <th className="cp-th-num">budget</th>
              <th className="cp-th-num">schedule</th>
              <th className={`cp-th-num ${sortKey === 'comms' ? 'is-sorted' : ''}`} onClick={() => setSortKey('comms')}>
                comms
              </th>
              <th className="cp-th-num">risks</th>
              <th>next</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((project) => {
              const riskCount = TL_RISKS.filter((risk) => risk.project === project.code).length;
              const riskHigh = TL_RISKS.filter((risk) => risk.project === project.code && risk.severity === 'high').length;

              return (
                <tr
                  key={project.id}
                  onClick={() => onPin?.(project.id)}
                  className={project.id === pinnedProjectId ? 'is-sel' : ''}
                >
                  <td>
                    <span className={`cp-rdot cp-rdot--${project.risk.toLowerCase()}`} />
                  </td>
                  <td className="cp-mono">{project.code}</td>
                  <td className="cp-td-name">{project.name}</td>
                  <td>{project.client}</td>
                  <td>
                    <span className="cp-stage">{project.stage.toLowerCase()}</span>
                  </td>
                  <td className="cp-td-num">
                    <span className="cp-tnum">{project.health}</span>
                    <CPBar v={project.health} />
                  </td>
                  <td className={`cp-td-num cp-state--${project.budgetState}`}>{project.budget}</td>
                  <td className={`cp-td-num cp-state--${project.scheduleState}`}>{project.schedule}</td>
                  <td className="cp-td-num">
                    <span className="cp-tnum">{project.comms}</span>
                    <CPBar v={project.comms} />
                  </td>
                  <td className="cp-td-num">
                    {riskHigh > 0 && <span className="cp-rchip cp-rchip--high">{riskHigh}H</span>}
                    <span className="cp-rchip">{riskCount}</span>
                  </td>
                  <td className="cp-td-next">
                    <span className={`cp-next-when ${project.nextWhen === 'Overdue' ? 'cp-next-when--bad' : ''}`}>{project.nextWhen}</span>
                    <span className="cp-next-what">{project.next}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    },
  },
  risks: {
    title: 'Open risks',
    defaultW: 4,
    allowedW: [4, 6, 8, 12],
    Component: function RisksPanel() {
      return (
        <table className="cp-table cp-table--tight">
          <thead>
            <tr>
              <th className="cp-th-tight">sev</th>
              <th>id</th>
              <th>title</th>
              <th>project</th>
              <th>owner</th>
              <th className="cp-th-num">age</th>
            </tr>
          </thead>
          <tbody>
            {TL_RISKS.map((risk) => (
              <tr key={risk.id}>
                <td>
                  <span className={`cp-sev cp-sev--${risk.severity}`}>{risk.severity === 'high' ? 'H' : 'M'}</span>
                </td>
                <td className="cp-mono">{risk.id}</td>
                <td className="cp-td-name">{risk.title}</td>
                <td className="cp-mono">{risk.project}</td>
                <td>{risk.owner}</td>
                <td className="cp-td-num">{risk.age}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    },
  },
  inbox: {
    title: 'Inbox signals',
    defaultW: 6,
    allowedW: [4, 6, 8, 12],
    Component: function InboxPanel() {
      return (
        <ul className="cp-inbox">
          {TL_INBOX.map((item, index) => (
            <li key={`${item.from}-${index}`} className={`cp-inbox-row cp-inbox-row--${item.state}`}>
              <div className="cp-inbox-state" />
              <div className="cp-inbox-body">
                <div className="cp-inbox-line">
                  <span className="cp-inbox-from">{item.from}</span>
                  <span className="cp-inbox-org">{item.org}</span>
                  <span className="cp-inbox-at">{item.at}</span>
                </div>
                <div className="cp-inbox-subj">{item.subj}</div>
                <div className="cp-inbox-snip">{item.snip}</div>
              </div>
              <div className="cp-inbox-tag">{item.project}</div>
            </li>
          ))}
        </ul>
      );
    },
  },
  pinned: {
    title: 'Pinned project',
    defaultW: 4,
    allowedW: [4, 6],
    Component: function PinnedPanel({ pinnedProjectId }) {
      const selected = TL_PROJECTS.find((project) => project.id === pinnedProjectId) || TL_PROJECTS[0];

      return (
        <div className="cp-pinned">
          <div className="cp-pinned-head">
            <div className="cp-pinned-eyebrow">
              <span className={`cp-rdot cp-rdot--${selected.risk.toLowerCase()}`} />
              <span className="cp-mono">{selected.code}</span>
              <span className="cp-mid-dot" />
              <span>{selected.stage}</span>
              <span className="cp-pinned-pinned">pinned</span>
            </div>
            <h3 className="cp-pinned-title">{selected.name}</h3>
            <div className="cp-pinned-sub">{selected.client}</div>
          </div>
          <div className="cp-pinned-kv">
            <div>
              <span>owner</span>
              <b>{selected.owner}</b>
            </div>
            <div>
              <span>contact</span>
              <b>{selected.contact}</b>
            </div>
            <div>
              <span>channel</span>
              <b>{selected.channel}</b>
            </div>
            <div>
              <span>next</span>
              <b>{selected.nextWhen}</b>
            </div>
            <div>
              <span>last touch</span>
              <b>{selected.lastTouch}</b>
            </div>
            <div>
              <span>phase</span>
              <b>{selected.phase}/8</b>
            </div>
          </div>
          <div className="cp-pinned-block">
            <div className="cp-pinned-block-head">
              <span>{TLIcon.spark(11)}</span>
              <span>recommended move</span>
            </div>
            <div className="cp-pinned-move">
              <div className="cp-pinned-move-h">{selected.move}</div>
              <div className="cp-pinned-move-p">{selected.moveBody}</div>
              <div className="cp-pinned-move-actions">
                <button className="cp-btn cp-btn--primary">{TLIcon.send(11)}<span>draft &amp; send</span></button>
                <button className="cp-btn cp-btn--ghost">snooze</button>
              </div>
            </div>
          </div>
        </div>
      );
    },
  },
  timeline: {
    title: 'Weekly timeline',
    defaultW: 12,
    allowedW: [12],
    Component: function TimelinePanel() {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
      const dates = ['25', '26', '27', '28', '29'];

      return (
        <div className="cp-tl">
          <div className="cp-tl-head">
            {days.map((d, i) => (
              <div key={d} className="cp-tl-head-cell">
                {d}<span className="cp-tl-head-date">{dates[i]}</span>
              </div>
            ))}
          </div>
          <div className="cp-tl-rows">
            {TL_PROJECTS.map((project) => (
              <div key={project.id} className="cp-tl-row">
                <div className="cp-tl-row-label">
                  <span className={`cp-rdot cp-rdot--${project.risk.toLowerCase()}`} />
                  <span className="cp-mono">{project.code}</span>
                  <span className="cp-tl-row-name">{project.name}</span>
                </div>
                <div className="cp-tl-row-track">
                  {days.map((d, di) => {
                    const item = project.timeline.find((t) => t.d === d);
                    return (
                      <div key={di} className="cp-tl-row-cell">
                        {item && (
                          <div className={`cp-tl-bar cp-tl-bar--${item.s}`}>
                            <span className="cp-tl-bar-k">{item.k}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    },
  },
  comms: {
    title: 'Comms health',
    defaultW: 4,
    allowedW: [4, 6],
    Component: function CommsPanel() {
      return (
        <ul className="cp-comms">
          {TL_PROJECTS.map((project) => {
            const state = project.comms < 50 ? 'bad' : project.comms < 75 ? 'warn' : 'good';
            return (
              <li key={project.id} className="cp-comms-row">
                <div className="cp-comms-l">
                  <div className="cp-comms-name">{project.client}</div>
                  <div className="cp-comms-sub">{project.contact} &middot; {project.lastTouch}</div>
                </div>
                <div className="cp-comms-mid">
                  <div className="cp-comms-bar">
                    <div
                      className={`cp-comms-bar-fill cp-comms-bar-fill--${state}`}
                      style={{ width: `${project.comms}%` }}
                    />
                  </div>
                </div>
                <div className={`cp-comms-num cp-comms-num--${state}`}>{project.comms}</div>
              </li>
            );
          })}
        </ul>
      );
    },
  },
};

function getStoredLayout() {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(STORAGE_LAYOUT);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as LayoutItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => Object.keys(PANEL_CATALOG).includes(item.id)) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export default function ConsoleApp() {
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [pinnedId, setPinnedId] = useState<string>(TL_PROJECTS[0].id);
  const [theme, setTheme] = useState<Theme>('light');
  const [density, setDensity] = useState<Density>('compact');
  const [addOpen, setAddOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setLayout(getStoredLayout());
    const savedTheme = window.localStorage.getItem(STORAGE_THEME);
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
    const savedDensity = window.localStorage.getItem(STORAGE_DENSITY) as Density | null;
    if (savedDensity === 'compact' || savedDensity === 'roomy') setDensity(savedDensity);
    const savedPinned = window.localStorage.getItem(STORAGE_PINNED);
    if (savedPinned) setPinnedId(savedPinned);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(layout));
  }, [layout]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_PINNED, pinnedId);
  }, [pinnedId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_THEME, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_DENSITY, density);
  }, [density]);

  const availablePanels = useMemo(() => {
    const used = new Set(layout.map((item) => item.id));
    return (Object.keys(PANEL_CATALOG) as PanelId[]).filter((id) => !used.has(id));
  }, [layout]);

  const onDragStart = (id: string) => (event: React.DragEvent<HTMLDivElement>) => {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  const onDragOver = (id: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  };

  const onDrop = (id: string) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggingId || draggingId === id) {
      setDraggingId(null);
      setOverId(null);
      return;
    }
    setLayout((current) => {
      const fromIndex = current.findIndex((item) => item.id === draggingId);
      const toIndex = current.findIndex((item) => item.id === id);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggingId(null);
    setOverId(null);
  };

  const onDragLeave = () => setOverId(null);
  const onDragEnd = () => {
    setDraggingId(null);
    setOverId(null);
  };

  const cycleWidth = (id: string) => {
    setLayout((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const allowed = PANEL_CATALOG[id].allowedW;
        const index = allowed.indexOf(item.w);
        const nextWidth = allowed[(index + 1) % allowed.length];
        return { ...item, w: nextWidth };
      })
    );
  };

  const removePanel = (id: string) => setLayout((current) => current.filter((item) => item.id !== id));
  const addPanel = (id: PanelId) => {
    setLayout((current) => [...current, { id, w: PANEL_CATALOG[id].defaultW }]);
    setAddOpen(false);
  };
  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  return (
    <div className={`console-root console-root--${theme} console-root--d-${density}`}>
      <ConsoleTopBar
        addOpen={addOpen}
        onAdd={() => setAddOpen((current) => !current)}
        availablePanels={availablePanels}
        onAddPanel={addPanel}
        onCloseAdd={() => setAddOpen(false)}
        onReset={resetLayout}
        theme={theme}
        setTheme={setTheme}
      />

      <div className="console-grid">
        {layout.map((item) => {
          const panel = PANEL_CATALOG[item.id];
          const isDragging = draggingId === item.id;
          const isOver = overId === item.id && draggingId && draggingId !== item.id;

          return (
            <div
              key={item.id}
              className={`console-cell w-${item.w}${isDragging ? ' is-dragging' : ''}${isOver ? ' is-over' : ''}`}
              onDragOver={onDragOver(item.id)}
              onDragLeave={onDragLeave}
              onDrop={onDrop(item.id)}
            >
              <PanelShell
                title={panel.title}
                allowedW={panel.allowedW}
                currentW={item.w}
                onDragStart={onDragStart(item.id)}
                onDragEnd={onDragEnd}
                onResize={() => cycleWidth(item.id)}
                onRemove={() => removePanel(item.id)}
                bodyKind={item.id}
              >
                <panel.Component pinnedProjectId={pinnedId} onPin={setPinnedId} density={density} />
              </PanelShell>
            </div>
          );
        })}

        {draggingId && (
          <div
            className="console-cell w-12 console-endzone"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setOverId('__end__');
            }}
            onDrop={(event) => {
              event.preventDefault();
              setLayout((current) => {
                const fromIndex = current.findIndex((item) => item.id === draggingId);
                if (fromIndex < 0) return current;
                const next = [...current];
                const [moved] = next.splice(fromIndex, 1);
                next.push(moved);
                return next;
              });
              setDraggingId(null);
              setOverId(null);
            }}
          >
            drop here to move to end
          </div>
        )}

        {layout.length === 0 && (
          <div className="console-cell w-12 console-empty">
            <div>No panels. Add one with the <strong>+ add panel</strong> button above.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsoleTopBar({
  addOpen,
  onAdd,
  availablePanels,
  onAddPanel,
  onCloseAdd,
  onReset,
  theme,
  setTheme,
}: {
  addOpen: boolean;
  onAdd: () => void;
  availablePanels: PanelId[];
  onAddPanel: (id: PanelId) => void;
  onCloseAdd: () => void;
  onReset: () => void;
  theme: Theme;
  setTheme: (value: Theme) => void;
}) {
  return (
    <header className="console-top">
      <div className="console-top-l">
        <div className="console-brand">
          <span className="console-brand-mark">T/L</span>
          <span className="console-brand-name">throughline</span>
        </div>
        <span className="console-top-sep" />
        <div className="console-breadcrumb">
          <span className="console-bc-key">workspace</span>
          <span className="console-bc-val">delivery</span>
          <span className="console-bc-key">view</span>
          <span className="console-bc-val">console</span>
        </div>
      </div>
      <div className="console-top-c">
        <span className="console-time">Mon 25 May &middot; 09:14</span>
        <span className="console-pulse" />
        <span className="console-live">live</span>
      </div>
      <div className="console-top-r">
        <span className="console-kbd-hint">drag panel grips to rearrange</span>
        <div className="console-add-wrap">
          <button className={`console-tbtn ${addOpen ? 'is-on' : ''}`} onClick={onAdd} disabled={availablePanels.length === 0}>
            <span>{TLIcon.plus(11)}</span>
            <span>add panel</span>
          </button>
          {addOpen && (
            <div className="console-add-menu" onMouseLeave={onCloseAdd}>
              <div className="console-add-menu-head">add panel</div>
              {availablePanels.length === 0 ? (
                <div className="console-add-menu-empty">all panels are visible</div>
              ) : (
                availablePanels.map((id) => (
                  <button key={id} className="console-add-menu-item" onClick={() => onAddPanel(id)}>
                    <span className="console-add-menu-key">{id}</span>
                    <span className="console-add-menu-title">{PANEL_CATALOG[id].title}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <button className="console-tbtn" onClick={onReset} title="Reset layout">
          <span>{TLIcon.refresh(12)}</span>
        </button>
        <button
          className="console-tbtn console-theme-toggle"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'}`}
        >
          {theme === 'light' ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M9.5 7.5A4 4 0 014.5 2.5 4 4 0 1010 7.5z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="2.2" fill="currentColor" />
              <path d="M6 1v1.4M6 9.6V11M1 6h1.4M9.6 6H11M2.5 2.5l1 1M8.5 8.5l1 1M2.5 9.5l1-1M8.5 3.5l1-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
