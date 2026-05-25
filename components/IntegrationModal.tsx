'use client';

import { useState, useEffect } from 'react';

type Sheet = { id: number; name: string; rowCount: number; modifiedAt: string };
type Column = { id: number; title: string; type: string; primary?: boolean };

type IntegrationModalProps = {
  onClose: () => void;
  onImported: () => void;
  workspaceId?: string;
};

const THROUGHLINE_FIELDS = [
  { key: 'name', label: 'Project name', required: true },
  { key: 'code', label: 'Project code', required: false },
  { key: 'client', label: 'Client', required: false },
  { key: 'stage', label: 'Stage', required: false },
  { key: 'health', label: 'Health (0-100)', required: false },
  { key: 'risk', label: 'Risk level', required: false },
  { key: 'owner', label: 'Owner / PM', required: false },
  { key: 'contact', label: 'Client contact', required: false },
  { key: 'budget', label: 'Budget status', required: false },
  { key: 'schedule', label: 'Schedule status', required: false },
  { key: 'next', label: 'Next action', required: false },
];

export function IntegrationModal({ onClose, onImported, workspaceId }: IntegrationModalProps) {
  const [step, setStep] = useState<'connect' | 'sheets' | 'mapping' | 'done'>('connect');
  const [token, setToken] = useState('');
  const [, setConnected] = useState(false);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<number | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function checkConnection() {
    setLoading(true);
    const res = await fetch('/api/integrations/smartsheet');
    if (res.ok) {
      const data = await res.json();
      if (data.connected) {
        setConnected(true);
        setSheets(data.sheets || []);
        setStep('sheets');
      }
    }
    setLoading(false);
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/integrations/smartsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect', token }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setConnected(true);
      await checkConnection();
    } else {
      setError(data.error || 'Failed to connect');
    }
  }

  async function handleDisconnect() {
    await fetch('/api/integrations/smartsheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    });
    setConnected(false);
    setSheets([]);
    setStep('connect');
    setToken('');
  }

  async function handleSelectSheet(sheetId: number) {
    setSelectedSheet(sheetId);
    setLoading(true);
    setError('');
    const res = await fetch('/api/integrations/smartsheet/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId, action: 'preview' }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setColumns(data.columns || []);
      setSampleRows(data.sampleRows || []);
      setTotalRows(data.totalRows || 0);
      setMapping(data.suggestedMapping || {});
      setStep('mapping');
    } else {
      setError(data.error || 'Failed to load sheet');
    }
  }

  async function handleImport() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/integrations/smartsheet/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId: selectedSheet, action: 'import', mapping, workspaceId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setImportedCount(data.imported);
      setStep('done');
      onImported();
    } else {
      setError(data.error || 'Import failed');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {step === 'connect' && 'Connect Smartsheet'}
            {step === 'sheets' && 'Select a sheet'}
            {step === 'mapping' && 'Map columns'}
            {step === 'done' && 'Import complete'}
          </h2>
          <button className="console-panel-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* ── Step 1: Connect ─────────────────────────── */}
          {step === 'connect' && (
            <form onSubmit={handleConnect}>
              <p style={{ fontSize: 12.5, color: 'var(--tl-text-2)', margin: '0 0 14px' }}>
                Enter your Smartsheet API token. Find it at <strong>Account &rarr; Personal Settings &rarr; API Access</strong> in Smartsheet.
              </p>
              <label className="modal-field">
                <span>API token</span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your Smartsheet API token"
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="submit" className="cp-btn cp-btn--primary" disabled={loading}>
                  {loading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: Sheet list ──────────────────────── */}
          {step === 'sheets' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 12.5, color: 'var(--tl-text-2)', margin: 0 }}>
                  {sheets.length} sheet{sheets.length !== 1 ? 's' : ''} found. Select one to import.
                </p>
                <button className="cp-btn cp-btn--ghost" onClick={handleDisconnect} style={{ fontSize: 10.5 }}>disconnect</button>
              </div>
              {loading ? (
                <div className="cp-loading" style={{ minHeight: 100 }}>Loading sheets...</div>
              ) : sheets.length === 0 ? (
                <div className="cp-empty">No sheets found in your Smartsheet account.</div>
              ) : (
                <div className="int-sheet-list">
                  {sheets.map((sheet) => (
                    <button key={sheet.id} className="int-sheet-item" onClick={() => handleSelectSheet(sheet.id)}>
                      <div className="int-sheet-name">{sheet.name}</div>
                      <div className="int-sheet-meta">{sheet.rowCount} rows</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Column mapping ─────────────────── */}
          {step === 'mapping' && (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--tl-text-2)', margin: '0 0 4px' }}>
                Map Smartsheet columns to Throughline fields. {totalRows} rows will be imported as projects.
              </p>
              <p style={{ fontSize: 11, color: 'var(--tl-text-4)', margin: '0 0 14px' }}>
                Auto-mapped where column names matched. Adjust as needed.
              </p>

              <div className="int-mapping">
                {THROUGHLINE_FIELDS.map((field) => (
                  <div key={field.key} className="int-map-row">
                    <span className="int-map-label">
                      {field.label}
                      {field.required && <span style={{ color: 'var(--tl-bad)' }}> *</span>}
                    </span>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                      className="int-map-select"
                    >
                      <option value="">— skip —</option>
                      {columns.map((col) => (
                        <option key={col.id} value={col.title}>{col.title}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {sampleRows.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontFamily: 'var(--tl-mono)', fontSize: 10.5, color: 'var(--tl-text-3)', marginBottom: 6 }}>preview (first {sampleRows.length} rows)</div>
                  <div className="int-preview">
                    <table className="cp-table cp-table--tight">
                      <thead>
                        <tr>
                          {Object.keys(sampleRows[0]).slice(0, 5).map((k) => (
                            <th key={k}>{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sampleRows.map((row, i) => (
                          <tr key={i}>
                            {Object.keys(row).slice(0, 5).map((k) => (
                              <td key={k}>{row[k]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button className="cp-btn cp-btn--ghost" onClick={() => setStep('sheets')}>back</button>
                <button
                  className="cp-btn cp-btn--primary"
                  onClick={handleImport}
                  disabled={loading || !mapping.name}
                >
                  {loading ? 'Importing...' : `Import ${totalRows} projects`}
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Done ───────────────────────────── */}
          {step === 'done' && (
            <div className="cp-empty">
              <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--tl-text)' }}>
                {importedCount} project{importedCount !== 1 ? 's' : ''} imported
              </p>
              <p>Your Smartsheet data is now in Throughline. You can generate AI moves to get recommendations.</p>
              <button className="cp-btn cp-btn--primary" onClick={onClose} style={{ marginTop: 8 }}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
