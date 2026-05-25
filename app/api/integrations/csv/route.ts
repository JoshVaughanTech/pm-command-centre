import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { action, csvText, mapping, workspaceId } = await req.json();

  if (!csvText) return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 });

  const { headers, rows } = parseCsv(csvText);

  if (action === 'preview') {
    const columns = headers.map((h, i) => ({ id: i, title: h, type: 'TEXT' }));
    const sampleRows = rows.slice(0, 5).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });

    // Auto-suggest mapping
    const suggested: Record<string, string> = {};
    const patterns: Array<[string, string[]]> = [
      ['name', ['project name', 'name', 'task name', 'title', 'project', 'description']],
      ['code', ['project code', 'code', 'id', 'wbs', 'ref']],
      ['client', ['client', 'customer', 'company']],
      ['stage', ['stage', 'status', 'phase', 'state']],
      ['health', ['health', 'score', 'rag', '% complete', 'percent complete']],
      ['owner', ['owner', 'resource names', 'assigned to', 'pm', 'project manager']],
      ['contact', ['contact', 'stakeholder']],
      ['budget', ['budget', 'cost', 'total cost']],
      ['schedule', ['schedule', 'duration', 'finish', 'end date', 'deadline']],
      ['next', ['notes', 'comments', 'next action', 'next step']],
    ];

    const lowerHeaders = headers.map((h) => h.toLowerCase());
    for (const [field, keywords] of patterns) {
      for (const kw of keywords) {
        const idx = lowerHeaders.indexOf(kw);
        if (idx >= 0) { suggested[field] = headers[idx]; break; }
      }
    }
    if (!suggested.name && headers.length > 0) suggested.name = headers[0];

    return NextResponse.json({
      sheetName: 'CSV Import',
      columns,
      totalRows: rows.length,
      sampleRows,
      suggestedMapping: suggested,
    });
  }

  if (action === 'import') {
    if (!mapping?.name) return NextResponse.json({ error: 'Name column mapping is required' }, { status: 400 });

    let imported = 0;
    for (const row of rows) {
      const getValue = (field: string | undefined) => {
        if (!field) return '';
        const idx = headers.indexOf(field);
        return idx >= 0 ? (row[idx] || '') : '';
      };

      const name = getValue(mapping.name);
      if (!name) continue;

      const code = getValue(mapping.code) || name.substring(0, 3).toUpperCase() + '-' + String(imported + 1).padStart(2, '0');
      const healthRaw = getValue(mapping.health);
      const health = healthRaw ? Math.min(100, Math.max(0, parseInt(healthRaw) || 100)) : 100;

      const stageRaw = getValue(mapping.stage);
      const stage = normaliseStage(stageRaw);

      const riskRaw = getValue(mapping.risk).toLowerCase();
      const risk = riskRaw.includes('high') ? 'High' : riskRaw.includes('med') ? 'Medium' : 'Low';

      await prisma.project.create({
        data: {
          userId,
          workspaceId: workspaceId || null,
          code,
          name,
          client: getValue(mapping.client) || '',
          stage,
          health,
          risk,
          owner: getValue(mapping.owner) || session.user?.name || '',
          contact: getValue(mapping.contact) || '',
          budget: getValue(mapping.budget) || 'On track',
          budgetState: 'good',
          schedule: getValue(mapping.schedule) || 'On track',
          scheduleState: 'good',
          next: getValue(mapping.next) || '',
        },
      });
      imported++;
    }

    return NextResponse.json({ ok: true, imported });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parse = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parse(lines[0]);
  const rows = lines.slice(1).map(parse).filter((r) => r.some((c) => c));

  return { headers, rows };
}

function normaliseStage(raw: string): string {
  const l = raw.toLowerCase();
  if (l.includes('plan')) return 'Planning';
  if (l.includes('deliver') || l.includes('progress') || l.includes('active') || l.includes('execut')) return 'Delivery';
  if (l.includes('commission') || l.includes('test')) return 'Commissioning';
  if (l.includes('done') || l.includes('complete') || l.includes('close') || l.includes('handover')) return 'Handover';
  return raw || 'Planning';
}
