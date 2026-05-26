import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidToken } from '@/lib/email';
import { formatTimeAgo, computeComms } from '@/lib/utils';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'send_email',
    description: 'Send an email on behalf of the PM via their connected email provider (Microsoft 365 or Gmail). Use this when the PM asks you to send, draft & send, or email someone.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body text' },
        projectId: { type: 'string', description: 'Project ID to link this email to (for comms tracking)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'update_project',
    description: 'Update a project\'s fields. Use this when the PM asks you to change health, stage, risk level, next action, budget, schedule, or any project field.',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'The project ID to update' },
        health: { type: 'number', description: 'Health score 0-100' },
        risk: { type: 'string', description: 'Risk level: Low, Medium, or High' },
        stage: { type: 'string', description: 'Project stage: Planning, Delivery, Commissioning, or Handover' },
        next: { type: 'string', description: 'Next action description' },
        nextWhen: { type: 'string', description: 'When the next action is due' },
        budget: { type: 'string', description: 'Budget status text (e.g. "+4.2%")' },
        budgetState: { type: 'string', description: 'Budget state: good, warn, or bad' },
        schedule: { type: 'string', description: 'Schedule status text (e.g. "-2 days")' },
        scheduleState: { type: 'string', description: 'Schedule state: good, warn, or bad' },
        move: { type: 'string', description: 'Recommended move headline' },
        moveBody: { type: 'string', description: 'Recommended move explanation' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'log_risk',
    description: 'Create a new risk on a project. Use when the PM mentions a concern, blocker, or issue that should be tracked.',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
        title: { type: 'string', description: 'Risk title' },
        severity: { type: 'string', description: 'high or med' },
        owner: { type: 'string', description: 'Who owns mitigation' },
        impact: { type: 'string', description: 'Impact if risk materialises' },
        action: { type: 'string', description: 'Mitigation action' },
      },
      required: ['projectId', 'title'],
    },
  },
  {
    name: 'resolve_risk',
    description: 'Delete/resolve a risk. Use when the PM says a risk is resolved, closed, or no longer relevant.',
    input_schema: {
      type: 'object' as const,
      properties: {
        riskId: { type: 'string', description: 'The risk ID to resolve' },
      },
      required: ['riskId'],
    },
  },
];

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string,
): Promise<string> {
  switch (toolName) {
    case 'send_email': {
      // Try Microsoft first, then Gmail
      const msToken = await getValidToken(userId, 'microsoft_email');
      const googleToken = await getValidToken(userId, 'google_email');

      if (!msToken && !googleToken) {
        return 'No email provider connected. Ask the PM to connect Microsoft 365 or Gmail from the Inbox panel.';
      }

      const { to, subject, body, projectId } = toolInput as { to: string; subject: string; body: string; projectId?: string };

      if (msToken) {
        const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: { Authorization: `Bearer ${msToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { subject, body: { contentType: 'Text', content: body }, toRecipients: [{ emailAddress: { address: to } }] } }),
        });
        if (res.ok || res.status === 202) {
          if (projectId) await prisma.project.update({ where: { id: projectId }, data: { lastTouch: new Date() } });
          await prisma.activityLog.create({ data: { userId, projectId, action: 'update', detail: `Sent email to ${to}: ${subject}` } });
          return `Email sent to ${to} via Microsoft 365.`;
        }
      }

      if (googleToken) {
        const rawEmail = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', '', body].join('\r\n');
        const encoded = Buffer.from(rawEmail).toString('base64url');
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: encoded }),
        });
        if (res.ok) {
          if (projectId) await prisma.project.update({ where: { id: projectId }, data: { lastTouch: new Date() } });
          await prisma.activityLog.create({ data: { userId, projectId, action: 'update', detail: `Sent email to ${to}: ${subject}` } });
          return `Email sent to ${to} via Gmail.`;
        }
      }

      return 'Failed to send email. The token may have expired — ask the PM to reconnect their email.';
    }

    case 'update_project': {
      const { projectId, ...updates } = toolInput as { projectId: string; [key: string]: unknown };
      const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
      if (!project) return 'Project not found.';

      await prisma.project.update({ where: { id: projectId }, data: { ...updates, lastTouch: new Date() } });
      const fields = Object.keys(updates).join(', ');
      await prisma.activityLog.create({ data: { userId, projectId, action: 'update', detail: `Agent updated ${project.code}: ${fields}` } });
      return `Updated ${project.code}: ${fields}.`;
    }

    case 'log_risk': {
      const { projectId, title, severity, owner, impact, action } = toolInput as {
        projectId: string; title: string; severity?: string; owner?: string; impact?: string; action?: string;
      };
      const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
      if (!project) return 'Project not found.';

      await prisma.risk.create({
        data: { userId, projectId, title, severity: severity || 'med', owner: owner || '', impact: impact || '', action: action || '' },
      });
      await prisma.activityLog.create({ data: { userId, projectId, action: 'risk_add', detail: `Agent logged risk on ${project.code}: ${title}` } });
      return `Risk logged on ${project.code}: ${title}`;
    }

    case 'resolve_risk': {
      const { riskId } = toolInput as { riskId: string };
      const risk = await prisma.risk.findFirst({ where: { id: riskId, userId } });
      if (!risk) return 'Risk not found.';

      await prisma.risk.delete({ where: { id: riskId } });
      await prisma.activityLog.create({ data: { userId, action: 'risk_resolve', detail: `Agent resolved risk: ${risk.title}` } });
      return `Risk resolved: ${risk.title}`;
    }

    default:
      return 'Unknown tool.';
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const userId = (session.user as { id: string }).id;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { message, history } = body;

  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

  // Gather full project context
  const [projects, risks, activity] = await Promise.all([
    prisma.project.findMany({ where: { userId }, include: { risks: true } }),
    prisma.risk.findMany({ where: { userId }, include: { project: { select: { code: true, name: true } } } }),
    prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 15 }),
  ]);

  const projectSummaries = projects.map((p) => ({
    id: p.id, code: p.code, name: p.name, client: p.client, stage: p.stage,
    phase: `${p.phase}/8`, health: p.health, risk: p.risk,
    budget: `${p.budget} (${p.budgetState})`, schedule: `${p.schedule} (${p.scheduleState})`,
    commsScore: computeComms(p.lastTouch), lastTouch: formatTimeAgo(p.lastTouch),
    next: p.next || 'None set', nextWhen: p.nextWhen || 'Not scheduled',
    owner: p.owner, contact: p.contact, channel: p.channel, move: p.move,
    openRisks: p.risks.map((r) => ({
      id: r.id, title: r.title, severity: r.severity, owner: r.owner,
    })),
  }));

  const riskSummary = risks.map((r) => ({
    id: r.id, title: r.title, severity: r.severity, project: r.project.code,
    owner: r.owner, age: formatTimeAgo(r.createdAt),
  }));

  const systemPrompt = `You are SNTRI Agent, an AI assistant embedded in a project management platform. You can both answer questions AND take actions.

Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. PM: ${session.user.name || 'the user'}.

PROJECTS (${projects.length}):
${JSON.stringify(projectSummaries, null, 2)}

OPEN RISKS (${risks.length}):
${JSON.stringify(riskSummary, null, 2)}

RECENT ACTIVITY:
${JSON.stringify(activity.map((a) => ({ action: a.action, detail: a.detail, when: formatTimeAgo(a.createdAt) })), null, 2)}

You have tools to take action directly:
- send_email: Send emails via the PM's connected provider
- update_project: Change any project field (health, stage, risk, next action, etc.)
- log_risk: Create a new risk on a project
- resolve_risk: Close/resolve an existing risk

IMPORTANT: When the PM asks you to DO something (send an email, update a project, log a risk), USE THE TOOLS. Don't just draft text — actually do it. If they say "send Amanda an update", use send_email. If they say "drop health on ACC-VIN to 60", use update_project.

Response format:
- Keep text responses SHORT. Bullet points, not paragraphs. Max 3-5 bullets.
- After using a tool, confirm what you did in one line.
- Lead with action, not reasoning.
- Use project codes (ACC-VIN) not full names.`;

  // Build conversation
  const messages: Anthropic.MessageParam[] = [];
  if (history && Array.isArray(history)) {
    for (const h of history.slice(-10)) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: 'user', content: message });

  const client = new Anthropic({ apiKey });

  // Agentic loop — keep running until no more tool calls
  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    tools: TOOLS,
    messages,
  });

  const toolResults: string[] = [];

  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter((b) => b.type === 'tool_use');
    const toolResultMessages: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolBlocks) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input as Record<string, unknown>, userId);
        toolResults.push(result);
        toolResultMessages.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }

    // Continue the conversation with tool results
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResultMessages });

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });
  }

  // Extract final text reply
  const textBlocks = response.content.filter((b) => b.type === 'text');
  const reply = textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n');

  return NextResponse.json({
    reply,
    actions: toolResults,
  });
}
