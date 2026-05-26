import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { getValidToken, matchEmailToProject } from '@/lib/email';
import { formatTimeAgo, computeComms } from '@/lib/utils';

export const maxDuration = 300; // 5 min max for cron

const SMARTSHEET_API = 'https://api.smartsheet.com/2.0';

// Vercel cron sends a GET request
export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  // Get all users who have at least one integration or project
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { projects: { some: {} } },
        { integrations: { some: {} } },
      ],
    },
    select: { id: true, name: true },
  });

  const results: Array<{ userId: string; name: string; status: string }> = [];

  for (const user of users) {
    try {
      const result = await processUser(user.id, user.name, apiKey);
      results.push({ userId: user.id, name: user.name, status: result });
    } catch (err) {
      results.push({ userId: user.id, name: user.name, status: `error: ${err}` });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}

async function processUser(userId: string, userName: string, apiKey: string): Promise<string> {
  // 1. Get current projects and risks
  const projects = await prisma.project.findMany({
    where: { userId },
    include: { risks: true },
  });

  if (projects.length === 0) return 'no projects';

  // 2. Sync from connected integrations (check for changes)
  const integrationChanges = await syncIntegrations(userId);

  // 3. Fetch latest emails
  const emailInsights = await fetchEmailInsights(userId, projects);

  // 4. Build context for AI analysis
  const projectContext = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client,
    health: p.health,
    risk: p.risk,
    stage: p.stage,
    commsScore: computeComms(p.lastTouch),
    lastTouch: formatTimeAgo(p.lastTouch),
    checkinDays: p.checkinDays,
    budget: `${p.budget} (${p.budgetState})`,
    schedule: `${p.schedule} (${p.scheduleState})`,
    next: p.next,
    nextWhen: p.nextWhen,
    openRisks: p.risks.length,
    highRisks: p.risks.filter((r) => r.severity === 'high').length,
  }));

  // Only run AI analysis if there are signals worth analysing
  const hasStaleComms = projects.some((p) => computeComms(p.lastTouch) < 40);
  const hasHighRisks = projects.some((p) => p.risks.some((r) => r.severity === 'high'));
  const hasEmailInsights = emailInsights.length > 0;
  const hasIntegrationChanges = integrationChanges.length > 0;

  if (!hasStaleComms && !hasHighRisks && !hasEmailInsights && !hasIntegrationChanges) {
    return 'no action needed';
  }

  // 5. Run AI analysis
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are SNTRI's autonomous background agent. Analyse this PM's portfolio and apply updates.

PM: ${userName}. Today: ${new Date().toISOString().split('T')[0]}.

PROJECTS:
${JSON.stringify(projectContext, null, 2)}

${emailInsights.length > 0 ? `NEW EMAIL SIGNALS:\n${JSON.stringify(emailInsights, null, 2)}` : ''}
${integrationChanges.length > 0 ? `INTEGRATION CHANGES:\n${JSON.stringify(integrationChanges, null, 2)}` : ''}

Return a JSON object with ONLY changes that should be made. Be conservative — only update when there's clear evidence.

{
  "healthUpdates": [{ "projectId": "...", "newHealth": 70, "reason": "..." }],
  "moveUpdates": [{ "projectId": "...", "move": "...", "moveBody": "..." }],
  "notifications": [{ "type": "stale|risk|message", "title": "...", "detail": "...", "projectId": "..." }]
}

Rules:
- Only change health if comms score < 40, or high risks are unresolved, or schedule is bad
- Generate moves only for projects that don't have one or whose situation changed
- Create notifications for things the PM needs to act on NOW
- Keep it minimal — don't flood with notifications

Respond ONLY with the JSON.`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  let analysis;
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    analysis = JSON.parse(cleaned);
  } catch {
    return 'ai parse error';
  }

  // 6. Apply changes
  let changes = 0;

  for (const h of analysis.healthUpdates || []) {
    await prisma.project.updateMany({
      where: { id: h.projectId, userId },
      data: { health: Math.min(100, Math.max(0, h.newHealth)) },
    });
    changes++;
  }

  for (const m of analysis.moveUpdates || []) {
    await prisma.project.updateMany({
      where: { id: m.projectId, userId },
      data: { move: m.move, moveBody: m.moveBody },
    });
    changes++;
  }

  // Log activity
  if (changes > 0) {
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'update',
        detail: `Background agent: ${changes} updates applied (${(analysis.healthUpdates || []).length} health, ${(analysis.moveUpdates || []).length} moves)`,
      },
    });
  }

  return `${changes} changes applied`;
}

async function syncIntegrations(
  userId: string,
): Promise<Array<{ type: string; detail: string }>> {
  const changes: Array<{ type: string; detail: string }> = [];

  // Check Smartsheet for updates
  const ssIntegration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: 'smartsheet' } },
  });

  if (ssIntegration) {
    try {
      const res = await fetch(`${SMARTSHEET_API}/sheets?modifiedSince=${new Date(Date.now() - 30 * 60 * 1000).toISOString()}&includeOwnerInfo=false`, {
        headers: { Authorization: `Bearer ${ssIntegration.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const recentlyModified = (data.data || []).length;
        if (recentlyModified > 0) {
          changes.push({ type: 'smartsheet', detail: `${recentlyModified} sheets modified in the last 30 minutes` });
        }
      }
    } catch { /* skip */ }
  }

  return changes;
}

async function fetchEmailInsights(
  userId: string,
  projects: Array<{ id: string; code: string; client: string; contact: string }>
): Promise<Array<{ from: string; subject: string; matchedProject: string | null; age: string }>> {
  const insights: Array<{ from: string; subject: string; matchedProject: string | null; age: string }> = [];

  // Check Microsoft emails (last 30 min only)
  const msToken = await getValidToken(userId, 'microsoft_email');
  if (msToken) {
    try {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages?$top=10&$filter=receivedDateTime ge ${since}&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview`,
        { headers: { Authorization: `Bearer ${msToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        for (const msg of data.value || []) {
          const fromEmail = msg.from?.emailAddress?.address || '';
          const fromName = msg.from?.emailAddress?.name || fromEmail;
          const projectId = matchEmailToProject(
            { from: fromName, fromEmail, subject: msg.subject || '', body: msg.bodyPreview || '' },
            projects
          );
          const matched = projectId ? projects.find((p) => p.id === projectId) : null;
          insights.push({
            from: fromName,
            subject: msg.subject || '',
            matchedProject: matched?.code || null,
            age: formatTimeAgo(new Date(msg.receivedDateTime)),
          });
        }
      }
    } catch { /* skip */ }
  }

  // Check Gmail (last 30 min)
  const googleToken = await getValidToken(userId, 'google_email');
  if (googleToken && insights.length === 0) {
    try {
      const since = Math.floor((Date.now() - 30 * 60 * 1000) / 1000);
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=after:${since}`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        for (const m of (data.messages || []).slice(0, 5)) {
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
              projects
            );
            const matched = projectId ? projects.find((p) => p.id === projectId) : null;
            insights.push({ from: fromName, subject, matchedProject: matched?.code || null, age: 'recent' });
          }
        }
      }
    } catch { /* skip */ }
  }

  return insights;
}
