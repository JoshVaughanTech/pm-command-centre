import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { formatTimeAgo, computeComms } from '@/lib/utils';

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { password } = await req.json();

  const share = await prisma.projectShare.findUnique({
    where: { token: params.token },
    include: {
      project: {
        include: { risks: true },
      },
    },
  });

  if (!share || !share.active) {
    return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, share.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const p = share.project;
  const project = {
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
  };

  const risks = p.risks.map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    owner: r.owner,
    impact: r.impact,
    age: formatTimeAgo(r.createdAt),
  }));

  // Fetch messages
  const messages = await prisma.clientMessage.findMany({
    where: { shareId: share.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({
    verified: true,
    shareId: share.id,
    project,
    risks,
    messages: messages.map((m) => ({
      id: m.id,
      from: m.from,
      message: m.message,
      at: formatTimeAgo(m.createdAt),
    })),
  });
}
