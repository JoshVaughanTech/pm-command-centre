import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL('/auth/signin', req.url));

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/?connect_error=smartsheet', req.url));
  }

  const clientId = process.env.SMARTSHEET_CLIENT_ID;
  const clientSecret = process.env.SMARTSHEET_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL('/?connect_error=not_configured', req.url));
  const baseUrl = process.env.NEXTAUTH_URL || '';
  const redirectUri = `${baseUrl}/api/integrations/smartsheet/callback`;

  // Smartsheet uses SHA-256 hash for token exchange
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(`${clientSecret}|${code}`).digest('hex');

  const tokenRes = await fetch('https://api.smartsheet.com/2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      hash,
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/?connect_error=smartsheet_token', req.url));
  }

  const tokens = await tokenRes.json();

  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'smartsheet' } },
    update: {
      token: tokens.access_token,
      settings: JSON.stringify({
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 604800) * 1000,
      }),
    },
    create: {
      userId,
      provider: 'smartsheet',
      token: tokens.access_token,
      settings: JSON.stringify({
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 604800) * 1000,
      }),
    },
  });

  return NextResponse.redirect(new URL('/?connected=smartsheet', req.url));
}
