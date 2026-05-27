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
import { ComposeModal } from './ComposeModal';
import { CommandPalette } from './CommandPalette';
import { NotificationsDropdown, type Notification } from './NotificationsDropdown';
import { Onboarding } from './Onboarding';
import { SkeletonDashboard } from './Skeleton';
import { AgentPanel } from './AgentPanel';
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
  onCompose?: (data: { to?: string; subject?: string; body?: string; projectId?: string }) => void;
  inboxEmails?: Array<{ id: string; from: string; org: string; subj: string; snip: string; at: string; project: string; state: 'new' | 'reply' | 'stale' | 'overdue' }>;
  emailConnected?: boolean;
  userName?: string;
};

type PanelDefinition = {
  title: string;
  defaultW: GridWidth;
  allowedW: GridWidth[];
  Component: ComponentType<PanelProps>;
};

const STORAGE_LAYOUT = 'sntri.console.layout.v1';
const STORAGE_PINNED = 'sntri.console.pinned.v1';
const STORAGE_THEME = 'sntri.console.theme.v1';
const STORAGE_DENSITY = 'sntri.console.density.v1';

const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: 'daybook', w: 12 },
  { id: 'metrics', w: 12 },
  { id: 'moves', w: 8 },
  { id: 'pinned', w: 4 },
  { id: 'projects', w: 8 },
  { id: 'risks', w: 4 },
  { id: 'comms', w: 12 },
];

