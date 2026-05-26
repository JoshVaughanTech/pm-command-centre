import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const views = await prisma.savedView.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(views.map((v) => ({
    id: v.id,
    name: v.name,
    layout: JSON.parse(v.layout),
    isDefault: v.isDefault,
  })));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { name, layout } = body;

  if (!name || !layout) return NextResponse.json({ error: 'Name and layout are required' }, { status: 400 });

  const view = await prisma.savedView.create({
    data: {
      userId,
      name,
      layout: JSON.stringify(layout),
    },
  });

  return NextResponse.json({ id: view.id, name: view.name }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { id } = body;

  await prisma.savedView.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
