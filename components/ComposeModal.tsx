'use client';

import { useState, useEffect } from 'react';

type ComposeModalProps = {
  to?: string;
  subject?: string;
  body?: string;
  projectId?: string;
  onClose: () => void;
  onSent: () => void;
};

export function ComposeModal({ to: initTo, subject: initSubject, body: initBody, projectId, onClose, onSent }: ComposeModalProps) {
  const [to, setTo] = useState(initTo || '');
  const [subject, setSubject] = useState(initSubject || '');
  const [body, setBody] = useState(initBody || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');

    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body, projectId }),
    });

    const data = await res.json();
    setSending(false);

    if (res.ok) {
      onSent();
      onClose();
    } else {
      setError(data.error || 'Failed to send');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h2 className="modal-title">Compose email</h2>
          <button className="console-panel-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSend} className="modal-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <label className="modal-field" style={{ marginBottom: 10 }}>
            <span>To</span>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" required />
          </label>
          <label className="modal-field" style={{ marginBottom: 10 }}>
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" required />
          </label>
          <label className="modal-field" style={{ marginBottom: 10 }}>
            <span>Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              required
              rows={8}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--tl-line)',
                borderRadius: 5,
                background: 'var(--tl-bg)',
                fontSize: 13,
                fontFamily: 'var(--tl-sans)',
                color: 'var(--tl-text)',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="cp-btn cp-btn--primary" disabled={sending}>
              {sending ? 'Sending...' : 'Send email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
