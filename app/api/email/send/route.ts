import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidToken } from '@/lib/email';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { to, subject, body, projectId } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'To, subject, and body are required' }, { status: 400 });
  }

  // Try Microsoft first, then Google
  const msToken = await getValidToken(userId, 'microsoft_email');
  if (msToken) {
    const sent = await sendViaMicrosoft(msToken, to, subject, body);
    if (sent) {
      if (projectId) await updateLastTouch(projectId);
      return NextResponse.json({ ok: true, provider: 'microsoft' });
    }
  }

  const googleToken = await getValidToken(userId, 'google_email');
  if (googleToken) {
    const sent = await sendViaGmail(googleToken, to, subject, body);
    if (sent) {
      if (projectId) await updateLastTouch(projectId);
      return NextResponse.json({ ok: true, provider: 'google' });
    }
  }

  return NextResponse.json({ error: 'No email provider connected. Connect Microsoft 365 or Gmail first.' }, { status: 400 });
}

async function sendViaMicrosoft(token: string, to: string, subject: string, body: string): Promise<boolean> {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    });
    return res.ok || res.status === 202;
  } catch {
    return false;
  }
}

async function sendViaGmail(token: string, to: string, subject: string, body: string): Promise<boolean> {
  try {
    const rawEmail = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      body,
    ].join('\r\n');

    const encoded = Buffer.from(rawEmail).toString('base64url');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function updateLastTouch(projectId: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: { lastTouch: new Date() },
  });
}
