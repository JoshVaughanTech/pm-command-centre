import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatTimeAgo } from '@/lib/utils';

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { shareId, from, message } = await req.json();

  if (!shareId || !from || !message) {
    return NextResponse.json({ error: 'Name and message are required' }, { status: 400 });
  }

  // Verify share exists and is active
  const share = await prisma.projectShare.findUnique({
    where: { token: params.token },
  });

  if (!share || !share.active || share.id !== shareId) {
    return NextResponse.json({ error: 'Invalid share' }, { status: 404 });
  }

  const msg = await prisma.clientMessage.create({
    data: { shareId: share.id, from, message },
  });

  return NextResponse.json({
    id: msg.id,
    from: msg.from,
    message: msg.message,
    at: formatTimeAgo(msg.createdAt),
  }, { status: 201 });
}
