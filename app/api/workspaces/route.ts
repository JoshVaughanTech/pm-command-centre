import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { projects: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      projectCount: m.workspace._count.projects,
      members: m.workspace.members.map((mem) => ({
        id: mem.user.id,
        name: mem.user.name,
        email: mem.user.email,
        role: mem.role,
      })),
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { name } = await req.json();

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const existing = await prisma.workspace.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: 'A workspace with this name already exists' }, { status: 409 });

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      members: { create: { userId, role: 'owner' } },
    },
  });

  // Move all user's unassigned projects into this workspace
  await prisma.project.updateMany({
    where: { userId, workspaceId: null },
    data: { workspaceId: workspace.id },
  });

  return NextResponse.json({ id: workspace.id, name: workspace.name, slug: workspace.slug }, { status: 201 });
}
