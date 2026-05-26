import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { memberId } = body;

  // Check the requester is owner or admin
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId: params.id, role: { in: ['owner', 'admin'] } },
  });
  if (!membership) return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 });

  // Can't remove yourself if you're the only owner
  if (memberId === userId) {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId: params.id, role: 'owner' },
    });
    if (ownerCount <= 1) return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 400 });
  }

  await prisma.workspaceMember.deleteMany({
    where: { userId: memberId, workspaceId: params.id },
  });

  return NextResponse.json({ ok: true });
}
