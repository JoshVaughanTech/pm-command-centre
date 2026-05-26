import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ASANA_API = 'https://app.asana.com/api/1.0';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { sheetId, action, mapping, workspaceId } = body;

  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'asana' } },
  });
  if (!integration) return NextResponse.json({ error: 'Asana not connected' }, { status: 400 });

  // Fetch tasks from the project
  const res = await fetch(
    `${ASANA_API}/tasks?project=${sheetId}&opt_fields=name,assignee.name,due_on,notes,completed,custom_fields.name,custom_fields.display_value&limit=100`,
    { headers: { Authorization: `Bearer ${integration.token}` } }
  );
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });

  const data = await res.json();
  const tasks = (data.data || []).filter((t: { completed: boolean }) => !t.completed);

  if (action === 'preview') {
    const columns = [
      { id: 1, title: 'Name', type: 'TEXT' },
      { id: 2, title: 'Assignee', type: 'TEXT' },
      { id: 3, title: 'Due Date', type: 'DATE' },
      { id: 4, title: 'Notes', type: 'TEXT' },
    ];

    // Add custom fields as columns
    if (tasks.length > 0 && tasks[0].custom_fields) {
      for (const cf of tasks[0].custom_fields) {
        columns.push({ id: columns.length + 1, title: cf.name, type: 'TEXT' });
      }
    }

    const sampleRows = tasks.slice(0, 5).map((t: { name: string; assignee?: { name: string }; due_on?: string; notes?: string; custom_fields?: Array<{ name: string; display_value?: string }> }) => {
      const row: Record<string, string> = {
        Name: t.name || '',
        Assignee: t.assignee?.name || '',
        'Due Date': t.due_on || '',
        Notes: (t.notes || '').substring(0, 80),
      };
      for (const cf of t.custom_fields || []) {
        row[cf.name] = cf.display_value || '';
      }
      return row;
    });

    return NextResponse.json({
      sheetName: 'Asana Project',
      columns,
      totalRows: tasks.length,
      sampleRows,
      suggestedMapping: { name: 'Name', owner: 'Assignee', next: 'Notes' },
    });
  }

  if (action === 'import') {
    let imported = 0;
    for (const task of tasks) {
      const name = mapping?.name === 'Name' ? task.name : task.name;
      if (!name) continue;

      await prisma.project.create({
        data: {
          userId,
          workspaceId: workspaceId || null,
          code: name.substring(0, 3).toUpperCase() + '-' + String(imported + 1).padStart(2, '0'),
          name,
          client: '',
          owner: task.assignee?.name || session.user?.name || '',
          next: (task.notes || '').substring(0, 200),
          nextWhen: task.due_on || '',
        },
      });
      imported++;
    }

    return NextResponse.json({ ok: true, imported });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
