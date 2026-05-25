import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST — create a share link for a project
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { projectId, password } = await req.json();

  if (!projectId || !password) {
    return NextResponse.json({ error: 'Project ID and password are required' }, { status: 400 });
  }

  // Verify the user owns this project
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const passwordHash = await bcrypt.hash(password, 10);

  const share = await prisma.projectShare.create({
    data: {
      projectId,
      passwordHash,
      createdBy: userId,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || '';
  return NextResponse.json({
    token: share.token,
    url: `${baseUrl}/share/${share.token}`,
  }, { status: 201 });
}

// GET — list shares for user's projects
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const shares = await prisma.projectShare.findMany({
    where: { createdBy: userId, active: true },
    include: {
      project: { select: { code: true, name: true, client: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(shares.map((s) => ({
    id: s.id,
    token: s.token,
    projectCode: s.project.code,
    projectName: s.project.name,
    client: s.project.client,
    messageCount: s._count.messages,
    createdAt: s.createdAt,
  })));
}
