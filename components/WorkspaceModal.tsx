'use client';

import { useState, useEffect } from 'react';
import { TLIcon } from './icons';

type WorkspaceData = {
  id: string;
  name: string;
  slug: string;
  role: string;
  projectCount: number;
  members: Array<{ id: string; name: string; email: string; role: string }>;
};

type WorkspaceModalProps = {
  workspaces: WorkspaceData[];
  onClose: () => void;
  onRefresh: () => void;
};

export function WorkspaceModal({ workspaces, onClose, onRefresh }: WorkspaceModalProps) {
  const [tab, setTab] = useState<'list' | 'create' | 'invite'>('list');
  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteWorkspace, setInviteWorkspace] = useState(workspaces[0]?.id || '');
  const [inviteRole, setInviteRole] = useState('member');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setName('');
      setTab('list');
      onRefresh();
    } else {
      setMessage(data.error || 'Failed to create workspace');
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const res = await fetch(`/api/workspaces/${inviteWorkspace}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMessage(`Invited ${data.name} (${data.email})`);
      setInviteEmail('');
      onRefresh();
    } else {
      setMessage(data.error || 'Failed to invite');
    }
  }

  async function handleRemoveMember(workspaceId: string, memberId: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) onRefresh();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Workspaces</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`console-tbtn ${tab === 'list' ? 'is-on' : ''}`} onClick={() => setTab('list')}>teams</button>
            <button className={`console-tbtn ${tab === 'create' ? 'is-on' : ''}`} onClick={() => setTab('create')}>{TLIcon.plus(10)} new</button>
            {workspaces.length > 0 && (
              <button className={`console-tbtn ${tab === 'invite' ? 'is-on' : ''}`} onClick={() => setTab('invite')}>invite</button>
            )}
          </div>
          <button className="console-panel-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {message && <div className={`auth-error`} style={{ marginBottom: 12 }}>{message}</div>}

          {tab === 'list' && (
            <>
              {workspaces.length === 0 ? (
                <div className="cp-empty">
                  <p>No workspaces yet.</p>
                  <p className="cp-empty-sub">Create one to share projects with your team.</p>
                  <button className="cp-btn cp-btn--primary" onClick={() => setTab('create')} style={{ marginTop: 8 }}>
                    {TLIcon.plus(11)}<span>Create workspace</span>
                  </button>
                </div>
              ) : (
                <div className="ws-list">
                  {workspaces.map((ws) => (
                    <div key={ws.id} className="ws-item">
                      <div className="ws-item-head">
                        <div>
                          <div className="ws-item-name">{ws.name}</div>
                          <div className="ws-item-meta">{ws.projectCount} projects &middot; {ws.members.length} members &middot; {ws.role}</div>
                        </div>
                      </div>
                      <div className="ws-members">
                        {ws.members.map((m) => (
                          <div key={m.id} className="ws-member">
                            <span className="ws-member-name">{m.name}</span>
                            <span className="ws-member-email">{m.email}</span>
                            <span className="ws-member-role">{m.role}</span>
                            {(ws.role === 'owner' || ws.role === 'admin') && m.role !== 'owner' && (
                              <button className="console-panel-btn" onClick={() => handleRemoveMember(ws.id, m.id)} title="Remove">&times;</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'create' && (
            <form onSubmit={handleCreate}>
              <label className="modal-field" style={{ marginBottom: 14 }}>
                <span>Workspace name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Convergint Delivery" required autoFocus />
              </label>
              <div className="modal-actions" style={{ borderTop: 0, paddingTop: 0 }}>
                <button type="submit" className="cp-btn cp-btn--primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create workspace'}
                </button>
              </div>
            </form>
          )}

          {tab === 'invite' && (
            <form onSubmit={handleInvite}>
              <div className="modal-grid">
                <label className="modal-field">
                  <span>Workspace</span>
                  <select value={inviteWorkspace} onChange={(e) => setInviteWorkspace(e.target.value)}>
                    {workspaces.filter((w) => w.role === 'owner' || w.role === 'admin').map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </label>
                <label className="modal-field">
                  <span>Role</span>
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <label className="modal-field" style={{ marginTop: 12 }}>
                <span>Email address</span>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com" required />
              </label>
              <p className="cp-empty-sub" style={{ margin: '8px 0 0', textAlign: 'left' }}>They must have a SNTRI account already.</p>
              <div className="modal-actions" style={{ borderTop: 0, paddingTop: 8 }}>
                <button type="submit" className="cp-btn cp-btn--primary" disabled={saving}>
                  {saving ? 'Inviting...' : 'Send invite'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
