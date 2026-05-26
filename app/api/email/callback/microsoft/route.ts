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
    return NextResponse.redirect(new URL('/?email_error=auth_failed', req.url));
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL('/?connect_error=not_configured', req.url));
  const baseUrl = process.env.NEXTAUTH_URL || '';
  const redirectUri = `${baseUrl}/api/email/callback/microsoft`;

  // Exchange code for tokens
  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/?email_error=token_failed', req.url));
  }

  const tokens = await tokenRes.json();

  // Get user email
  const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};

  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'microsoft_email' } },
    update: {
      token: tokens.access_token,
      settings: JSON.stringify({
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
        email: profile.mail || profile.userPrincipalName || '',
      }),
    },
    create: {
      userId,
      provider: 'microsoft_email',
      token: tokens.access_token,
      settings: JSON.stringify({
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
        email: profile.mail || profile.userPrincipalName || '',
      }),
    },
  });

  return NextResponse.redirect(new URL('/?email_connected=microsoft', req.url));
}
