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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL('/?connect_error=not_configured', req.url));
  const baseUrl = process.env.NEXTAUTH_URL || '';
  const redirectUri = `${baseUrl}/api/email/callback/google`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};

  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'google_email' } },
    update: {
      token: tokens.access_token,
      settings: JSON.stringify({
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
        email: profile.email || '',
      }),
    },
    create: {
      userId,
      provider: 'google_email',
      token: tokens.access_token,
      settings: JSON.stringify({
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
        email: profile.email || '',
      }),
    },
  });

  return NextResponse.redirect(new URL('/?email_connected=google', req.url));
}
