import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const SMARTSHEET_API = 'https://api.smartsheet.com/2.0';

// GET — check connection status + list sheets
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'smartsheet' } },
  });

  if (!integration) {
    return NextResponse.json({ connected: false, sheets: [] });
  }

  // Fetch sheets from Smartsheet
  try {
    const res = await fetch(`${SMARTSHEET_API}/sheets?includeOwnerInfo=true`, {
      headers: { Authorization: `Bearer ${integration.token}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ connected: false, error: 'Token expired or invalid', sheets: [] });
      }
      return NextResponse.json({ connected: true, error: 'Failed to fetch sheets', sheets: [] });
    }

    const data = await res.json();
    const sheets = (data.data || []).map((s: { id: number; name: string; createdAt: string; modifiedAt: string; totalRowCount: number }) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      modifiedAt: s.modifiedAt,
      rowCount: s.totalRowCount || 0,
    }));

    return NextResponse.json({ connected: true, sheets });
  } catch {
    return NextResponse.json({ connected: true, error: 'Network error', sheets: [] });
  }
}

// POST — connect (save token) or disconnect
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { action, token } = await req.json();

  if (action === 'disconnect') {
    await prisma.integration.deleteMany({ where: { userId, provider: 'smartsheet' } });
    return NextResponse.json({ ok: true });
  }

  if (!token) return NextResponse.json({ error: 'API token is required' }, { status: 400 });

  // Verify the token works
  const res = await fetch(`${SMARTSHEET_API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Invalid API token' }, { status: 400 });
  }

  const user = await res.json();

  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'smartsheet' } },
    update: { token },
    create: { userId, provider: 'smartsheet', token },
  });

  return NextResponse.json({ ok: true, smartsheetUser: user.email || user.firstName });
}
