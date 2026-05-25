'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

type ProjectData = {
  code: string;
  name: string;
  client: string;
  stage: string;
  phase: number;
  health: number;
  risk: string;
  next: string;
  nextWhen: string;
  budget: string;
  budgetState: string;
  schedule: string;
  scheduleState: string;
  owner: string;
  contact: string;
  lastTouch: string;
};

type RiskData = { id: string; title: string; severity: string; owner: string; impact: string; age: string };
type MessageData = { id: string; from: string; message: string; at: string };

export default function ClientPortal() {
  const params = useParams();
  const token = params.token as string;

  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [shareId, setShareId] = useState('');
  const [project, setProject] = useState<ProjectData | null>(null);
  const [risks, setRisks] = useState<RiskData[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Message form
  const [msgFrom, setMsgFrom] = useState('');
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch(`/api/shares/${token}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok && data.verified) {
      setVerified(true);
      setShareId(data.shareId);
      setProject(data.project);
      setRisks(data.risks || []);
      setMessages(data.messages || []);
    } else {
      setError(data.error || 'Incorrect password');
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);

    const res = await fetch(`/api/shares/${token}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId, from: msgFrom, message: msgText }),
    });

    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [msg, ...prev]);
      setMsgText('');
    }
    setSending(false);
  }

  // Check if already verified in sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(`sntri.share.${token}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setVerified(true);
        setShareId(data.shareId);
        setProject(data.project);
        setRisks(data.risks || []);
        setMessages(data.messages || []);
      } catch { /* ignore */ }
    }
  }, [token]);

  // Cache verified data
  useEffect(() => {
    if (verified && project) {
      sessionStorage.setItem(`sntri.share.${token}`, JSON.stringify({ shareId, project, risks, messages }));
    }
  }, [verified, project, risks, messages, shareId, token]);

  if (!verified) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="console-brand-mark">SNTRI</span>
            <span className="console-brand-name">client portal</span>
          </div>
          <h1 className="auth-title">Enter password</h1>
          <p style={{ fontSize: 12.5, color: 'var(--tl-text-2)', margin: '0 0 16px' }}>
            Your project manager has shared a project with you. Enter the password they provided to view it.
          </p>
          <form onSubmit={handleVerify} className="auth-form">
            <label className="auth-label">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                required
                autoFocus
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Verifying...' : 'View project'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const healthCls = project.health < 50 ? 'bad' : project.health < 75 ? 'warn' : 'good';

  return (
    <div className="console-root">
      <header className="console-top">
        <div className="console-top-l">
          <div className="console-brand">
            <span className="console-brand-mark">SNTRI</span>
            <span className="console-brand-name">client portal</span>
          </div>
          <span className="console-top-sep" />
          <div className="console-breadcrumb">
            <span className="console-bc-key">project</span>
            <span className="console-bc-val">{project.code}</span>
          </div>
        </div>
      </header>

      <div className="pd-layout">
        {/* Hero */}
        <div className="pd-hero">
          <div className="pd-hero-eyebrow">
            <span className={`cp-rdot cp-rdot--${project.risk.toLowerCase()}`} />
            <span className="cp-mono">{project.code}</span>
            <span className="cp-mid-dot" />
            <span className="cp-stage">{project.stage.toLowerCase()}</span>
          </div>
          <h1 className="pd-title">{project.name}</h1>
          <div className="pd-subtitle">{project.client}</div>
        </div>

        <div className="pd-grid">
          {/* Health metrics */}
          <div className="pd-card pd-card--wide">
            <div className="pd-card-head">project status</div>
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
                <div className="pd-metric-val">{project.phase}<span className="pd-metric-unit">/8</span></div>
                <div className="pd-metric-lbl">phase</div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="pd-card">
            <div className="pd-card-head">details</div>
            <div className="cp-pinned-kv">
              <div><span>pm</span><b>{project.owner || '—'}</b></div>
              <div><span>contact</span><b>{project.contact || '—'}</b></div>
              <div><span>stage</span><b>{project.stage}</b></div>
              <div><span>last update</span><b>{project.lastTouch}</b></div>
            </div>
          </div>

          {/* Next action */}
          {project.next && (
            <div className="pd-card">
              <div className="pd-card-head">upcoming</div>
              <div className="pd-next">
                {project.nextWhen && <div className="pd-next-when">{project.nextWhen}</div>}
                <div className="pd-next-what">{project.next}</div>
              </div>
            </div>
          )}

          {/* Risks */}
          {risks.length > 0 && (
            <div className="pd-card pd-card--wide">
              <div className="pd-card-head">open risks ({risks.length})</div>
              <table className="cp-table cp-table--tight">
                <thead>
                  <tr>
                    <th className="cp-th-tight">sev</th>
                    <th>risk</th>
                    <th>owner</th>
                    <th>impact</th>
                    <th className="cp-th-num">age</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r) => (
                    <tr key={r.id} style={{ cursor: 'default' }}>
                      <td><span className={`cp-sev cp-sev--${r.severity}`}>{r.severity === 'high' ? 'H' : 'M'}</span></td>
                      <td className="cp-td-name">{r.title}</td>
                      <td>{r.owner}</td>
                      <td>{r.impact}</td>
                      <td className="cp-td-num">{r.age}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Messages */}
          <div className="pd-card pd-card--wide">
            <div className="pd-card-head">messages</div>
            <div style={{ padding: 16 }}>
              <form onSubmit={handleSendMessage} className="portal-msg-form">
                <input
                  value={msgFrom}
                  onChange={(e) => setMsgFrom(e.target.value)}
                  placeholder="Your name"
                  required
                  className="portal-msg-input"
                />
                <div className="portal-msg-row">
                  <input
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Write a message to the project manager..."
                    required
                    className="portal-msg-input"
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="cp-btn cp-btn--primary" disabled={sending}>
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>

              {messages.length > 0 && (
                <div className="portal-msg-list">
                  {messages.map((msg) => (
                    <div key={msg.id} className="portal-msg-item">
                      <div className="portal-msg-meta">
                        <span className="portal-msg-from">{msg.from}</span>
                        <span className="portal-msg-at">{msg.at}</span>
                      </div>
                      <div className="portal-msg-text">{msg.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '40px 0 20px', fontSize: 11, color: 'var(--tl-text-4)' }}>
          Powered by SNTRI
        </div>
      </div>
    </div>
  );
}
