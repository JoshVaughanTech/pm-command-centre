import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { email, role } = body;

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  // Check the inviter is owner or admin
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, workspaceId: params.id, role: { in: ['owner', 'admin'] } },
  });
  if (!membership) return NextResponse.json({ error: 'Only owners and admins can invite' }, { status: 403 });

  // Find the user to invite
  const invitee = await prisma.user.findUnique({ where: { email } });
  if (!invitee) return NextResponse.json({ error: 'No account found with that email. They need to sign up first.' }, { status: 404 });

  // Check if already a member
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId: invitee.id, workspaceId: params.id },
  });
  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 });

  await prisma.workspaceMember.create({
    data: {
      userId: invitee.id,
      workspaceId: params.id,
      role: role || 'member',
    },
  });

  return NextResponse.json({ ok: true, name: invitee.name, email: invitee.email });
}
