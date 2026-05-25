'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PanelShell } from './PanelShell';
import { TLIcon } from './icons';
import { ProjectModal } from './ProjectModal';
import { RiskModal } from './RiskModal';
import { WorkspaceModal } from './WorkspaceModal';
import { IntegrationModal } from './IntegrationModal';
import { computePortfolio, getDayName, getDateDisplay } from '@/lib/utils';
import type { PanelId, ProjectRecord, RiskRecord, PortfolioSummary } from '@/lib/console-data';

type GridWidth = 4 | 6 | 8 | 12;
type LayoutItem = { id: PanelId; w: GridWidth };
type Theme = 'light' | 'dark';
type Density = 'compact' | 'roomy';

type PanelProps = {
  pinnedProjectId: string;
  onPin?: (id: string) => void;
  density: Density;
  projects: ProjectRecord[];
  risks: RiskRecord[];
  portfolio: PortfolioSummary;
  onAddProject?: () => void;
  onEditProject?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onAddRisk?: () => void;
  onDeleteRisk?: (id: string) => void;
  onViewProject?: (id: string) => void;
  userName?: string;
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
  { id: 'comms', w: 12 },
];

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
    Component: function DaybookPanel({ projects, risks, portfolio }) {
      const now = new Date();
      const dayName = getDayName(now);
      const { day, month, year } = getDateDisplay(now);
      const lowHealth = projects.filter((p) => p.health < 60).length;
      const quietClients = projects.filter((p) => p.comms < 40).length;

      let lede = '';
      if (projects.length === 0) {
        lede = 'Welcome to Throughline. Add your first project to get started.';
      } else {
        const parts: string[] = [];
        if (lowHealth > 0) parts.push(`${lowHealth} project${lowHealth > 1 ? 's' : ''} need${lowHealth === 1 ? 's' : ''} attention`);
        if (quietClients > 0) parts.push(`${quietClients} client${quietClients > 1 ? 's have' : ' has'} been quiet`);
        if (risks.filter((r) => r.severity === 'high').length > 0) parts.push(`${risks.filter((r) => r.severity === 'high').length} high-severity risk${risks.filter((r) => r.severity === 'high').length > 1 ? 's' : ''} open`);
        lede = parts.length > 0 ? parts.join('. ') + '.' : `All ${projects.length} projects are tracking well. No urgent actions today.`;
      }

      return (
        <div className="cp-daybook">
          <div className="cp-daybook-l">
            <div className="cp-daybook-eyebrow">{dayName}</div>
            <h1 className="cp-daybook-title">
              {day} {month}<span className="cp-daybook-year">, {year}</span>
            </h1>
            <p className="cp-daybook-lede">{lede}</p>
          </div>
          <div className="cp-daybook-r">
            <div className="cp-ledger">
              <div className="cp-ledger-row">
                <span className="cp-ledger-num">{portfolio.active}</span>
                <span className="cp-ledger-lbl">active projects</span>
              </div>
              <div className="cp-ledger-row">
                <span className="cp-ledger-num">
                  {portfolio.health}<span className="cp-ledger-unit">%</span>
                </span>
                <span className="cp-ledger-lbl">portfolio health</span>
              </div>
              <div className="cp-ledger-row cp-ledger-row--warn">
                <span className="cp-ledger-num">
                  {portfolio.risksHigh}<span className="cp-ledger-unit">/{portfolio.risksOpen}</span>
                </span>
                <span className="cp-ledger-lbl">high / open risks</span>
              </div>
              <div className="cp-ledger-row">
                <span className="cp-ledger-num">
                  {portfolio.updatesDue}
                </span>
                <span className="cp-ledger-lbl">comms overdue</span>
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
    Component: function MetricsPanel({ portfolio }) {
      const cells = [
        { lbl: 'portfolio.health', val: portfolio.health, suf: '%', spark: [portfolio.health] },
        { lbl: 'projects.active', val: portfolio.active, suf: '', spark: [portfolio.active] },
        { lbl: 'risks.open', val: portfolio.risksOpen, suf: '', spark: [portfolio.risksOpen], state: portfolio.risksOpen > 0 ? 'warn' : '' },
        { lbl: 'risks.high', val: portfolio.risksHigh, suf: '', spark: [portfolio.risksHigh], state: portfolio.risksHigh > 0 ? 'bad' : '' },
        { lbl: 'comms.overdue', val: portfolio.updatesDue, suf: '', spark: [portfolio.updatesDue] },
        { lbl: 'ai.hours_saved', val: portfolio.hoursSaved, suf: 'h', spark: [portfolio.hoursSaved], state: 'good' },
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
    Component: function MovesPanel({ projects }) {
      const sorted = [...projects].sort((a, b) => a.health - b.health).slice(0, 3);
      if (sorted.length === 0) {
        return <div className="cp-empty">Add projects to see priority moves.</div>;
      }
      return (
        <ol className="cp-moves">
          {sorted.map((project, index) => (
            <li key={project.id} className="cp-move">
              <div className="cp-move-num">{String(index + 1).padStart(2, '0')}</div>
              <div className="cp-move-body">
                <div className="cp-move-meta">
                  <span className={`cp-pill cp-pill--${project.risk.toLowerCase()}`}>{project.risk}</span>
                  <span className="cp-move-code">{project.code}</span>
                  <span className="cp-mid-dot" />
                  <span>{project.client}</span>
                  {project.nextWhen && (
                    <>
                      <span className="cp-mid-dot" />
                      <span className="cp-move-when">{project.nextWhen}</span>
                    </>
                  )}
                </div>
                <div className="cp-move-h">{project.move || project.next || `Update ${project.name}`}</div>
                <div className="cp-move-p">{project.moveBody || `Health is at ${project.health}%. Review and update this project.`}</div>
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
    Component: function ProjectsPanel({ projects, risks, pinnedProjectId, onPin, onAddProject, onEditProject }) {
      const [sortKey, setSortKey] = useState<'health' | 'comms'>('health');
      const sorted = useMemo(() => {
        return [...projects].sort((a, b) => {
          if (sortKey === 'health') return a.health - b.health;
          return a.comms - b.comms;
        });
      }, [projects, sortKey]);

      if (projects.length === 0) {
        return (
          <div className="cp-empty">
            <p>No projects yet.</p>
            <button className="cp-btn cp-btn--primary" onClick={onAddProject}>{TLIcon.plus(11)}<span>Add your first project</span></button>
          </div>
        );
      }

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
              <th className="cp-th-tight"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((project) => {
              const riskCount = risks.filter((r) => r.project === project.code).length;
              const riskHigh = risks.filter((r) => r.project === project.code && r.severity === 'high').length;

              return (
                <tr
                  key={project.id}
                  onClick={() => onPin?.(project.id)}
                  className={project.id === pinnedProjectId ? 'is-sel' : ''}
                >
                  <td><span className={`cp-rdot cp-rdot--${project.risk.toLowerCase()}`} /></td>
                  <td className="cp-mono">{project.code}</td>
                  <td className="cp-td-name">{project.name}</td>
                  <td>{project.client}</td>
                  <td><span className="cp-stage">{project.stage.toLowerCase()}</span></td>
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
                    {project.nextWhen && <span className={`cp-next-when ${project.nextWhen === 'Overdue' ? 'cp-next-when--bad' : ''}`}>{project.nextWhen}</span>}
                    <span className="cp-next-what">{project.next}</span>
                  </td>
                  <td>
                    <button
                      className="console-panel-btn"
                      title="Edit project"
                      onClick={(e) => { e.stopPropagation(); onEditProject?.(project.id); }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7.5 1.5l1 1-5.5 5.5H2V7z" stroke="currentColor" strokeWidth="1" /></svg>
                    </button>
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
    Component: function RisksPanel({ risks, onAddRisk, onDeleteRisk }) {
      if (risks.length === 0) {
        return (
          <div className="cp-empty">
            <p>No open risks.</p>
            <button className="cp-btn" onClick={onAddRisk}>{TLIcon.plus(11)}<span>Log a risk</span></button>
          </div>
        );
      }
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
              <th className="cp-th-tight"></th>
            </tr>
          </thead>
          <tbody>
            {risks.map((risk) => (
              <tr key={risk.id}>
                <td><span className={`cp-sev cp-sev--${risk.severity}`}>{risk.severity === 'high' ? 'H' : 'M'}</span></td>
                <td className="cp-mono">{risk.id.slice(0, 8)}</td>
                <td className="cp-td-name">{risk.title}</td>
                <td className="cp-mono">{risk.project}</td>
                <td>{risk.owner}</td>
                <td className="cp-td-num">{risk.age}</td>
                <td>
                  <button
                    className="console-panel-btn"
                    title="Resolve risk"
                    onClick={() => onDeleteRisk?.(risk.id)}
                  >&times;</button>
                </td>
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
        <div className="cp-empty">
          <p>Inbox integration coming soon.</p>
          <p className="cp-empty-sub">Connect your email to see project-linked threads here.</p>
        </div>
      );
    },
  },
  pinned: {
    title: 'Pinned project',
    defaultW: 4,
    allowedW: [4, 6],
    Component: function PinnedPanel({ projects, pinnedProjectId, onViewProject }) {
      const selected = projects.find((p) => p.id === pinnedProjectId) || projects[0];
      if (!selected) {
        return <div className="cp-empty">Pin a project from the projects table.</div>;
      }

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
            <div><span>owner</span><b>{selected.owner || '—'}</b></div>
            <div><span>contact</span><b>{selected.contact || '—'}</b></div>
            <div><span>channel</span><b>{selected.channel || '—'}</b></div>
            <div><span>next</span><b>{selected.nextWhen || '—'}</b></div>
            <div><span>last touch</span><b>{selected.lastTouch}</b></div>
            <div><span>phase</span><b>{selected.phase}/8</b></div>
          </div>
          {(selected.move || selected.next) && (
            <div className="cp-pinned-block">
              <div className="cp-pinned-block-head">
                <span>{TLIcon.spark(11)}</span>
                <span>recommended move</span>
              </div>
              <div className="cp-pinned-move">
                <div className="cp-pinned-move-h">{selected.move || selected.next}</div>
                <div className="cp-pinned-move-p">{selected.moveBody || `Health is at ${selected.health}%. Review and update.`}</div>
              </div>
            </div>
          )}
          <button className="cp-pinned-action" onClick={() => onViewProject?.(selected.id)}>
            view full details
          </button>
        </div>
      );
    },
  },
  timeline: {
    title: 'Weekly timeline',
    defaultW: 12,
    allowedW: [12],
    Component: function TimelinePanel({ projects }) {
      if (projects.length === 0) {
        return <div className="cp-empty">Add projects to see the weekly timeline.</div>;
      }
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const dates = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d.getDate().toString();
      });

      return (
        <div className="cp-tl">
          <div className="cp-tl-head">
            {days.map((d, i) => (
              <div key={d} className="cp-tl-head-cell">{d}<span className="cp-tl-head-date">{dates[i]}</span></div>
            ))}
          </div>
          <div className="cp-tl-rows">
            {projects.map((project) => (
              <div key={project.id} className="cp-tl-row">
                <div className="cp-tl-row-label">
                  <span className={`cp-rdot cp-rdot--${project.risk.toLowerCase()}`} />
                  <span className="cp-mono">{project.code}</span>
                  <span className="cp-tl-row-name">{project.name}</span>
                </div>
                <div className="cp-tl-row-track">
                  {days.map((d, di) => {
                    const item = project.timeline?.find((t) => t.d === d);
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
    allowedW: [4, 6, 12],
    Component: function CommsPanel({ projects }) {
      if (projects.length === 0) {
        return <div className="cp-empty">Add projects to track communication health.</div>;
      }
      return (
        <ul className="cp-comms">
          {projects.map((project) => {
            const state = project.comms < 50 ? 'bad' : project.comms < 75 ? 'warn' : 'good';
            return (
              <li key={project.id} className="cp-comms-row">
                <div className="cp-comms-l">
                  <div className="cp-comms-name">{project.client}</div>
                  <div className="cp-comms-sub">{project.contact || project.owner} &middot; {project.lastTouch}</div>
                </div>
                <div className="cp-comms-mid">
                  <div className="cp-comms-bar">
                    <div className={`cp-comms-bar-fill cp-comms-bar-fill--${state}`} style={{ width: `${project.comms}%` }} />
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
  const { data: session } = useSession();
  const router = useRouter();

  // ── data state ───────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [risks, setRisks] = useState<RiskRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // ── layout state ─────────────────────────────────────────────
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [pinnedId, setPinnedId] = useState<string>('');
  const [theme, setTheme] = useState<Theme>('light');
  const [density, setDensity] = useState<Density>('compact');
  const [addOpen, setAddOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // ── modal state ──────────────────────────────────────────────
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; slug: string; role: string; projectCount: number; members: Array<{ id: string; name: string; email: string; role: string }> }>>([]);
  const [generatingMoves, setGeneratingMoves] = useState(false);

  // ── fetch data ───────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [projRes, riskRes, wsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/risks'),
        fetch('/api/workspaces'),
      ]);
      if (projRes.ok) {
        const p = await projRes.json();
        setProjects(p);
        if (p.length > 0 && !pinnedId) setPinnedId(p[0].id);
      }
      if (riskRes.ok) setRisks(await riskRes.json());
      if (wsRes.ok) setWorkspaces(await wsRes.json());
    } catch {
      // API not available (no database connected)
    }
    setLoading(false);
  }, [pinnedId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── restore layout from localStorage ─────────────────────────
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

  useEffect(() => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(layout)); }, [layout]);
  useEffect(() => { if (typeof window !== 'undefined' && pinnedId) window.localStorage.setItem(STORAGE_PINNED, pinnedId); }, [pinnedId]);
  useEffect(() => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_THEME, theme); }, [theme]);
  useEffect(() => { if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_DENSITY, density); }, [density]);

  // ── computed ─────────────────────────────────────────────────
  const portfolio = useMemo<PortfolioSummary>(() => {
    const highCount = risks.filter((r) => r.severity === 'high').length;
    return computePortfolio(projects, risks.length, highCount);
  }, [projects, risks]);

  const availablePanels = useMemo(() => {
    const used = new Set(layout.map((item) => item.id));
    return (Object.keys(PANEL_CATALOG) as PanelId[]).filter((id) => !used.has(id));
  }, [layout]);

  // ── CRUD handlers ────────────────────────────────────────────
  async function handleSaveProject(data: Record<string, string | number>) {
    if (editingProject) {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setEditingProject(null);
        setShowProjectModal(false);
      }
    } else {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newProject = await res.json();
        await fetchData();
        setPinnedId(newProject.id);
        setShowProjectModal(false);
      }
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('Delete this project and all its risks?')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchData();
      if (pinnedId === id) setPinnedId(projects[0]?.id || '');
    }
  }

  async function handleSaveRisk(data: { projectId: string; title: string; owner: string; severity: string; impact: string; action: string }) {
    const res = await fetch('/api/risks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await fetchData();
      setShowRiskModal(false);
    }
  }

  async function handleDeleteRisk(id: string) {
    const res = await fetch(`/api/risks/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchData();
  }

  function openEditProject(id: string) {
    const p = projects.find((proj) => proj.id === id);
    if (p) {
      setEditingProject(p);
      setShowProjectModal(true);
    }
  }

  // ── AI moves ─────────────────────────────────────────────────
  async function generateMoves() {
    if (projects.length === 0 || generatingMoves) return;
    setGeneratingMoves(true);
    try {
      const res = await fetch('/api/ai/moves', { method: 'POST' });
      if (res.ok) await fetchData();
    } catch {
      // AI not available
    }
    setGeneratingMoves(false);
  }

  // ── drag handlers ────────────────────────────────────────────
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
    if (!draggingId || draggingId === id) { setDraggingId(null); setOverId(null); return; }
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
  const onDragEnd = () => { setDraggingId(null); setOverId(null); };

  const cycleWidth = (id: string) => {
    setLayout((current) => current.map((item) => {
      if (item.id !== id) return item;
      const allowed = PANEL_CATALOG[id].allowedW;
      const index = allowed.indexOf(item.w);
      return { ...item, w: allowed[(index + 1) % allowed.length] };
    }));
  };

  const removePanel = (id: string) => setLayout((current) => current.filter((item) => item.id !== id));
  const addPanel = (id: PanelId) => { setLayout((current) => [...current, { id, w: PANEL_CATALOG[id].defaultW }]); setAddOpen(false); };
  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  if (loading) {
    return (
      <div className="console-root console-root--light">
        <div className="cp-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`console-root console-root--${theme} console-root--d-${density}`}>
      <ConsoleTopBar
        addOpen={addOpen}
        onAdd={() => setAddOpen((c) => !c)}
        availablePanels={availablePanels}
        onAddPanel={addPanel}
        onCloseAdd={() => setAddOpen(false)}
        onReset={resetLayout}
        theme={theme}
        setTheme={setTheme}
        onAddProject={() => { setEditingProject(null); setShowProjectModal(true); }}
        onAddRisk={() => setShowRiskModal(true)}
        onSignOut={() => signOut()}
        onGenerateMoves={generateMoves}
        generatingMoves={generatingMoves}
        onWorkspaces={() => setShowWorkspaceModal(true)}
        onImport={() => setShowIntegrationModal(true)}
        userName={session?.user?.name || ''}
        hasProjects={projects.length > 0}
        workspaceName={workspaces.length > 0 ? workspaces[0].name : ''}
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
                <panel.Component
                  pinnedProjectId={pinnedId}
                  onPin={setPinnedId}
                  density={density}
                  projects={projects}
                  risks={risks}
                  portfolio={portfolio}
                  onAddProject={() => { setEditingProject(null); setShowProjectModal(true); }}
                  onEditProject={openEditProject}
                  onDeleteProject={handleDeleteProject}
                  onAddRisk={() => setShowRiskModal(true)}
                  onDeleteRisk={handleDeleteRisk}
                  onViewProject={(id: string) => router.push(`/project/${id}`)}
                  userName={session?.user?.name || ''}
                />
              </PanelShell>
            </div>
          );
        })}

        {draggingId && (
          <div
            className="console-cell w-12 console-endzone"
            onDragOver={(event) => { event.preventDefault(); setOverId('__end__'); }}
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

      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          onSave={handleSaveProject}
          onClose={() => { setShowProjectModal(false); setEditingProject(null); }}
        />
      )}
      {showRiskModal && (
        <RiskModal
          projects={projects}
          defaultProjectId={pinnedId}
          onSave={handleSaveRisk}
          onClose={() => setShowRiskModal(false)}
        />
      )}
      {showWorkspaceModal && (
        <WorkspaceModal
          workspaces={workspaces}
          onClose={() => setShowWorkspaceModal(false)}
          onRefresh={fetchData}
        />
      )}
      {showIntegrationModal && (
        <IntegrationModal
          onClose={() => setShowIntegrationModal(false)}
          onImported={fetchData}
          workspaceId={workspaces[0]?.id}
        />
      )}
    </div>
  );
}

// ── Top Bar ────────────────────────────────────────────────────────────────
function ConsoleTopBar({
  addOpen, onAdd, availablePanels, onAddPanel, onCloseAdd, onReset,
  theme, setTheme, onAddProject, onAddRisk, onSignOut, onGenerateMoves, generatingMoves,
  onWorkspaces, onImport, userName, hasProjects, workspaceName,
}: {
  addOpen: boolean;
  onAdd: () => void;
  availablePanels: PanelId[];
  onAddPanel: (id: PanelId) => void;
  onCloseAdd: () => void;
  onReset: () => void;
  theme: Theme;
  setTheme: (v: Theme) => void;
  onAddProject: () => void;
  onAddRisk: () => void;
  onSignOut: () => void;
  onGenerateMoves: () => void;
  generatingMoves: boolean;
  onWorkspaces: () => void;
  onImport: () => void;
  userName: string;
  hasProjects: boolean;
  workspaceName: string;
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
          {workspaceName && (
            <>
              <span className="console-bc-key">team</span>
              <span className="console-bc-val">{workspaceName}</span>
            </>
          )}
          <span className="console-bc-key">pm</span>
          <span className="console-bc-val">{userName || 'console'}</span>
        </div>
      </div>
      <div className="console-top-c">
        <button className="console-tbtn" onClick={onAddProject}>
          {TLIcon.plus(11)}<span>new project</span>
        </button>
        {hasProjects && (
          <button className="console-tbtn" onClick={onAddRisk}>
            {TLIcon.plus(11)}<span>log risk</span>
          </button>
        )}
        <button className="console-tbtn" onClick={onImport}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3.5 5.5L6 8l2.5-2.5M2 10h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>import</span>
        </button>
        {hasProjects && (
          <button className="console-tbtn" onClick={onGenerateMoves} disabled={generatingMoves}>
            {TLIcon.spark(11)}<span>{generatingMoves ? 'generating...' : 'AI moves'}</span>
          </button>
        )}
      </div>
      <div className="console-top-r">
        <div className="console-add-wrap">
          <button className={`console-tbtn ${addOpen ? 'is-on' : ''}`} onClick={onAdd} disabled={availablePanels.length === 0}>
            <span>{TLIcon.plus(11)}</span>
            <span>panels</span>
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
        <button className="console-tbtn" onClick={onWorkspaces} title="Workspaces">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.1" /><circle cx="8.5" cy="4" r="2" stroke="currentColor" strokeWidth="1.1" /><circle cx="6.25" cy="8" r="2" stroke="currentColor" strokeWidth="1.1" /></svg>
          <span>team</span>
        </button>
        <button className="console-tbtn" onClick={onReset} title="Reset layout">{TLIcon.refresh(12)}</button>
        <button
          className="console-tbtn console-theme-toggle"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'}`}
        >
          {theme === 'light' ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M9.5 7.5A4 4 0 014.5 2.5 4 4 0 1010 7.5z" fill="currentColor" /></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="2.2" fill="currentColor" /><path d="M6 1v1.4M6 9.6V11M1 6h1.4M9.6 6H11M2.5 2.5l1 1M8.5 8.5l1 1M2.5 9.5l1-1M8.5 3.5l1-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
          )}
        </button>
        <button className="console-tbtn" onClick={onSignOut} title="Sign out">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M4.5 10.5H2.5a1 1 0 01-1-1v-7a1 1 0 011-1h2M8 8.5l2.5-2.5L8 3.5M4.5 6h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </header>
  );
}
