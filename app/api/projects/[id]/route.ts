import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatTimeAgo, computeComms } from '@/lib/utils';

function mapProject(p: {
  id: string;
  code: string;
  name: string;
  client: string;
  stage: string;
  phase: number;
  health: number;
  risk: string;
  next: string;
  nextWhen: string;
  budget: string;
  budgetState: string;
  schedule: string;
  scheduleState: string;
  lastTouch: Date;
  owner: string;
  contact: string;
  channel: string;
  move: string;
  moveBody: string;
}) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client,
    stage: p.stage,
    phase: p.phase,
    health: p.health,
    risk: p.risk,
    next: p.next,
    nextWhen: p.nextWhen,
    budget: p.budget,
    budgetState: p.budgetState,
    schedule: p.schedule,
    scheduleState: p.scheduleState,
    comms: computeComms(p.lastTouch),
    lastTouch: formatTimeAgo(p.lastTouch),
    owner: p.owner,
    contact: p.contact,
    channel: p.channel,
    move: p.move,
    moveBody: p.moveBody,
    actions: [],
    timeline: [],
  };
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json();

  const existing = await prisma.project.findFirst({
    where: { id: params.id, userId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If health, budget, schedule, or contact fields changed, update lastTouch
  const touchFields = ['health', 'budget', 'budgetState', 'schedule', 'scheduleState', 'next', 'nextWhen'];
  const touchUpdated = touchFields.some((f) => body[f] !== undefined);

  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...body,
      ...(touchUpdated ? { lastTouch: new Date() } : {}),
    },
  });

  return NextResponse.json(mapProject(project));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const existing = await prisma.project.findFirst({
    where: { id: params.id, userId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
