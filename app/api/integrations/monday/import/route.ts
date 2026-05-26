import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MONDAY_API = 'https://api.monday.com/v2';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { sheetId, action, mapping, workspaceId } = body;

  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'monday' } },
  });
  if (!integration) return NextResponse.json({ error: 'Monday.com not connected' }, { status: 400 });

  const query = `{
    boards(ids: [${sheetId}]) {
      name
      columns { id title type }
      items_page(limit: 200) {
        items {
          id name
          column_values { id text column { title } }
        }
      }
    }
  }`;

  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: integration.token },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  if (data.errors) return NextResponse.json({ error: 'Failed to fetch board' }, { status: 500 });

  const board = data.data?.boards?.[0];
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });

  const columns = (board.columns || []).map((c: { id: string; title: string; type: string }, i: number) => ({
    id: i,
    title: c.title,
    type: c.type,
  }));

  const items = board.items_page?.items || [];

  if (action === 'preview') {
    const sampleRows = items.slice(0, 5).map((item: { name: string; column_values: Array<{ column: { title: string }; text: string }> }) => {
      const row: Record<string, string> = { Name: item.name };
      for (const cv of item.column_values || []) {
        if (cv.text) row[cv.column?.title || 'unknown'] = cv.text;
      }
      return row;
    });

    // Auto-suggest mapping
    const colNames = columns.map((c: { title: string }) => c.title.toLowerCase());
    const suggested: Record<string, string> = { name: 'Name' };
    const findCol = (keywords: string[]) => {
      for (const kw of keywords) {
        const idx = colNames.findIndex((c: string) => c.includes(kw));
        if (idx >= 0) return columns[idx].title;
      }
      return '';
    };

    const ownerCol = findCol(['owner', 'person', 'assigned', 'pm']);
    const statusCol = findCol(['status', 'stage']);
    const clientCol = findCol(['client', 'customer', 'account']);
    if (ownerCol) suggested.owner = ownerCol;
    if (statusCol) suggested.stage = statusCol;
    if (clientCol) suggested.client = clientCol;

    return NextResponse.json({
      sheetName: board.name,
      columns: [{ id: -1, title: 'Name', type: 'TEXT' }, ...columns],
      totalRows: items.length,
      sampleRows,
      suggestedMapping: suggested,
    });
  }

  if (action === 'import') {
    let imported = 0;
    for (const item of items) {
      const getValue = (field: string | undefined) => {
        if (!field || field === 'Name') return field === 'Name' ? item.name : '';
        const cv = item.column_values?.find((c: { column: { title: string } }) => c.column?.title === field);
        return cv?.text || '';
      };

      const name = getValue(mapping?.name || 'Name');
      if (!name) continue;

      const stageRaw = getValue(mapping?.stage);
      const stage = normaliseStage(stageRaw);

      await prisma.project.create({
        data: {
          userId,
          workspaceId: workspaceId || null,
          code: name.substring(0, 3).toUpperCase() + '-' + String(imported + 1).padStart(2, '0'),
          name,
          client: getValue(mapping?.client) || '',
          stage,
          owner: getValue(mapping?.owner) || session.user?.name || '',
          contact: getValue(mapping?.contact) || '',
          next: getValue(mapping?.next) || '',
        },
      });
      imported++;
    }

    return NextResponse.json({ ok: true, imported });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

function normaliseStage(raw: string): string {
  const l = raw.toLowerCase();
  if (l.includes('plan')) return 'Planning';
  if (l.includes('deliver') || l.includes('progress') || l.includes('active') || l.includes('working')) return 'Delivery';
  if (l.includes('commission') || l.includes('test') || l.includes('review')) return 'Commissioning';
  if (l.includes('done') || l.includes('complete') || l.includes('close') || l.includes('handover')) return 'Handover';
  return raw || 'Planning';
}
