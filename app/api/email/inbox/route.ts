import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidToken, matchEmailToProject } from '@/lib/email';
import { formatTimeAgo } from '@/lib/utils';

type EmailItem = {
  id: string;
  from: string;
  fromEmail: string;
  org: string;
  subj: string;
  snip: string;
  at: string;
  project: string;
  projectId: string | null;
  state: 'new' | 'reply' | 'stale' | 'overdue';
  provider: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  // Get user's projects for matching
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, code: true, client: true, contact: true },
  });

  const emails: EmailItem[] = [];

  // Try Microsoft
  const msToken = await getValidToken(userId, 'microsoft_email');
  if (msToken) {
    const msEmails = await fetchMicrosoftEmails(msToken, projects);
    emails.push(...msEmails);
  }

  // Try Google
  const googleToken = await getValidToken(userId, 'google_email');
  if (googleToken) {
    const gmailEmails = await fetchGmailEmails(googleToken, projects);
    emails.push(...gmailEmails);
  }

  // Sort by recency
  emails.sort((a, b) => {
    const order = { new: 0, reply: 1, stale: 2, overdue: 3 };
    return order[a.state] - order[b.state];
  });

  // Update lastTouch on matched projects
  const touchedProjects = new Set<string>();
  for (const email of emails) {
    if (email.projectId && !touchedProjects.has(email.projectId)) {
      touchedProjects.add(email.projectId);
      // Only update if this email is recent (within 24h we consider it a "touch")
      if (email.state === 'new' || email.state === 'reply') {
        await prisma.project.update({
          where: { id: email.projectId },
          data: { lastTouch: new Date() },
        });
      }
    }
  }

  return NextResponse.json({
    emails: emails.slice(0, 20),
    connected: { microsoft: !!msToken, google: !!googleToken },
  });
}

async function fetchMicrosoftEmails(
  token: string,
  projects: Array<{ id: string; code: string; client: string; contact: string }>
): Promise<EmailItem[]> {
  try {
    const res = await fetch(
      'https://graph.microsoft.com/v1.0/me/messages?$top=15&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,receivedDateTime,isRead',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return [];
    const data = await res.json();

    return (data.value || []).map((msg: {
      id: string;
      subject: string;
      bodyPreview: string;
      from: { emailAddress: { name: string; address: string } };
      receivedDateTime: string;
      isRead: boolean;
    }) => {
      const fromEmail = msg.from?.emailAddress?.address || '';
      const fromName = msg.from?.emailAddress?.name || fromEmail;
      const domain = fromEmail.split('@')[1] || '';
      const org = domain.split('.')[0] || '';
      const receivedAt = new Date(msg.receivedDateTime);
      const hoursAgo = (Date.now() - receivedAt.getTime()) / (1000 * 60 * 60);

      const projectId = matchEmailToProject(
        { from: fromName, fromEmail, subject: msg.subject || '', body: msg.bodyPreview || '' },
        projects
      );
      const matchedProject = projectId ? projects.find((p) => p.id === projectId) : null;

      let state: 'new' | 'reply' | 'stale' | 'overdue' = 'new';
      if (msg.isRead) state = 'reply';
      if (hoursAgo > 48) state = 'stale';
      if (hoursAgo > 168) state = 'overdue';

      return {
        id: msg.id,
        from: fromName,
        fromEmail,
        org: org.charAt(0).toUpperCase() + org.slice(1),
        subj: msg.subject || '(no subject)',
        snip: (msg.bodyPreview || '').substring(0, 150),
        at: formatTimeAgo(receivedAt),
        project: matchedProject?.code || '',
        projectId,
        state,
        provider: 'microsoft',
      };
    });
  } catch {
    return [];
  }
}

async function fetchGmailEmails(
  token: string,
  projects: Array<{ id: string; code: string; client: string; contact: string }>
): Promise<EmailItem[]> {
  try {
    // List message IDs
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!listRes.ok) return [];
    const listData = await listRes.json();
    const messageIds = (listData.messages || []).map((m: { id: string }) => m.id);

    const emails: EmailItem[] = [];
    for (const msgId of messageIds.slice(0, 15)) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();

      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const fromRaw = getHeader('From');
      const fromMatch = fromRaw.match(/^(?:"?(.+?)"?\s)?<?([^>]+)>?$/);
      const fromName = fromMatch?.[1] || fromMatch?.[2] || fromRaw;
      const fromEmail = fromMatch?.[2] || fromRaw;
      const domain = fromEmail.split('@')[1] || '';
      const org = domain.split('.')[0] || '';

      const dateStr = getHeader('Date');
      const receivedAt = dateStr ? new Date(dateStr) : new Date();
      const hoursAgo = (Date.now() - receivedAt.getTime()) / (1000 * 60 * 60);

      const subject = getHeader('Subject') || '(no subject)';
      const snippet = msg.snippet || '';

      const projectId = matchEmailToProject(
        { from: fromName, fromEmail, subject, body: snippet },
        projects
      );
      const matchedProject = projectId ? projects.find((p) => p.id === projectId) : null;

      const isRead = !(msg.labelIds || []).includes('UNREAD');
      let state: 'new' | 'reply' | 'stale' | 'overdue' = 'new';
      if (isRead) state = 'reply';
      if (hoursAgo > 48) state = 'stale';
      if (hoursAgo > 168) state = 'overdue';

      emails.push({
        id: msgId,
        from: fromName,
        fromEmail,
        org: org.charAt(0).toUpperCase() + org.slice(1),
        subj: subject,
        snip: snippet.substring(0, 150),
        at: formatTimeAgo(receivedAt),
        project: matchedProject?.code || '',
        projectId,
        state,
        provider: 'google',
      });
    }

    return emails;
  } catch {
    return [];
  }
}
