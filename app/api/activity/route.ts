import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatTimeAgo } from '@/lib/utils';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const logs = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  return NextResponse.json(logs.map((l) => ({
    id: l.id,
    action: l.action,
    detail: l.detail,
    projectId: l.projectId,
    at: formatTimeAgo(l.createdAt),
  })));
}
