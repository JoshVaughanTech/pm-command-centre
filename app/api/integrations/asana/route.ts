import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ASANA_API = 'https://app.asana.com/api/1.0';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'asana' } },
  });

  if (!integration) return NextResponse.json({ connected: false, sheets: [] });

  try {
    // Fetch workspaces, then projects from each
    const wsRes = await fetch(`${ASANA_API}/workspaces?opt_fields=name`, {
      headers: { Authorization: `Bearer ${integration.token}` },
    });
    if (!wsRes.ok) return NextResponse.json({ connected: false, error: 'Token invalid', sheets: [] });

    const wsData = await wsRes.json();
    const workspaces = wsData.data || [];

    const allProjects: Array<{ id: string; name: string; rowCount: number }> = [];
    for (const ws of workspaces.slice(0, 5)) {
      const projRes = await fetch(
        `${ASANA_API}/projects?workspace=${ws.gid}&opt_fields=name,num_tasks&limit=50`,
        { headers: { Authorization: `Bearer ${integration.token}` } }
      );
      if (projRes.ok) {
        const projData = await projRes.json();
        for (const p of projData.data || []) {
          allProjects.push({ id: p.gid, name: `${p.name} (${ws.name})`, rowCount: p.num_tasks || 0 });
        }
      }
    }

    return NextResponse.json({ connected: true, sheets: allProjects });
  } catch {
    return NextResponse.json({ connected: true, error: 'Network error', sheets: [] });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { action, token } = await req.json();

  if (action === 'disconnect') {
    await prisma.integration.deleteMany({ where: { userId, provider: 'asana' } });
    return NextResponse.json({ ok: true });
  }

  if (!token) return NextResponse.json({ error: 'Personal Access Token is required' }, { status: 400 });

  const res = await fetch(`${ASANA_API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'asana' } },
    update: { token },
    create: { userId, provider: 'asana', token },
  });

  return NextResponse.json({ ok: true });
}
