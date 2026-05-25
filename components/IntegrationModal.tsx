'use client';

import { useState, useEffect, useRef } from 'react';

type Sheet = { id: number | string; name: string; rowCount: number };
type Column = { id: number; title: string; type: string };

type Provider = 'smartsheet' | 'asana' | 'monday' | 'csv';

const PROVIDERS: Array<{ id: Provider; label: string; desc: string; oauth: boolean }> = [
  { id: 'smartsheet', label: 'Smartsheet', desc: 'Connect and import from Smartsheet', oauth: true },
  { id: 'asana', label: 'Asana', desc: 'Connect and import from Asana', oauth: true },
  { id: 'monday', label: 'Monday.com', desc: 'Connect and import from Monday', oauth: true },
  { id: 'csv', label: 'MS Project / CSV', desc: 'Upload a CSV export from any tool', oauth: false },
];

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

type IntegrationModalProps = {
  onClose: () => void;
  onImported: () => void;
  workspaceId?: string;
};

export function IntegrationModal({ onClose, onImported, workspaceId }: IntegrationModalProps) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [step, setStep] = useState<'provider' | 'connect' | 'sheets' | 'mapping' | 'done'>('provider');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<number | string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function selectProvider(p: Provider) {
    setProvider(p);
    setError('');
    if (p === 'csv') {
      setStep('connect'); // CSV uses "connect" step for file upload
    } else {
      // Check if already connected
      checkConnection(p);
    }
  }

  async function checkConnection(p: Provider) {
    setLoading(true);
    const res = await fetch(`/api/integrations/${p}`);
    if (res.ok) {
      const data = await res.json();
      if (data.connected && data.sheets?.length > 0) {
        setSheets(data.sheets);
        setStep('sheets');
      } else if (data.connected) {
        setSheets([]);
        setStep('sheets');
      } else {
        setStep('connect');
      }
    } else {
      setStep('connect');
    }
    setLoading(false);
  }

  async function handleDisconnect() {
    await fetch(`/api/integrations/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    });
    setSheets([]);
    setStep('connect');
  }

  async function handleSelectSheet(sheetId: number | string) {
    setSelectedSheet(sheetId);
    setLoading(true);
    setError('');
    const res = await fetch(`/api/integrations/${provider}/import`, {
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
      setError(data.error || 'Failed to load');
    }
  }

  async function handleCsvUpload(file: File) {
    const text = await file.text();
    setCsvText(text);
    setLoading(true);
    setError('');
    const res = await fetch('/api/integrations/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', csvText: text }),
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
      setError(data.error || 'Failed to parse CSV');
    }
  }

  async function handleImport() {
    setLoading(true);
    setError('');

    const url = provider === 'csv' ? '/api/integrations/csv' : `/api/integrations/${provider}/import`;
    const body = provider === 'csv'
      ? { action: 'import', csvText, mapping, workspaceId }
      : { sheetId: selectedSheet, action: 'import', mapping, workspaceId };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

  const providerLabel = PROVIDERS.find((p) => p.id === provider)?.label || '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {step === 'provider' && 'Import projects'}
            {step === 'connect' && `Connect ${providerLabel}`}
            {step === 'sheets' && `Select from ${providerLabel}`}
            {step === 'mapping' && 'Map columns'}
            {step === 'done' && 'Import complete'}
          </h2>
          <button className="console-panel-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* ── Provider selector ───────────────────────── */}
          {step === 'provider' && (
            <div className="int-providers">
              {PROVIDERS.map((p) => (
                <button key={p.id} className="int-provider-item" onClick={() => selectProvider(p.id)}>
                  <div className="int-provider-name">{p.label}</div>
                  <div className="int-provider-desc">{p.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* ── Connect / CSV upload ───────────────────── */}
          {step === 'connect' && provider === 'csv' && (
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--tl-text-2)', margin: '0 0 14px' }}>
                Export your project plan from MS Project (or any tool) as a CSV file, then upload it here.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvUpload(file);
                }}
              />
              <button
                className="cp-btn cp-btn--primary"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                {loading ? 'Parsing...' : 'Choose CSV file'}
              </button>
              <button className="cp-btn cp-btn--ghost" onClick={() => { setProvider(null); setStep('provider'); }} style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
                back
              </button>
            </div>
          )}

          {step === 'connect' && provider !== 'csv' && (
            <div>
              <p style={{ fontSize: 12.5, color: 'var(--tl-text-2)', margin: '0 0 14px' }}>
                Click below to connect your {providerLabel} account. You&apos;ll be redirected to {providerLabel} to authorise access.
              </p>
              <a
                href={`/api/integrations/${provider}/connect`}
                className="cp-btn cp-btn--primary cp-email-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', textDecoration: 'none' }}
              >
                Connect {providerLabel}
              </a>
              <button className="cp-btn cp-btn--ghost" onClick={() => { setProvider(null); setStep('provider'); }} style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
                back
              </button>
            </div>
          )}

          {/* ── Sheet / board list ──────────────────────── */}
          {step === 'sheets' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 12.5, color: 'var(--tl-text-2)', margin: 0 }}>
                  {sheets.length} {provider === 'monday' ? 'board' : 'project'}{sheets.length !== 1 ? 's' : ''} found. Select one to import.
                </p>
                <button className="cp-btn cp-btn--ghost" onClick={handleDisconnect} style={{ fontSize: 10.5 }}>disconnect</button>
              </div>
              {loading ? (
                <div className="cp-loading" style={{ minHeight: 100 }}>Loading...</div>
              ) : sheets.length === 0 ? (
                <div className="cp-empty">No data found in your {providerLabel} account.</div>
              ) : (
                <div className="int-sheet-list">
                  {sheets.map((sheet) => (
                    <button key={sheet.id} className="int-sheet-item" onClick={() => handleSelectSheet(sheet.id)}>
                      <div className="int-sheet-name">{sheet.name}</div>
                      <div className="int-sheet-meta">{sheet.rowCount} items</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Column mapping ─────────────────────────── */}
          {step === 'mapping' && (
            <>
              <p style={{ fontSize: 12.5, color: 'var(--tl-text-2)', margin: '0 0 4px' }}>
                Map columns to Throughline fields. {totalRows} rows will be imported as projects.
              </p>
              <p style={{ fontSize: 11, color: 'var(--tl-text-4)', margin: '0 0 14px' }}>
                Auto-mapped where possible. Adjust as needed.
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
                  <div style={{ fontFamily: 'var(--tl-mono)', fontSize: 10.5, color: 'var(--tl-text-3)', marginBottom: 6 }}>
                    preview (first {sampleRows.length} rows)
                  </div>
                  <div className="int-preview">
                    <table className="cp-table cp-table--tight">
                      <thead>
                        <tr>
                          {Object.keys(sampleRows[0]).slice(0, 5).map((k) => <th key={k}>{k}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sampleRows.map((row, i) => (
                          <tr key={i}>
                            {Object.keys(row).slice(0, 5).map((k) => <td key={k}>{row[k]}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button className="cp-btn cp-btn--ghost" onClick={() => {
                  if (provider === 'csv') { setStep('connect'); } else { setStep('sheets'); }
                }}>back</button>
                <button className="cp-btn cp-btn--primary" onClick={handleImport} disabled={loading || !mapping.name}>
                  {loading ? 'Importing...' : `Import ${totalRows} projects`}
                </button>
              </div>
            </>
          )}

          {/* ── Done ───────────────────────────────────── */}
          {step === 'done' && (
            <div className="cp-empty">
              <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--tl-text)' }}>
                {importedCount} project{importedCount !== 1 ? 's' : ''} imported from {providerLabel}
              </p>
              <p>Your data is now in Throughline. Hit &ldquo;AI moves&rdquo; to generate recommendations.</p>
              <button className="cp-btn cp-btn--primary" onClick={onClose} style={{ marginTop: 8 }}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
