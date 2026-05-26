import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatTimeAgo } from '@/lib/utils';

function mapRisk(r: {
  id: string;
  title: string;
  projectId: string;
  owner: string;
  severity: string;
  impact: string;
  action: string;
  createdAt: Date;
  project: { code: string };
}) {
  return {
    id: r.id,
    title: r.title,
    project: r.project.code,
    projectId: r.projectId,
    owner: r.owner,
    age: formatTimeAgo(r.createdAt),
    severity: r.severity,
    impact: r.impact,
    action: r.action,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const risks = await prisma.risk.findMany({
    where: { userId },
    include: { project: { select: { code: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(risks.map(mapRisk));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  // Verify the project belongs to this user
  const project = await prisma.project.findFirst({
    where: { id: body.projectId, userId },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const risk = await prisma.risk.create({
    data: {
      userId,
      projectId: body.projectId,
      title: body.title,
      owner: body.owner || '',
      severity: body.severity || 'med',
      impact: body.impact || '',
      action: body.action || '',
    },
    include: { project: { select: { code: true } } },
  });

  return NextResponse.json(mapRisk(risk), { status: 201 });
}
