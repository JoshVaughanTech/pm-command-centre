import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const SMARTSHEET_API = 'https://api.smartsheet.com/2.0';

type ColumnMapping = {
  code?: string;
  name?: string;
  client?: string;
  stage?: string;
  health?: string;
  risk?: string;
  owner?: string;
  contact?: string;
  budget?: string;
  schedule?: string;
  next?: string;
};

// POST — preview or import a sheet
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { sheetId, action, mapping, workspaceId } = body;

  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'smartsheet' } },
  });
  if (!integration) return NextResponse.json({ error: 'Smartsheet not connected' }, { status: 400 });

  // Fetch the sheet with all columns and rows
  const res = await fetch(`${SMARTSHEET_API}/sheets/${sheetId}`, {
    headers: { Authorization: `Bearer ${integration.token}` },
  });

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch sheet' }, { status: 500 });

  const sheet = await res.json();
  const columns: Array<{ id: number; title: string; type: string; primary?: boolean }> = sheet.columns || [];
  const rows: Array<{ id: number; cells: Array<{ columnId: number; value?: string | number; displayValue?: string }> }> = sheet.rows || [];

  // Preview mode — return columns and sample rows
  if (action === 'preview') {
    const sampleRows = rows.slice(0, 5).map((row) => {
      const obj: Record<string, string> = {};
      for (const cell of row.cells) {
        const col = columns.find((c) => c.id === cell.columnId);
        if (col) obj[col.title] = (cell.displayValue || cell.value || '').toString();
      }
      return obj;
    });

    // Use primary column as default name mapping
    const primaryCol = columns.find((c) => c.primary);
    const suggested = suggestMapping(columns.map((c) => c.title));
    if (!suggested.name && primaryCol) {
      suggested.name = primaryCol.title;
    }

    return NextResponse.json({
      sheetName: sheet.name,
      columns: columns.map((c) => ({ id: c.id, title: c.title, type: c.type, primary: c.primary })),
      totalRows: rows.length,
      sampleRows,
      suggestedMapping: suggested,
    });
  }

  // Import mode — create projects from rows using the mapping
  if (action === 'import') {
    if (!mapping) return NextResponse.json({ error: 'Column mapping is required' }, { status: 400 });

    const colMap = new Map(columns.map((c) => [c.title, c.id]));
    let imported = 0;

    for (const row of rows) {
      const getValue = (field: string | undefined) => {
        if (!field) return '';
        const colId = colMap.get(field);
        if (!colId) return '';
        const cell = row.cells.find((c) => c.columnId === colId);
        return (cell?.displayValue || cell?.value || '').toString();
      };

      const name = getValue((mapping as ColumnMapping).name);
      if (!name) continue; // skip rows without a name

      const code = getValue((mapping as ColumnMapping).code) || name.substring(0, 3).toUpperCase() + '-' + String(imported + 1).padStart(2, '0');
      const healthRaw = getValue((mapping as ColumnMapping).health);
      const health = healthRaw ? Math.min(100, Math.max(0, parseInt(healthRaw) || 100)) : 100;

      const riskRaw = getValue((mapping as ColumnMapping).risk).toLowerCase();
      const risk = riskRaw.includes('high') ? 'High' : riskRaw.includes('med') ? 'Medium' : 'Low';

      const stageRaw = getValue((mapping as ColumnMapping).stage);
      const stage = normaliseStage(stageRaw);

      await prisma.project.create({
        data: {
          userId,
          workspaceId: workspaceId || null,
          code,
          name,
          client: getValue((mapping as ColumnMapping).client) || '',
          stage,
          health,
          risk,
          owner: getValue((mapping as ColumnMapping).owner) || session.user?.name || '',
          contact: getValue((mapping as ColumnMapping).contact) || '',
          budget: getValue((mapping as ColumnMapping).budget) || 'On track',
          budgetState: 'good',
          schedule: getValue((mapping as ColumnMapping).schedule) || 'On track',
          scheduleState: 'good',
          next: getValue((mapping as ColumnMapping).next) || '',
        },
      });
      imported++;
    }

    return NextResponse.json({ ok: true, imported });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

function suggestMapping(columnNames: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lower = columnNames.map((c) => c.toLowerCase());

  const patterns: Array<[string, string[]]> = [
    ['name', ['project name', 'name', 'task name', 'title', 'project', 'description']],
    ['code', ['project code', 'code', 'id', 'project id', 'ref', 'reference']],
    ['client', ['client', 'customer', 'client name', 'company', 'account']],
    ['stage', ['stage', 'status', 'phase', 'state', 'project status']],
    ['health', ['health', 'health score', 'rag', 'score', 'rating', 'health %']],
    ['risk', ['risk', 'risk level', 'risk rating', 'rag status']],
    ['owner', ['owner', 'pm', 'project manager', 'assigned to', 'assigned', 'lead']],
    ['contact', ['contact', 'client contact', 'stakeholder', 'point of contact']],
    ['budget', ['budget', 'budget status', 'cost', 'financials']],
    ['schedule', ['schedule', 'schedule status', 'timeline', 'due date', 'deadline']],
    ['next', ['next action', 'next step', 'next steps', 'action', 'notes', 'comments']],
  ];

  for (const [field, keywords] of patterns) {
    // Try exact match first
    for (const keyword of keywords) {
      const idx = lower.indexOf(keyword);
      if (idx >= 0) { mapping[field] = columnNames[idx]; break; }
    }
    // Then try partial match (column contains keyword or keyword contains column)
    if (!mapping[field]) {
      for (const keyword of keywords) {
        const idx = lower.findIndex((c) => c.includes(keyword) || keyword.includes(c));
        if (idx >= 0 && !Object.values(mapping).includes(columnNames[idx])) {
          mapping[field] = columnNames[idx];
          break;
        }
      }
    }
  }

  // If no name mapping found, use the first text-like column
  if (!mapping.name && columnNames.length > 0) {
    mapping.name = columnNames[0];
  }

  return mapping;
}

function normaliseStage(raw: string): string {
  const l = raw.toLowerCase();
  if (l.includes('plan')) return 'Planning';
  if (l.includes('deliver') || l.includes('execut') || l.includes('progress') || l.includes('active')) return 'Delivery';
  if (l.includes('commission') || l.includes('test')) return 'Commissioning';
  if (l.includes('handover') || l.includes('close') || l.includes('complete') || l.includes('done')) return 'Handover';
  return raw || 'Planning';
}
