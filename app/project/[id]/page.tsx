'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TLIcon } from '@/components/icons';
import { ProjectModal } from '@/components/ProjectModal';
import { RiskModal } from '@/components/RiskModal';
import type { ProjectRecord, RiskRecord } from '@/lib/console-data';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  type TaskItem = { id: string; title: string; assignee: string; status: string; priority: string; dueDate: string | null };
  type TimeItem = { id: string; hours: number; date: string; note: string };
  type FinItem = { id: string; type: string; amount: number; description: string; reference: string; date: string; status: string };

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [risks, setRisks] = useState<RiskRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeItem[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [financials, setFinancials] = useState<FinItem[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showRisk, setShowRisk] = useState(false);
  const [, setShareUrl] = useState('');

  // Quick-add states
  const [newTask, setNewTask] = useState('');
  const [newHours, setNewHours] = useState('');
  const [newHoursNote, setNewHoursNote] = useState('');
  const [newFinAmt, setNewFinAmt] = useState('');
  const [newFinDesc, setNewFinDesc] = useState('');
  const [newFinType, setNewFinType] = useState('cost');

  const fetchData = useCallback(async () => {
    const [projRes, riskRes, taskRes, timeRes, finRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/risks'),
      fetch(`/api/tasks?projectId=${projectId}`),
      fetch(`/api/time?projectId=${projectId}`),
      fetch(`/api/financials?projectId=${projectId}`),
    ]);
    if (projRes.ok) {
      const projects: ProjectRecord[] = await projRes.json();
      setProject(projects.find((p) => p.id === projectId) || null);
    }
    if (riskRes.ok) {
      const allRisks: RiskRecord[] = await riskRes.json();
      setRisks(allRisks.filter((r) => r.projectId === projectId));
    }
    if (taskRes.ok) setTasks(await taskRes.json());
    if (timeRes.ok) {
      const data = await timeRes.json();
      setTimeEntries(data.entries || []);
      setTotalHours(data.totals?.[0]?.totalHours || 0);
    }
    if (finRes.ok) {
      const data = await finRes.json();
      setFinancials(data.entries || []);
      const costs = (data.totals || []).filter((t: { type: string }) => t.type === 'cost').reduce((s: number, t: { total: number }) => s + t.total, 0);
      setTotalCost(costs);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(data: Record<string, string | number>) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) { await fetchData(); setShowEdit(false); }
  }

  async function handleAddRisk(data: { projectId: string; title: string; owner: string; severity: string; impact: string; action: string }) {
    const res = await fetch('/api/risks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) { await fetchData(); setShowRisk(false); }
  }

  async function handleDeleteRisk(id: string) {
    const res = await fetch(`/api/risks/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchData();
  }

  async function handleDelete() {
    if (!confirm('Delete this project and all its risks?')) return;
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (res.ok) router.push('/');
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, title: newTask }) });
    setNewTask('');
    await fetchData();
  }

  async function toggleTask(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await fetch(`/api/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    await fetchData();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await fetchData();
  }

  async function addTime(e: React.FormEvent) {
    e.preventDefault();
    if (!newHours) return;
    await fetch('/api/time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, hours: parseFloat(newHours), note: newHoursNote }) });
    setNewHours(''); setNewHoursNote('');
    await fetchData();
  }

  async function addFinancial(e: React.FormEvent) {
    e.preventDefault();
    if (!newFinAmt) return;
    await fetch('/api/financials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, type: newFinType, amount: parseFloat(newFinAmt), description: newFinDesc }) });
    setNewFinAmt(''); setNewFinDesc('');
    await fetchData();
  }

  if (loading) return <div className="console-root"><div className="cp-loading">Loading...</div></div>;
  if (!project) return <div className="console-root"><div className="cp-loading">Project not found.</div></div>;

  const healthCls = project.health < 50 ? 'bad' : project.health < 75 ? 'warn' : 'good';

  return (
    <div className="console-root">
      <header className="console-top">
        <div className="console-top-l">
          <button className="console-tbtn" onClick={() => router.push('/')}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M8 1.5L3.5 6 8 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>back</span>
          </button>
          <span className="console-top-sep" />
          <div className="console-brand">
            <span className="console-brand-mark">SNTRI</span>
          </div>
          <div className="console-breadcrumb">
            <span className="console-bc-key">project</span>
            <span className="console-bc-val">{project.code}</span>
          </div>
        </div>
        <div className="console-top-r">
          <button className="console-tbtn" onClick={async () => {
            const pw = prompt('Set a password for the client portal:');
            if (!pw) return;
            const res = await fetch('/api/shares', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId, password: pw }),
            });
            if (res.ok) {
              const data = await res.json();
              setShareUrl(data.url);
              navigator.clipboard.writeText(data.url);
              alert(`Link copied to clipboard!\n\n${data.url}\n\nPassword: ${pw}`);
            }
          }}>share with client</button>
          <button className="console-tbtn" onClick={() => setShowEdit(true)}>edit</button>
          <button className="console-tbtn" onClick={handleDelete} style={{ color: 'var(--tl-bad)' }}>delete</button>
        </div>
      </header>

      <div className="pd-layout">
        {/* ── Hero ────────────────────────────────────── */}
        <div className="pd-hero">
          <div className="pd-hero-eyebrow">
            <span className={`cp-rdot cp-rdot--${project.risk.toLowerCase()}`} />
            <span className="cp-mono">{project.code}</span>
            <span className="cp-mid-dot" />
            <span className="cp-stage">{project.stage.toLowerCase()}</span>
            <span className={`cp-pill cp-pill--${project.risk.toLowerCase()}`}>{project.risk}</span>
          </div>
          <h1 className="pd-title">{project.name}</h1>
          <div className="pd-subtitle">{project.client}</div>
        </div>

        <div className="pd-grid">
          {/* ── Key metrics ──────────────────────────── */}
          <div className="pd-card">
            <div className="pd-card-head">project health</div>
            <div className="pd-metrics">
              <div className="pd-metric">
                <div className={`pd-metric-val cp-state--${healthCls}`}>{project.health}<span className="pd-metric-unit">%</span></div>
                <div className="pd-metric-lbl">health</div>
              </div>
              <div className="pd-metric">
                <div className={`pd-metric-val cp-state--${project.budgetState}`}>{project.budget}</div>
                <div className="pd-metric-lbl">budget</div>
              </div>
              <div className="pd-metric">
                <div className={`pd-metric-val cp-state--${project.scheduleState}`}>{project.schedule}</div>
                <div className="pd-metric-lbl">schedule</div>
              </div>
              <div className="pd-metric">
                <div className={`pd-metric-val`}>{project.comms}<span className="pd-metric-unit">%</span></div>
                <div className="pd-metric-lbl">comms</div>
              </div>
            </div>
          </div>

          {/* ── Details ──────────────────────────────── */}
          <div className="pd-card">
            <div className="pd-card-head">details</div>
            <div className="cp-pinned-kv">
              <div><span>owner</span><b>{project.owner || '—'}</b></div>
              <div><span>contact</span><b>{project.contact || '—'}</b></div>
              <div><span>channel</span><b>{project.channel || '—'}</b></div>
              <div><span>next</span><b>{project.nextWhen || '—'}</b></div>
              <div><span>last touch</span><b>{project.lastTouch}</b></div>
              <div><span>phase</span><b>{project.phase}/8</b></div>
            </div>
          </div>

          {/* ── Next action ──────────────────────────── */}
          {project.next && (
            <div className="pd-card">
              <div className="pd-card-head">next action</div>
              <div className="pd-next">
                <div className="pd-next-when">{project.nextWhen}</div>
                <div className="pd-next-what">{project.next}</div>
              </div>
            </div>
          )}

          {/* ── AI move ──────────────────────────────── */}
          {project.move && (
            <div className="pd-card pd-card--move">
              <div className="pd-card-head">{TLIcon.spark(11)} recommended move</div>
              <div className="pd-move">
                <div className="pd-move-h">{project.move}</div>
                <div className="pd-move-p">{project.moveBody}</div>
              </div>
            </div>
          )}

          {/* ── Risks ────────────────────────────────── */}
          <div className="pd-card pd-card--wide">
            <div className="pd-card-head">
              <span>open risks ({risks.length})</span>
              <button className="console-panel-btn" onClick={() => setShowRisk(true)}>{TLIcon.plus(10)}</button>
            </div>
            {risks.length === 0 ? (
              <div className="cp-empty">No open risks on this project.</div>
            ) : (
              <table className="cp-table cp-table--tight">
                <thead>
                  <tr>
                    <th className="cp-th-tight">sev</th>
                    <th>title</th>
                    <th>owner</th>
                    <th>impact</th>
                    <th>mitigation</th>
                    <th className="cp-th-num">age</th>
                    <th className="cp-th-tight"></th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r) => (
                    <tr key={r.id}>
                      <td><span className={`cp-sev cp-sev--${r.severity}`}>{r.severity === 'high' ? 'H' : 'M'}</span></td>
                      <td className="cp-td-name">{r.title}</td>
                      <td>{r.owner}</td>
                      <td>{r.impact}</td>
                      <td>{r.action}</td>
                      <td className="cp-td-num">{r.age}</td>
                      <td><button className="console-panel-btn" onClick={() => handleDeleteRisk(r.id)} title="Resolve">&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Tasks ────────────────────────────────── */}
          <div className="pd-card pd-card--wide">
            <div className="pd-card-head">
              <span>tasks ({tasks.length}{tasks.filter(t => t.status === 'done').length > 0 ? ` · ${tasks.filter(t => t.status === 'done').length} done` : ''})</span>
            </div>
            <div style={{ padding: '10px 14px' }}>
              <form onSubmit={addTask} style={{ display: 'flex', gap: 8, marginBottom: tasks.length > 0 ? 10 : 0 }}>
                <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task..." className="portal-msg-input" style={{ flex: 1 }} />
                <button type="submit" className="cp-btn cp-btn--primary" disabled={!newTask.trim()}>Add</button>
              </form>
              {tasks.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--tl-line-2)' }}>
                  <button onClick={() => toggleTask(t.id, t.status)} style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--tl-line-strong)', background: t.status === 'done' ? 'var(--tl-good)' : 'transparent', flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 10 }}>
                    {t.status === 'done' && '✓'}
                  </button>
                  <span style={{ flex: 1, fontSize: 12.5, textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? 'var(--tl-text-3)' : 'var(--tl-text)' }}>{t.title}</span>
                  {t.dueDate && <span className="cp-mono" style={{ fontSize: 10, color: 'var(--tl-text-4)' }}>{t.dueDate}</span>}
                  {t.assignee && <span style={{ fontSize: 11, color: 'var(--tl-text-3)' }}>{t.assignee}</span>}
                  <button className="console-panel-btn" onClick={() => deleteTask(t.id)}>&times;</button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Time tracking ────────────────────────── */}
          <div className="pd-card">
            <div className="pd-card-head">
              <span>time logged</span>
              <span className="cp-mono" style={{ fontSize: 13, fontWeight: 500 }}>{totalHours.toFixed(1)}h</span>
            </div>
            <div style={{ padding: '10px 14px' }}>
              <form onSubmit={addTime} style={{ display: 'flex', gap: 6, marginBottom: timeEntries.length > 0 ? 10 : 0 }}>
                <input type="number" step="0.5" min="0.5" value={newHours} onChange={(e) => setNewHours(e.target.value)} placeholder="Hrs" className="portal-msg-input" style={{ width: 60 }} />
                <input value={newHoursNote} onChange={(e) => setNewHoursNote(e.target.value)} placeholder="What did you work on?" className="portal-msg-input" style={{ flex: 1 }} />
                <button type="submit" className="cp-btn" disabled={!newHours}>Log</button>
              </form>
              {timeEntries.slice(0, 5).map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--tl-line-2)', fontSize: 12 }}>
                  <span>{e.note || 'Time logged'}</span>
                  <span className="cp-mono" style={{ color: 'var(--tl-text-3)' }}>{e.hours}h · {e.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Financials ───────────────────────────── */}
          <div className="pd-card">
            <div className="pd-card-head">
              <span>financials</span>
              <span className="cp-mono" style={{ fontSize: 13, fontWeight: 500 }}>${totalCost.toLocaleString()}</span>
            </div>
            <div style={{ padding: '10px 14px' }}>
              <form onSubmit={addFinancial} style={{ display: 'flex', gap: 6, marginBottom: financials.length > 0 ? 10 : 0 }}>
                <select value={newFinType} onChange={(e) => setNewFinType(e.target.value)} className="portal-msg-input" style={{ width: 80 }}>
                  <option value="cost">Cost</option>
                  <option value="po">PO</option>
                  <option value="invoice">Invoice</option>
                  <option value="payment">Payment</option>
                </select>
                <input type="number" step="0.01" value={newFinAmt} onChange={(e) => setNewFinAmt(e.target.value)} placeholder="$" className="portal-msg-input" style={{ width: 80 }} />
                <input value={newFinDesc} onChange={(e) => setNewFinDesc(e.target.value)} placeholder="Description" className="portal-msg-input" style={{ flex: 1 }} />
                <button type="submit" className="cp-btn" disabled={!newFinAmt}>Add</button>
              </form>
              {financials.slice(0, 5).map((f) => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--tl-line-2)', fontSize: 12 }}>
                  <span><span className="cp-stage">{f.type}</span> {f.description}</span>
                  <span className="cp-mono" style={{ color: 'var(--tl-text-3)' }}>${f.amount.toLocaleString()} · {f.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <ProjectModal project={project} onSave={handleSave} onClose={() => setShowEdit(false)} />
      )}
      {showRisk && project && (
        <RiskModal projects={[project]} defaultProjectId={project.id} onSave={handleAddRisk} onClose={() => setShowRisk(false)} />
      )}
    </div>
  );
}
