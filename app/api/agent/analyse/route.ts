import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidToken, matchEmailToProject } from '@/lib/email';
import { formatTimeAgo, computeComms } from '@/lib/utils';

export const maxDuration = 60; // Allow up to 60s for this endpoint

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const userId = (session.user as { id: string }).id;
  const userName = session.user.name || 'PM';

  // ── 1. Gather current project state ─────────────────────────
  const projects = await prisma.project.findMany({
    where: { userId },
    include: { risks: true },
  });

  if (projects.length === 0) {
    return NextResponse.json({ error: 'No projects to analyse' }, { status: 400 });
  }

  // ── 2. Fetch latest emails if connected ─────────────────────
  let emailData: Array<{ from: string; fromEmail: string; subject: string; snippet: string; age: string; matchedProject: string | null }> = [];

  const msToken = await getValidToken(userId, 'microsoft_email');
  if (msToken) {
    try {
      const res = await fetch(
        'https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc&$select=subject,bodyPreview,from,receivedDateTime',
        { headers: { Authorization: `Bearer ${msToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        emailData = (data.value || []).map((msg: { subject: string; bodyPreview: string; from: { emailAddress: { name: string; address: string } }; receivedDateTime: string }) => {
          const fromEmail = msg.from?.emailAddress?.address || '';
          const fromName = msg.from?.emailAddress?.name || fromEmail;
          const projectId = matchEmailToProject(
            { from: fromName, fromEmail, subject: msg.subject || '', body: msg.bodyPreview || '' },
            projects.map((p) => ({ id: p.id, code: p.code, client: p.client, contact: p.contact }))
          );
          const matched = projectId ? projects.find((p) => p.id === projectId) : null;
          return {
            from: fromName,
            fromEmail,
            subject: msg.subject || '',
            snippet: (msg.bodyPreview || '').substring(0, 200),
            age: formatTimeAgo(new Date(msg.receivedDateTime)),
            matchedProject: matched?.code || null,
          };
        });
      }
    } catch { /* skip */ }
  }

  const googleToken = await getValidToken(userId, 'google_email');
  if (googleToken && emailData.length === 0) {
    try {
      const listRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15',
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        for (const m of (listData.messages || []).slice(0, 15)) {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
            { headers: { Authorization: `Bearer ${googleToken}` } }
          );
          if (msgRes.ok) {
            const msg = await msgRes.json();
            const headers = msg.payload?.headers || [];
            const getH = (n: string) => headers.find((h: { name: string }) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
            const fromRaw = getH('From');
            const match = fromRaw.match(/^(?:"?(.+?)"?\s)?<?([^>]+)>?$/);
            const fromName = match?.[1] || match?.[2] || fromRaw;
            const fromEmail = match?.[2] || fromRaw;
            const subject = getH('Subject');
            const projectId = matchEmailToProject(
              { from: fromName, fromEmail, subject, body: msg.snippet || '' },
              projects.map((p) => ({ id: p.id, code: p.code, client: p.client, contact: p.contact }))
            );
            const matched = projectId ? projects.find((p) => p.id === projectId) : null;
            emailData.push({
              from: fromName, fromEmail, subject,
              snippet: (msg.snippet || '').substring(0, 200),
              age: 'recent', matchedProject: matched?.code || null,
            });
          }
        }
      }
    } catch { /* skip */ }
  }

  // ── 3. Fetch latest integration data snapshots ──────────────
  let integrationNotes = '';
  const integrations = await prisma.integration.findMany({
    where: { userId, provider: { in: ['smartsheet', 'asana', 'monday'] } },
  });
  if (integrations.length > 0) {
    integrationNotes = `Connected PM tools: ${integrations.map((i) => i.provider).join(', ')}. Data was imported from these sources.`;
  }

  // ── 4. Build context and analyse with Claude ────────────────
  const projectContext = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client,
    stage: p.stage,
    phase: p.phase,
    health: p.health,
    risk: p.risk,
    budget: `${p.budget} (${p.budgetState})`,
    schedule: `${p.schedule} (${p.scheduleState})`,
    commsScore: computeComms(p.lastTouch),
    lastTouch: formatTimeAgo(p.lastTouch),
    checkinDays: p.checkinDays,
    next: p.next,
    nextWhen: p.nextWhen,
    owner: p.owner,
    contact: p.contact,
    channel: p.channel,
    currentMove: p.move,
    openRisks: p.risks.map((r) => ({
      id: r.id, title: r.title, severity: r.severity, owner: r.owner, impact: r.impact,
    })),
  }));

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are SNTRI's autonomous analysis engine. Analyse this PM's portfolio and optimise their dashboard.

PM: ${userName}
${integrationNotes}

CURRENT PROJECTS:
${JSON.stringify(projectContext, null, 2)}

RECENT EMAILS (${emailData.length}):
${JSON.stringify(emailData, null, 2)}

Analyse everything and return a JSON object with these arrays. Be specific — use actual project IDs, codes, and data.

{
  "healthUpdates": [
    { "projectId": "...", "newHealth": 75, "reason": "Schedule slipping and 2 high risks open" }
  ],
  "riskUpdates": [
    { "projectId": "...", "newRisk": "High", "reason": "Multiple blockers detected" }
  ],
  "newRisks": [
    { "projectId": "...", "title": "...", "severity": "high|med", "impact": "...", "action": "..." }
  ],
  "moveUpdates": [
    { "projectId": "...", "move": "Specific action headline", "moveBody": "Why this matters right now" }
  ],
  "nextActions": [
    { "projectId": "...", "next": "What needs to happen", "nextWhen": "When" }
  ],
  "commsInsights": [
    { "projectId": "...", "insight": "What the email analysis revealed" }
  ],
  "summary": "2-3 sentence summary of key findings and what was optimised"
}

Rules:
- Only suggest health changes if there's evidence (stale comms, open risks, schedule slips)
- Only create new risks for genuine concerns, not speculation
- Moves should be specific and actionable
- Use email content to inform insights — extract action items, detect urgency
- If an email shows a client waiting for a response, flag it as urgent

Respond ONLY with the JSON object.`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  let analysis;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    analysis = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: 'Failed to parse analysis', raw: text }, { status: 500 });
  }

  // ── 5. Apply changes ────────────────────────────────────────
  const applied: string[] = [];

  // Health updates
  for (const h of analysis.healthUpdates || []) {
    await prisma.project.updateMany({
      where: { id: h.projectId, userId },
      data: { health: Math.min(100, Math.max(0, h.newHealth)) },
    });
    applied.push(`Health: ${h.reason}`);
  }

  // Risk level updates
  for (const r of analysis.riskUpdates || []) {
    await prisma.project.updateMany({
      where: { id: r.projectId, userId },
      data: { risk: r.newRisk },
    });
    applied.push(`Risk level: ${r.reason}`);
  }

  // New risks
  for (const nr of analysis.newRisks || []) {
    const project = projects.find((p) => p.id === nr.projectId);
    if (project) {
      await prisma.risk.create({
        data: {
          userId,
          projectId: nr.projectId,
          title: nr.title,
          severity: nr.severity || 'med',
          impact: nr.impact || '',
          action: nr.action || '',
        },
      });
      applied.push(`New risk on ${project.code}: ${nr.title}`);
    }
  }

  // Move updates
  for (const m of analysis.moveUpdates || []) {
    await prisma.project.updateMany({
      where: { id: m.projectId, userId },
      data: { move: m.move, moveBody: m.moveBody },
    });
  }

  // Next action updates
  for (const n of analysis.nextActions || []) {
    await prisma.project.updateMany({
      where: { id: n.projectId, userId },
      data: { next: n.next, nextWhen: n.nextWhen || '' },
    });
  }

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId,
      action: 'update',
      detail: `SNTRI Agent analysis: ${analysis.summary || 'Portfolio optimised'}`,
    },
  });

  return NextResponse.json({
    summary: analysis.summary,
    healthUpdates: analysis.healthUpdates || [],
    riskUpdates: analysis.riskUpdates || [],
    newRisks: analysis.newRisks || [],
    moveUpdates: (analysis.moveUpdates || []).length,
    nextActions: (analysis.nextActions || []).length,
    commsInsights: analysis.commsInsights || [],
    applied: applied.length,
  });
}
