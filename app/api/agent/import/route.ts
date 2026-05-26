import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

const SMARTSHEET_API = 'https://api.smartsheet.com/2.0';
const ASANA_API = 'https://app.asana.com/api/1.0';
const MONDAY_API = 'https://api.monday.com/v2';

async function fetchSheetData(
  provider: string,
  sheetId: string,
  token: string
): Promise<{ sheetName: string; columns: string[]; rows: Record<string, string>[] } | null> {
  if (provider === 'smartsheet') {
    const res = await fetch(`${SMARTSHEET_API}/sheets/${sheetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const sheet = await res.json();
    const cols: Array<{ id: number; title: string }> = sheet.columns || [];
    const colNames = cols.map((c) => c.title);
    const rows = (sheet.rows || []).map((row: { cells: Array<{ columnId: number; displayValue?: string; value?: string | number }> }) => {
      const obj: Record<string, string> = {};
      for (const cell of row.cells) {
        const col = cols.find((c) => c.id === cell.columnId);
        if (col) obj[col.title] = (cell.displayValue || cell.value || '').toString();
      }
      return obj;
    });
    return { sheetName: sheet.name, columns: colNames, rows };
  }

  if (provider === 'asana') {
    const res = await fetch(
      `${ASANA_API}/tasks?project=${sheetId}&opt_fields=name,assignee.name,due_on,notes,completed,custom_fields.name,custom_fields.display_value&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tasks = (data.data || []).filter((t: { completed: boolean }) => !t.completed);
    const columns = ['Name', 'Assignee', 'Due Date', 'Notes'];
    const rows = tasks.map((t: { name: string; assignee?: { name: string }; due_on?: string; notes?: string; custom_fields?: Array<{ name: string; display_value?: string }> }) => {
      const row: Record<string, string> = {
        Name: t.name || '',
        Assignee: t.assignee?.name || '',
        'Due Date': t.due_on || '',
        Notes: (t.notes || '').substring(0, 200),
      };
      for (const cf of t.custom_fields || []) {
        if (cf.display_value) { row[cf.name] = cf.display_value; if (!columns.includes(cf.name)) columns.push(cf.name); }
      }
      return row;
    });
    return { sheetName: 'Asana Project', columns, rows };
  }

  if (provider === 'monday') {
    const query = `{ boards(ids: [${sheetId}]) { name columns { title } items_page(limit: 100) { items { name column_values { text column { title } } } } } }`;
    const res = await fetch(MONDAY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const board = data.data?.boards?.[0];
    if (!board) return null;
    const columns = ['Name', ...(board.columns || []).map((c: { title: string }) => c.title)];
    const rows = (board.items_page?.items || []).map((item: { name: string; column_values: Array<{ column: { title: string }; text: string }> }) => {
      const row: Record<string, string> = { Name: item.name };
      for (const cv of item.column_values || []) {
        if (cv.text) row[cv.column?.title || ''] = cv.text;
      }
      return row;
    });
    return { sheetName: board.name, columns, rows };
  }

  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { provider, sheetId, csvRows, csvColumns, workspaceId } = body;

  let sheetName: string;
  let columns: string[];
  let rows: Record<string, string>[];

  if (provider === 'csv') {
    // CSV data passed directly
    sheetName = 'CSV Import';
    columns = csvColumns || [];
    rows = csvRows || [];
  } else {
    // Fetch from integration
    const integration = await prisma.integration.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!integration) return NextResponse.json({ error: `${provider} not connected` }, { status: 400 });

    const data = await fetchSheetData(provider, sheetId, integration.token);
    if (!data) return NextResponse.json({ error: 'Failed to fetch sheet data' }, { status: 500 });
    sheetName = data.sheetName;
    columns = data.columns;
    rows = data.rows;
  }

  if (rows.length === 0) return NextResponse.json({ error: 'No rows to import' }, { status: 400 });

  // Send to Claude for intelligent analysis
  const client = new Anthropic({ apiKey });

  // Send up to 50 rows (keep token count manageable)
  const dataForAI = rows.slice(0, 50);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are an AI that analyses project management data and converts it into structured project records for a PM dashboard.

A PM imported a sheet called "${sheetName}".

COLUMNS: ${JSON.stringify(columns)}

DATA (${dataForAI.length} of ${rows.length} rows):
${JSON.stringify(dataForAI, null, 2)}

Analyse every row and create a project record for each. Return:

{
  "projects": [
    {
      "name": "The project name",
      "code": "SHORT-CODE",
      "client": "Client name if identifiable",
      "stage": "Planning|Delivery|Commissioning|Handover",
      "health": 80,
      "risk": "Low|Medium|High",
      "owner": "PM or assignee",
      "contact": "Client contact if known",
      "budget": "On track",
      "budgetState": "good|warn|bad",
      "schedule": "On track",
      "scheduleState": "good|warn|bad",
      "next": "Most important upcoming action",
      "nextWhen": "When it's due",
      "move": "Recommended next move — specific and actionable",
      "moveBody": "Why this matters right now"
    }
  ],
  "risks": [
    {
      "projectName": "Match to a project name above",
      "title": "Risk description",
      "severity": "high|med",
      "impact": "What happens if this materialises",
      "action": "Suggested mitigation"
    }
  ],
  "summary": "One sentence: what was imported and any key observations"
}

Rules:
- ONE project per row. Don't skip rows unless they're clearly empty or header rows.
- Generate codes like "ACC-VIN", "CCTV-01" — short, uppercase, meaningful.
- Infer health from: % complete, RAG status, traffic lights, progress columns. Red/Behind = low health, Green/On track = high.
- Infer stage from: status, phase, milestone columns. Map to exactly one of the four stages.
- Infer risk from: RAG, risk columns, overdue dates, red flags in notes.
- Create risks for: overdue items, red/high status, blocked tasks, concerning patterns.
- Budget/schedule: look for cost, variance, duration, deadline columns.
- Today is ${new Date().toISOString().split('T')[0]}.

Respond ONLY with the JSON.`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  let analysis;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    analysis = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: 'AI analysis failed', raw: text.substring(0, 300) }, { status: 500 });
  }

  // Create projects
  let importedProjects = 0;
  const projectIdMap = new Map<string, string>();

  for (const p of analysis.projects || []) {
    if (!p.name) continue;
    const project = await prisma.project.create({
      data: {
        userId,
        workspaceId: workspaceId || null,
        code: p.code || p.name.substring(0, 3).toUpperCase() + '-01',
        name: p.name,
        client: p.client || '',
        stage: ['Planning', 'Delivery', 'Commissioning', 'Handover'].includes(p.stage) ? p.stage : 'Planning',
        health: Math.min(100, Math.max(0, parseInt(p.health) || 100)),
        risk: ['Low', 'Medium', 'High'].includes(p.risk) ? p.risk : 'Low',
        owner: p.owner || session.user?.name || '',
        contact: p.contact || '',
        budget: p.budget || 'On track',
        budgetState: ['good', 'warn', 'bad'].includes(p.budgetState) ? p.budgetState : 'good',
        schedule: p.schedule || 'On track',
        scheduleState: ['good', 'warn', 'bad'].includes(p.scheduleState) ? p.scheduleState : 'good',
        next: p.next || '',
        nextWhen: p.nextWhen || '',
        move: p.move || '',
        moveBody: p.moveBody || '',
        channel: 'Email',
      },
    });
    projectIdMap.set(p.name, project.id);
    importedProjects++;
  }

  // Create risks
  let importedRisks = 0;
  for (const r of analysis.risks || []) {
    const projectId = projectIdMap.get(r.projectName);
    if (!projectId) continue;
    await prisma.risk.create({
      data: {
        userId,
        projectId,
        title: r.title,
        severity: r.severity === 'high' ? 'high' : 'med',
        impact: r.impact || '',
        action: r.action || '',
      },
    });
    importedRisks++;
  }

  await prisma.activityLog.create({
    data: { userId, action: 'create', detail: `AI smart import from "${sheetName}": ${importedProjects} projects, ${importedRisks} risks detected` },
  });

  return NextResponse.json({
    imported: importedProjects,
    risks: importedRisks,
    summary: analysis.summary || `${importedProjects} projects imported`,
  });
}
