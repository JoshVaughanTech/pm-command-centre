import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  const entries = await prisma.financialEntry.findMany({
    where: {
      projectId: projectId || undefined,
      project: { userId },
    },
    orderBy: { date: 'desc' },
    take: 50,
  });

  // Get totals by type per project
  const totals = await prisma.financialEntry.groupBy({
    by: ['projectId', 'type'],
    where: { projectId: projectId || undefined, project: { userId } },
    _sum: { amount: true },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      type: e.type,
      amount: e.amount,
      description: e.description,
      reference: e.reference,
      date: e.date.toISOString().split('T')[0],
      status: e.status,
    })),
    totals: totals.map((t) => ({ projectId: t.projectId, type: t.type, total: t._sum.amount || 0 })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const project = await prisma.project.findFirst({ where: { id: body.projectId, userId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const entry = await prisma.financialEntry.create({
    data: {
      projectId: body.projectId,
      type: body.type || 'cost',
      amount: body.amount,
      description: body.description || '',
      reference: body.reference || '',
      date: body.date ? new Date(body.date) : new Date(),
      status: body.status || 'pending',
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
