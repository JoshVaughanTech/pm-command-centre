'use client';

import { useState, useEffect } from 'react';
import type { ProjectRecord } from '@/lib/console-data';

type RiskModalProps = {
  projects: ProjectRecord[];
  defaultProjectId?: string;
  onSave: (data: { projectId: string; title: string; owner: string; severity: string; impact: string; action: string }) => void;
  onClose: () => void;
};

export function RiskModal({ projects, defaultProjectId, onSave, onClose }: RiskModalProps) {
  const [projectId, setProjectId] = useState(defaultProjectId || projects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [severity, setSeverity] = useState('med');
  const [impact, setImpact] = useState('');
  const [action, setAction] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ projectId, title, owner, severity, impact, action });
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Log risk</h2>
          <button className="console-panel-btn" onClick={onClose} type="button">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="modal-grid">
            <label className="modal-field">
              <span>Project</span>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </label>
            <label className="modal-field">
              <span>Risk title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="IT dependency on switch-port config" required />
            </label>
            <label className="modal-field">
              <span>Severity</span>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="high">High</option>
                <option value="med">Medium</option>
              </select>
            </label>
            <label className="modal-field">
              <span>Owner</span>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who owns the mitigation?" />
            </label>
            <label className="modal-field">
              <span>Impact</span>
              <input value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="Could delay commissioning 48h" />
            </label>
            <label className="modal-field">
              <span>Mitigation action</span>
              <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Call IT before noon" />
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="cp-btn cp-btn--primary" disabled={saving}>
              {saving ? 'Saving...' : 'Log risk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
