import { prisma } from './prisma';

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function getValidToken(userId: string, provider: 'microsoft_email' | 'google_email'): Promise<string | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (!integration) return null;

  const settings = JSON.parse(integration.settings || '{}');
  const expiresAt = settings.expiresAt || 0;

  // If token is still valid (with 5 min buffer), return it
  if (Date.now() < expiresAt - 300000) {
    return integration.token;
  }

  // Refresh the token
  const refreshToken = settings.refreshToken;
  if (!refreshToken) return null;

  const isMs = provider === 'microsoft_email';
  const tokenUrl = isMs ? MS_TOKEN_URL : GOOGLE_TOKEN_URL;
  const clientId = isMs ? process.env.MICROSOFT_CLIENT_ID : process.env.GOOGLE_CLIENT_ID;
  const clientSecret = isMs ? process.env.MICROSOFT_CLIENT_SECRET : process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) return null;

  const data = await res.json();

  await prisma.integration.update({
    where: { userId_provider: { userId, provider } },
    data: {
      token: data.access_token,
      settings: JSON.stringify({
        ...settings,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      }),
    },
  });

  return data.access_token;
}

export function matchEmailToProject(
  email: { from: string; fromEmail: string; subject: string; body: string },
  projects: Array<{ code: string; client: string; contact: string; id: string }>
): string | null {
  const fromLower = email.fromEmail.toLowerCase();
  const subjectLower = email.subject.toLowerCase();
  const bodyLower = (email.body || '').toLowerCase().substring(0, 500);

  for (const p of projects) {
    // Match by contact email domain
    if (p.contact && fromLower.includes(p.contact.toLowerCase().split(' ')[0])) return p.id;

    // Match by project code in subject
    if (p.code && subjectLower.includes(p.code.toLowerCase())) return p.id;

    // Match by client name in sender or subject
    if (p.client) {
      const clientLower = p.client.toLowerCase();
      const clientWords = clientLower.split(/\s+/).filter(w => w.length > 3);
      for (const word of clientWords) {
        if (fromLower.includes(word) || subjectLower.includes(word)) return p.id;
      }
    }

    // Match by project code in body
    if (p.code && bodyLower.includes(p.code.toLowerCase())) return p.id;
  }

  return null;
}
