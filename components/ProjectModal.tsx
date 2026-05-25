'use client';

import { useState, useEffect } from 'react';
import type { ProjectRecord } from '@/lib/console-data';

type ProjectModalProps = {
  project?: ProjectRecord | null;
  onSave: (data: Record<string, string | number>) => void;
  onClose: () => void;
};

const STAGES = ['Planning', 'Delivery', 'Commissioning', 'Handover'];
const RISK_LEVELS = ['Low', 'Medium', 'High'];
const STATES = ['good', 'warn', 'bad'];

export function ProjectModal({ project, onSave, onClose }: ProjectModalProps) {
  const isEdit = !!project;

  const [code, setCode] = useState(project?.code || '');
  const [name, setName] = useState(project?.name || '');
  const [client, setClient] = useState(project?.client || '');
  const [stage, setStage] = useState(project?.stage || 'Planning');
  const [owner, setOwner] = useState(project?.owner || '');
  const [contact, setContact] = useState(project?.contact || '');
  const [channel, setChannel] = useState(project?.channel || 'Email');
  const [health, setHealth] = useState(project?.health ?? 100);
  const [risk, setRisk] = useState<string>(project?.risk || 'Low');
  const [next, setNext] = useState(project?.next || '');
  const [nextWhen, setNextWhen] = useState(project?.nextWhen || '');
  const [budget, setBudget] = useState(project?.budget || 'On track');
  const [budgetState, setBudgetState] = useState<string>(project?.budgetState || 'good');
  const [schedule, setSchedule] = useState(project?.schedule || 'On track');
  const [scheduleState, setScheduleState] = useState<string>(project?.scheduleState || 'good');
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
    await onSave({
      code, name, client, stage, owner, contact, channel,
      health, risk, next, nextWhen, budget, budgetState, schedule, scheduleState,
    });
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit project' : 'New project'}</h2>
          <button className="console-panel-btn" onClick={onClose} type="button">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="modal-grid">
            <label className="modal-field">
              <span>Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ACC-VIN" required />
            </label>
            <label className="modal-field">
              <span>Project name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enterprise Access Control Upgrade" required />
            </label>
            <label className="modal-field">
              <span>Client</span>
              <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="St Vincent Health" required />
            </label>
            <label className="modal-field">
              <span>Stage</span>
              <select value={stage} onChange={(e) => setStage(e.target.value)}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="modal-field">
              <span>Owner</span>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Your name" />
            </label>
            <label className="modal-field">
              <span>Client contact</span>
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Amanda Lee" />
            </label>
            <label className="modal-field">
              <span>Channel</span>
              <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Email" />
            </label>
            <label className="modal-field">
              <span>Risk</span>
              <select value={risk} onChange={(e) => setRisk(e.target.value)}>
                {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>

          {isEdit && (
            <>
              <div className="modal-divider" />
              <div className="modal-grid">
                <label className="modal-field">
                  <span>Health (0–100)</span>
                  <input type="number" min={0} max={100} value={health} onChange={(e) => setHealth(Number(e.target.value))} />
                </label>
                <label className="modal-field">
                  <span>Next action</span>
                  <input value={next} onChange={(e) => setNext(e.target.value)} placeholder="Client witness test pack due" />
                </label>
                <label className="modal-field">
                  <span>Next when</span>
                  <input value={nextWhen} onChange={(e) => setNextWhen(e.target.value)} placeholder="3:00 PM" />
                </label>
                <label className="modal-field">
                  <span>Budget</span>
                  <div className="modal-field-row">
                    <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="+4.2%" />
                    <select value={budgetState} onChange={(e) => setBudgetState(e.target.value)}>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </label>
                <label className="modal-field">
                  <span>Schedule</span>
                  <div className="modal-field-row">
                    <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="+3 days" />
                    <select value={scheduleState} onChange={(e) => setScheduleState(e.target.value)}>
                      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </label>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="cp-btn cp-btn--primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
