'use client';

import { useState, useEffect, useRef } from 'react';
import { TLIcon } from './icons';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type AnalysisResult = {
  summary: string;
  healthUpdates: Array<{ reason: string }>;
  riskUpdates: Array<{ reason: string }>;
  newRisks: Array<{ title: string }>;
  moveUpdates: number;
  nextActions: number;
  commsInsights: Array<{ projectId: string; insight: string }>;
  applied: number;
};

const SUGGESTIONS = [
  'What should I focus on today?',
  'Summarise my portfolio this week',
  'Which projects need attention?',
  'Draft a client update for my lowest health project',
  'Prepare talking points for my next client call',
];

type AgentPanelProps = {
  onClose: () => void;
  onRefresh?: () => void;
};

export function AgentPanel({ onClose, onRefresh }: AgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, analysis]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history: messages }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        const err = await res.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.error || 'Something went wrong'}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Network request failed' }]);
    }

    setLoading(false);
  }

  async function runAnalysis() {
    setAnalysing(true);
    setAnalysis(null);

    try {
      const res = await fetch('/api/agent/analyse', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        onRefresh?.();

        // Add a short summary — details shown in the card below
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.summary || 'Dashboard updated.',
        }]);
      } else {
        const err = await res.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: `Analysis failed: ${err.error || 'Unknown error'}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Analysis failed: Network error' }]);
    }

    setAnalysing(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="agent-backdrop" onClick={onClose}>
      <div className="agent-panel" onClick={(e) => e.stopPropagation()}>
        <div className="agent-header">
          <div className="agent-header-left">
            <span>{TLIcon.spark(14)}</span>
            <span className="agent-title">SNTRI Agent</span>
          </div>
          <button className="console-panel-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="agent-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="agent-welcome">
              <div className="agent-welcome-icon">{TLIcon.spark(24)}</div>
              <div className="agent-welcome-title">How can I help?</div>
              <div className="agent-welcome-sub">
                I have access to all your projects, risks, emails, and activity.
              </div>

              {/* Analyse & Optimise — primary action */}
              <button
                className="agent-analyse-btn"
                onClick={runAnalysis}
                disabled={analysing}
              >
                <span className="agent-analyse-icon">{TLIcon.spark(16)}</span>
                <div className="agent-analyse-text">
                  <div className="agent-analyse-title">{analysing ? 'Analysing your portfolio...' : 'Analyse & Optimise'}</div>
                  <div className="agent-analyse-desc">
                    {analysing
                      ? 'Pulling data from connected tools and emails, analysing health, detecting risks...'
                      : 'Scan integrations and emails, update health scores, detect risks, generate moves'}
                  </div>
                </div>
              </button>

              <div className="agent-divider">or ask me anything</div>

              <div className="agent-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="agent-suggestion" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`agent-msg agent-msg--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="agent-msg-avatar">{TLIcon.spark(10)}</div>
              )}
              <div className="agent-msg-content">
                <div className="agent-msg-text">{msg.content}</div>
              </div>
            </div>
          ))}

          {(loading || analysing) && (
            <div className="agent-msg agent-msg--assistant">
              <div className="agent-msg-avatar">{TLIcon.spark(10)}</div>
              <div className="agent-msg-content">
                <div className="agent-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          {/* Analysis results card */}
          {analysis && (
            <div className="agent-analysis-card">
              <div className="agent-analysis-head">{TLIcon.spark(11)} changes applied</div>
              <div className="agent-analysis-stats">
                {(analysis.healthUpdates?.length || 0) > 0 && (
                  <div className="agent-stat"><span className="agent-stat-num">{analysis.healthUpdates.length}</span><span className="agent-stat-lbl">health updated</span></div>
                )}
                {(analysis.newRisks?.length || 0) > 0 && (
                  <div className="agent-stat agent-stat--risk"><span className="agent-stat-num">{analysis.newRisks.length}</span><span className="agent-stat-lbl">risks detected</span></div>
                )}
                {(analysis.moveUpdates || 0) > 0 && (
                  <div className="agent-stat"><span className="agent-stat-num">{analysis.moveUpdates}</span><span className="agent-stat-lbl">moves set</span></div>
                )}
                {(analysis.nextActions || 0) > 0 && (
                  <div className="agent-stat"><span className="agent-stat-num">{analysis.nextActions}</span><span className="agent-stat-lbl">actions set</span></div>
                )}
              </div>
              {(analysis.commsInsights?.length || 0) > 0 && (
                <div className="agent-analysis-body">
                  {analysis.commsInsights.map((c, i) => (
                    <div key={`c${i}`} className="agent-analysis-item agent-analysis-item--comms">{c.insight}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <form className="agent-input-wrap" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your projects..."
            className="agent-input"
            disabled={loading || analysing}
          />
          <button type="submit" className="agent-send" disabled={loading || analysing || !input.trim()}>
            {TLIcon.send(14)}
          </button>
        </form>
      </div>
    </div>
  );
}
