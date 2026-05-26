'use client';

import { useState, useEffect, useRef } from 'react';
import { TLIcon } from './icons';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTIONS = [
  'What should I focus on today?',
  'Summarise my portfolio this week',
  'Which projects need attention?',
  'Draft a client update for my lowest health project',
];

type AgentPanelProps = {
  onClose: () => void;
};

export function AgentPanel({ onClose }: AgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
        body: JSON.stringify({
          message: text.trim(),
          history: messages,
        }),
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
                I have access to all your projects, risks, and activity. Ask me anything.
              </div>
              <div className="agent-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="agent-suggestion"
                    onClick={() => sendMessage(s)}
                  >
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

          {loading && (
            <div className="agent-msg agent-msg--assistant">
              <div className="agent-msg-avatar">{TLIcon.spark(10)}</div>
              <div className="agent-msg-content">
                <div className="agent-typing">
                  <span /><span /><span />
                </div>
              </div>
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
            disabled={loading}
          />
          <button type="submit" className="agent-send" disabled={loading || !input.trim()}>
            {TLIcon.send(14)}
          </button>
        </form>
      </div>
    </div>
  );
}