const PANEL_CATALOG: Record<PanelId, PanelDefinition> = {
  daybook: {
    title: 'Today',
    defaultW: 12,
    allowedW: [12],
    Component: function DaybookPanel({ projects, risks }) {
      const now = new Date();
      const dayName = getDayName(now);
      const { day, month, year } = getDateDisplay(now);
      const lowHealth = projects.filter((p) => p.health < 60).length;
      const quietClients = projects.filter((p) => p.comms < 40).length;

      let lede = '';
      if (projects.length === 0) {
        lede = 'Welcome to SNTRI. Add your first project to get started.';
      } else {
        const parts: string[] = [];
        if (lowHealth > 0) parts.push(`${lowHealth} project${lowHealth > 1 ? 's' : ''} need${lowHealth === 1 ? 's' : ''} attention`);
        if (quietClients > 0) parts.push(`${quietClients} client${quietClients > 1 ? 's have' : ' has'} been quiet`);
        if (risks.filter((r) => r.severity === 'high').length > 0) parts.push(`${risks.filter((r) => r.severity === 'high').length} high-severity risk${risks.filter((r) => r.severity === 'high').length > 1 ? 's' : ''} open`);
        lede = parts.length > 0 ? parts.join('. ') + '.' : `All ${projects.length} projects are tracking well. No urgent actions today.`;
      }

      return (
        <div className="db-compact">
          <div className="db-date">
            <div className="db-date-day">{day}</div>
            <div className="db-date-month">{dayName} {month} {year}</div>
          </div>
          <div className="db-lede">{lede}</div>
        </div>
      );
    },
  },
  metrics: {
    title: 'Portfolio',
    defaultW: 12,
    allowedW: [12, 8, 6],
    Component: function MetricsPanel({ portfolio }) {
      const healthColor = portfolio.health >= 75 ? 'var(--tl-good)' : portfolio.health >= 50 ? 'var(--tl-warn)' : 'var(--tl-bad)';
      const circumference = 2 * Math.PI * 18;
      const healthOffset = circumference - (portfolio.health / 100) * circumference;

      return (
        <div className="vm-grid">
          <div className="vm-cell">
            <div className="vm-ring">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="none" stroke="var(--tl-line-2)" strokeWidth="3" />
                <circle cx="24" cy="24" r="18" fill="none" stroke={healthColor} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={healthOffset} />
              </svg>
              <div className="vm-ring-val" style={{ color: healthColor }}>{portfolio.health}</div>
            </div>
            <div className="vm-lbl">health</div>
          </div>
          <div className="vm-cell">
            <div className="vm-val">{portfolio.active}</div>
            <div className="vm-lbl">projects</div>
          </div>
          <div className="vm-cell">
            <div className="vm-val" style={{ color: portfolio.risksHigh > 0 ? 'var(--tl-bad)' : undefined }}>{portfolio.risksHigh}<span className="vm-val-unit">/{portfolio.risksOpen}</span></div>
            <div className="vm-lbl">high / risks</div>
          </div>
          <div className="vm-cell">
            <div className="vm-val" style={{ color: portfolio.updatesDue > 0 ? 'var(--tl-warn)' : undefined }}>{portfolio.updatesDue}</div>
            <div className="vm-lbl">comms due</div>
          </div>
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
        <ol className="cm-list">
          {sorted.map((project, index) => (
            <li key={project.id} className="cm-item">
              <div className="cm-num">{index + 1}</div>
              <div className="cm-body">
                <div className="cm-meta">
                  <span className={`cp-pill cp-pill--${project.risk.toLowerCase()}`}>{project.risk}</span>
                  <span>{project.code}</span>
                  <span>{project.client}</span>
                </div>
                <div className="cm-title">{project.move || project.next || `Review ${project.code}`}</div>
              </div>
            </li>
          ))}
        </ol>
      );
    },
  },
  projects: {
    title: 'Projects',
    defaultW: 12,
    allowedW: [12, 8],
    Component: function ProjectsPanel({ projects, risks, pinnedProjectId, onPin, onAddProject, onViewProject }) {
      const sorted = useMemo(() => {
        return [...projects].sort((a, b) => a.health - b.health);
      }, [projects]);

      if (projects.length === 0) {
        return (
          <div className="cp-empty">
            <p>No projects yet.</p>
            <button className="cp-btn cp-btn--primary" onClick={onAddProject}>{TLIcon.plus(11)}<span>Add your first project</span></button>
          </div>
        );
      }

      return (
        <div className="pc-grid">
          {sorted.map((project) => {
            const riskCount = risks.filter((r) => r.project === project.code).length;
            const healthCls = project.health < 50 ? 'bad' : project.health < 75 ? 'warn' : 'good';

            return (
              <div
                key={project.id}
                className={`pc-card pc-card--${project.risk.toLowerCase()} ${project.id === pinnedProjectId ? 'is-sel' : ''}`}
                onClick={() => onPin?.(project.id)}
                onDoubleClick={() => onViewProject?.(project.id)}
              >
                <div className="pc-top">
                  <span className="pc-code">{project.code}</span>
                  <span className={`pc-health cp-state--${healthCls}`}>{project.health}%</span>
                </div>
                <div className="pc-name">{project.name}</div>
                <div className="pc-client">{project.client}</div>
                <div className="pc-bar-wrap">
                  <div className={`pc-bar-fill pc-bar-fill--${healthCls}`} style={{ width: `${project.health}%` }} />
                </div>
                <div className="pc-row">
                  <span className="pc-tag">{project.stage.toLowerCase()}</span>
                  <span className={`cp-state--${project.scheduleState}`}>{project.schedule}</span>
                  {riskCount > 0 && <span className="cp-state--bad">{riskCount} risk{riskCount > 1 ? 's' : ''}</span>}
                </div>
                {(project.move || project.next) && (
                  <div className="pc-action">
                    <span className="pc-action-arrow">&rarr;</span>
                    <span>{project.move || project.next}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
    Component: function InboxPanel({ inboxEmails, emailConnected }) {
      if (!emailConnected) {
        return (
          <div className="cp-empty">
            <p>Connect your email to see project-linked threads.</p>
            <p className="cp-empty-sub">Emails are auto-matched to your projects by client name, project code, and contacts.</p>
            <div className="cp-email-connect">
              <a href="/api/email/connect/microsoft" className="cp-btn cp-btn--primary cp-email-btn">
                <svg width="14" height="14" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
                <span>Connect Microsoft 365</span>
              </a>
              <a href="/api/email/connect/google" className="cp-btn cp-email-btn">
                <svg width="14" height="14" viewBox="0 0 48 48"><path d="M43.6 20.1H42V20H24v8h11.3C33.6 33.4 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.7-.4-3.9z" fill="#FFC107"/><path d="M6.3 14.7l6.6 4.8C14.5 15.5 18.8 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/><path d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.5-11.1-8.2l-6.5 5C9.5 39.6 16.2 44 24 44z" fill="#4CAF50"/><path d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C37 39.1 44 34 44 24c0-1.3-.2-2.7-.4-3.9z" fill="#1976D2"/></svg>
                <span>Connect Gmail</span>
              </a>
            </div>
          </div>
        );
      }
      if (!inboxEmails || inboxEmails.length === 0) {
        return <div className="cp-empty"><p>No recent emails found.</p></div>;
      }
      return (
        <ul className="cp-inbox">
          {inboxEmails.map((item, index) => (
            <li key={`${item.id}-${index}`} className={`cp-inbox-row cp-inbox-row--${item.state}`}>
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
              {item.project && <div className="cp-inbox-tag">{item.project}</div>}
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
    Component: function PinnedPanel({ projects, pinnedProjectId, onViewProject, onCompose }) {
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
                <div className="cp-pinned-move-actions">
                  <button className="cp-btn cp-btn--primary" onClick={() => onCompose?.({
                    subject: `${selected.code} — ${selected.move || selected.next || 'Project update'}`,
                    body: selected.moveBody || `Hi,\n\nProject update for ${selected.name}.\n\nBest regards`,
                    projectId: selected.id,
                  })}>{TLIcon.send(11)}<span>draft &amp; send</span></button>
                </div>
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
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState<{ to?: string; subject?: string; body?: string; projectId?: string }>({});
  const [inboxEmails, setInboxEmails] = useState<Array<{ id: string; from: string; org: string; subj: string; snip: string; at: string; project: string; state: 'new' | 'reply' | 'stale' | 'overdue' }>>([]);
  const [emailConnected, setEmailConnected] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; slug: string; role: string; projectCount: number; members: Array<{ id: string; name: string; email: string; role: string }> }>>([]);
  const [generatingMoves, setGeneratingMoves] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAgent, setShowAgent] = useState(false);
  const [seedingData, setSeedingData] = useState(false);

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

      // Fetch emails (non-blocking)
      fetch('/api/email/inbox').then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setInboxEmails(data.emails || []);
          setEmailConnected(data.connected?.microsoft || data.connected?.google || false);
        }
      }).catch(() => {});
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

  // ── keyboard shortcuts ───────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }

      // Single key shortcuts (only when no modifier)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'n': e.preventDefault(); setEditingProject(null); setShowProjectModal(true); break;
        case 'r': e.preventDefault(); setShowRiskModal(true); break;
        case '/': e.preventDefault(); setShowCommandPalette(true); break;
        case 'a': e.preventDefault(); setShowAgent(true); break;
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── show onboarding for new users ───────────────────────────
  useEffect(() => {
    if (!loading && projects.length === 0) {
      const dismissed = window.localStorage.getItem('sntri.onboarding.dismissed');
      if (!dismissed) setShowOnboarding(true);
    }
  }, [loading, projects.length]);

  // ── generate notifications from data ────────────────────────
  useEffect(() => {
    const notifs: Notification[] = [];
    // Stale comms
    for (const p of projects) {
      if (p.comms < 40) {
        notifs.push({ id: `stale-${p.id}`, type: 'stale', title: `Comms stale on ${p.code}`, detail: `${p.client} — last touch ${p.lastTouch}`, at: p.lastTouch, read: false });
      }
    }
    // High risks
    for (const r of risks) {
      if (r.severity === 'high') {
        notifs.push({ id: `risk-${r.id}`, type: 'risk', title: `High risk: ${r.title}`, detail: r.project, at: r.age, read: false });
      }
    }
    setNotifications(notifs);
  }, [projects, risks]);

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

  // ── command palette actions ───────────────────────────────────
  function handleCommandAction(action: string) {
    switch (action) {
      case 'add-project': setEditingProject(null); setShowProjectModal(true); break;
      case 'add-risk': setShowRiskModal(true); break;
      case 'generate-moves': generateMoves(); break;
      case 'import': setShowIntegrationModal(true); break;
      case 'toggle-theme': setTheme(theme === 'light' ? 'dark' : 'light'); break;
      case 'workspaces': setShowWorkspaceModal(true); break;
    }
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
      <div className="console-root console-root--light console-root--d-compact">
        <SkeletonDashboard />
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className={`console-root console-root--${theme}`}>
        <Onboarding
          userName={session?.user?.name || ''}
          hasProjects={projects.length > 0}
          onAddProject={() => { setShowOnboarding(false); setEditingProject(null); setShowProjectModal(true); }}
          onImport={() => { setShowOnboarding(false); setShowIntegrationModal(true); }}
          onGenerateMoves={() => { setShowOnboarding(false); generateMoves(); }}
          onDismiss={() => { setShowOnboarding(false); window.localStorage.setItem('sntri.onboarding.dismissed', '1'); }}
          onSeed={async () => {
            const res = await fetch('/api/seed', { method: 'POST' });
            if (res.ok) { await fetchData(); setShowOnboarding(false); window.localStorage.setItem('sntri.onboarding.dismissed', '1'); }
          }}
        />
        {showProjectModal && (
          <ProjectModal project={editingProject} onSave={async (data) => { await handleSaveProject(data); setShowOnboarding(projects.length === 0); }} onClose={() => setShowProjectModal(false)} />
        )}
        {showIntegrationModal && (
          <IntegrationModal onClose={() => { setShowIntegrationModal(false); setShowOnboarding(projects.length === 0); }} onImported={fetchData} workspaceId={workspaces[0]?.id} />
        )}
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
        onSeed={async () => {
          setSeedingData(true);
          try {
            const res = await fetch('/api/seed', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
              await fetchData();
              alert(`Created ${data.projects} projects, ${data.risks} risks, ${data.tasks} tasks`);
            } else {
              alert(`Seed failed: ${data.error || res.status}`);
            }
          } catch (err) {
            alert(`Seed error: ${err}`);
          }
          setSeedingData(false);
        }}
        seeding={seedingData}
        onCommandPalette={() => setShowCommandPalette(true)}
        onAgent={() => setShowAgent(true)}
        notifications={notifications}
        onMarkAllRead={() => setNotifications((n) => n.map((x) => ({ ...x, read: true })))}
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
                  onCompose={(data) => { setComposeData(data); setShowCompose(true); }}
                  inboxEmails={inboxEmails}
                  emailConnected={emailConnected}
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
      {showCompose && (
        <ComposeModal
          to={composeData.to}
          subject={composeData.subject}
          body={composeData.body}
          projectId={composeData.projectId}
          onClose={() => setShowCompose(false)}
          onSent={fetchData}
        />
      )}
      {showCommandPalette && (
        <CommandPalette
          projects={projects}
          onSelectProject={(id) => router.push(`/project/${id}`)}
          onAction={handleCommandAction}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
      {showAgent && (
        <AgentPanel onClose={() => setShowAgent(false)} onRefresh={fetchData} />
      )}
    </div>
  );
}

// ── Top Bar ────────────────────────────────────────────────────────────────
function ConsoleTopBar({
  addOpen, onAdd, availablePanels, onAddPanel, onCloseAdd, onReset,
  theme, setTheme, onAddProject, onAddRisk, onSignOut, onGenerateMoves, generatingMoves,
  onWorkspaces, onImport, onSeed, seeding, onCommandPalette, onAgent, notifications, onMarkAllRead, userName, hasProjects, workspaceName,
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
  onSeed: () => void;
  seeding: boolean;
  onCommandPalette: () => void;
  onAgent: () => void;
  notifications: Notification[];
  onMarkAllRead: () => void;
  userName: string;
  hasProjects: boolean;
  workspaceName: string;
}) {
  return (
    <header className="console-top">
      <div className="console-top-l">
        <div className="console-brand">
          <span className="console-brand-mark">SNTRI</span>
          <span className="console-brand-name">sntri</span>
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
        <button className="console-tbtn" onClick={onAgent}>
          {TLIcon.spark(11)}<span>agent</span>
        </button>
      </div>
      <div className="console-top-r">
        <button className="console-tbtn" onClick={onSeed} disabled={seeding}>
          <span>{seeding ? 'loading...' : 'demo data'}</span>
        </button>
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
        <button className="console-tbtn" onClick={onCommandPalette} title="Search (Ctrl+K)">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l4 4" /></svg>
        </button>
        <NotificationsDropdown notifications={notifications} onMarkRead={() => {}} onMarkAllRead={onMarkAllRead} onClickNotification={() => {}} />
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
