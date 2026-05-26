import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatTimeAgo, computeComms } from '@/lib/utils';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const userId = (session.user as { id: string }).id;
  const { message, history } = await req.json();

  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  // Gather full project context
  const [projects, risks, activity] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      include: { risks: true },
    }),
    prisma.risk.findMany({
      where: { userId },
      include: { project: { select: { code: true, name: true } } },
    }),
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  const projectSummaries = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client,
    stage: p.stage,
    phase: `${p.phase}/8`,
    health: p.health,
    risk: p.risk,
    budget: `${p.budget} (${p.budgetState})`,
    schedule: `${p.schedule} (${p.scheduleState})`,
    commsScore: computeComms(p.lastTouch),
    lastTouch: formatTimeAgo(p.lastTouch),
    checkinDays: p.checkinDays,
    next: p.next || 'None set',
    nextWhen: p.nextWhen || 'Not scheduled',
    owner: p.owner,
    contact: p.contact,
    channel: p.channel,
    move: p.move,
    openRisks: p.risks.map((r) => ({
      title: r.title,
      severity: r.severity,
      owner: r.owner,
      impact: r.impact,
      action: r.action,
      age: formatTimeAgo(r.createdAt),
    })),
  }));

  const riskSummary = risks.map((r) => ({
    title: r.title,
    severity: r.severity,
    project: r.project.code,
    owner: r.owner,
    impact: r.impact,
    age: formatTimeAgo(r.createdAt),
  }));

  const recentActivity = activity.map((a) => ({
    action: a.action,
    detail: a.detail,
    when: formatTimeAgo(a.createdAt),
  }));

  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const systemPrompt = `You are SNTRI Agent, an AI assistant embedded in a project management platform called SNTRI. You help project managers work more effectively.

Today is ${dayName}, ${dateStr}. The PM's name is ${session.user.name || 'the user'}.

You have full access to their portfolio data:

PROJECTS (${projects.length}):
${JSON.stringify(projectSummaries, null, 2)}

OPEN RISKS (${risks.length}):
${JSON.stringify(riskSummary, null, 2)}

RECENT ACTIVITY:
${JSON.stringify(recentActivity, null, 2)}

Your capabilities:
- Analyse project health and suggest priorities
- Draft client emails, status updates, and reports
- Identify risks and suggest mitigations
- Prepare talking points for client calls
- Summarise portfolio status for stakeholders
- Recommend what to focus on today/this week
- Answer questions about any project using the data above

Guidelines:
- Be specific — name projects, people, and dates
- Be concise — PMs are busy, get to the point
- When drafting emails, make them professional but warm
- When prioritising, consider: health score, comms staleness, risk severity, upcoming deadlines
- If asked to draft something, provide the complete text ready to use
- Use the PM's actual project data, never make up information`;

  // Build conversation history
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (history && Array.isArray(history)) {
    for (const h of history.slice(-10)) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: 'user', content: message });

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages,
  });

  const reply = response.content[0].type === 'text' ? response.content[0].text : '';

  return NextResponse.json({ reply });
}
