import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatTimeAgo, computeComms } from '@/lib/utils';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const userId = (session.user as { id: string }).id;

  const projects = await prisma.project.findMany({
    where: { userId },
    include: { risks: true },
  });

  if (projects.length === 0) return NextResponse.json([]);

  const summaries = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client,
    stage: p.stage,
    health: p.health,
    risk: p.risk,
    budget: `${p.budget} (${p.budgetState})`,
    schedule: `${p.schedule} (${p.scheduleState})`,
    commsScore: computeComms(p.lastTouch),
    lastTouch: formatTimeAgo(p.lastTouch),
    next: p.next || 'None set',
    nextWhen: p.nextWhen || 'Not scheduled',
    owner: p.owner,
    contact: p.contact,
    openRisks: p.risks.map((r) => ({
      title: r.title,
      severity: r.severity,
    })),
  }));

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `You are an AI assistant for a project manager. Analyse these projects and generate a recommended next move for each.

For each project, provide:
- "move": A single-sentence imperative action headline. Be specific — name the person, the deliverable, the deadline. e.g. "Chase Daniel for switch-port confirmation before noon."
- "moveBody": 1–2 sentences explaining why this move matters right now and what happens if it slips.

Prioritise by urgency: low health, overdue comms (commsScore < 50 means the client hasn't heard from you recently), high-severity risks, approaching deadlines.

Projects:
${JSON.stringify(summaries, null, 2)}

Respond ONLY with a JSON array: [{"id": "...", "move": "...", "moveBody": "..."}]`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  let moves: Array<{ id: string; move: string; moveBody: string }>;
  try {
    // Handle potential markdown code fences in response
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    moves = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  // Save moves to database
  for (const m of moves) {
    await prisma.project.updateMany({
      where: { id: m.id, userId },
      data: { move: m.move, moveBody: m.moveBody },
    });
  }

  return NextResponse.json(moves);
}
