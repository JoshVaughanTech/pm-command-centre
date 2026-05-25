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

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [risks, setRisks] = useState<RiskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showRisk, setShowRisk] = useState(false);

  const fetchData = useCallback(async () => {
    const [projRes, riskRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/risks'),
    ]);
    if (projRes.ok) {
      const projects: ProjectRecord[] = await projRes.json();
      setProject(projects.find((p) => p.id === projectId) || null);
    }
    if (riskRes.ok) {
      const allRisks: RiskRecord[] = await riskRes.json();
      setRisks(allRisks.filter((r) => r.projectId === projectId));
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
            <span className="console-brand-mark">T/L</span>
          </div>
          <div className="console-breadcrumb">
            <span className="console-bc-key">project</span>
            <span className="console-bc-val">{project.code}</span>
          </div>
        </div>
        <div className="console-top-r">
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
