import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { projectIds, updates } = body;

  if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
    return NextResponse.json({ error: 'Project IDs are required' }, { status: 400 });
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'Updates are required' }, { status: 400 });
  }

  // Only allow safe fields to be bulk-updated
  const allowedFields = ['stage', 'risk', 'health', 'budgetState', 'scheduleState'];
  const safeUpdates: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      safeUpdates[key] = value as string | number;
    }
  }

  const updated = await prisma.project.updateMany({
    where: { id: { in: projectIds }, userId },
    data: safeUpdates,
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'update',
      detail: `Bulk updated ${updated.count} projects: ${Object.keys(safeUpdates).join(', ')}`,
    },
  });

  return NextResponse.json({ updated: updated.count });
}
