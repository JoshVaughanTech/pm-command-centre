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

  const tasks = await prisma.task.findMany({
    where: {
      projectId: projectId || undefined,
      project: { userId },
    },
    orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json(tasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    assignee: t.assignee,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString().split('T')[0] || null,
    completedAt: t.completedAt?.toISOString() || null,
  })));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const project = await prisma.project.findFirst({ where: { id: body.projectId, userId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const task = await prisma.task.create({
    data: {
      projectId: body.projectId,
      title: body.title,
      assignee: body.assignee || '',
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
