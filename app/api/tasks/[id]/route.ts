import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const task = await prisma.task.findFirst({
    where: { id: params.id, project: { userId } },
  });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: Record<string, unknown> = { ...body };
  if (body.dueDate) data.dueDate = new Date(body.dueDate);
  if (body.status === 'done' && task.status !== 'done') data.completedAt = new Date();
  if (body.status && body.status !== 'done') data.completedAt = null;

  const updated = await prisma.task.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const task = await prisma.task.findFirst({ where: { id: params.id, project: { userId } } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
