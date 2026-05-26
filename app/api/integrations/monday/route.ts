import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MONDAY_API = 'https://api.monday.com/v2';

async function mondayQuery(token: string, query: string) {
  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'monday' } },
  });

  if (!integration) return NextResponse.json({ connected: false, sheets: [] });

  try {
    const data = await mondayQuery(
      integration.token,
      '{ boards(limit: 50) { id name items_count } }'
    );

    if (data.errors) return NextResponse.json({ connected: false, error: 'Token invalid', sheets: [] });

    const boards = (data.data?.boards || []).map((b: { id: string; name: string; items_count: number }) => ({
      id: b.id,
      name: b.name,
      rowCount: b.items_count || 0,
    }));

    return NextResponse.json({ connected: true, sheets: boards });
  } catch {
    return NextResponse.json({ connected: true, error: 'Network error', sheets: [] });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { action, token } = body;

  if (action === 'disconnect') {
    await prisma.integration.deleteMany({ where: { userId, provider: 'monday' } });
    return NextResponse.json({ ok: true });
  }

  if (!token) return NextResponse.json({ error: 'API token is required' }, { status: 400 });

  const data = await mondayQuery(token, '{ me { name email } }');
  if (data.errors || !data.data?.me) {
    return NextResponse.json({ error: 'Invalid API token' }, { status: 400 });
  }

  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'monday' } },
    update: { token },
    create: { userId, provider: 'monday', token },
  });

  return NextResponse.json({ ok: true });
}
