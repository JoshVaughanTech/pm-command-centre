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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(projects.map(mapProject));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json();

  const project = await prisma.project.create({
    data: {
      userId,
      code: body.code,
      name: body.name,
      client: body.client,
      stage: body.stage || 'Planning',
      owner: body.owner || session.user.name || '',
      contact: body.contact || '',
      channel: body.channel || 'Email',
      health: body.health ?? 100,
      risk: body.risk || 'Low',
      next: body.next || '',
      nextWhen: body.nextWhen || '',
      budget: body.budget || 'On track',
      budgetState: body.budgetState || 'good',
      schedule: body.schedule || 'On track',
      scheduleState: body.scheduleState || 'good',
    },
  });

  return NextResponse.json(mapProject(project), { status: 201 });
}
