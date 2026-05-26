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

  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      projectId: projectId || undefined,
    },
    orderBy: { date: 'desc' },
    take: 50,
  });

  // Also get totals per project
  const totals = await prisma.timeEntry.groupBy({
    by: ['projectId'],
    where: { userId, projectId: projectId || undefined },
    _sum: { hours: true },
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      hours: e.hours,
      date: e.date.toISOString().split('T')[0],
      note: e.note,
      taskId: e.taskId,
    })),
    totals: totals.map((t) => ({ projectId: t.projectId, totalHours: t._sum.hours || 0 })),
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

  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      projectId: body.projectId,
      hours: body.hours,
      date: body.date ? new Date(body.date) : new Date(),
      note: body.note || '',
      taskId: body.taskId || null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
