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
    return NextResponse.redirect(new URL('/?connect_error=monday', req.url));
  }

  const clientId = process.env.MONDAY_CLIENT_ID;
  const clientSecret = process.env.MONDAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL('/?connect_error=not_configured', req.url));
  const baseUrl = process.env.NEXTAUTH_URL || '';
  const redirectUri = `${baseUrl}/api/integrations/monday/callback`;

  const tokenRes = await fetch('https://auth.monday.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/?connect_error=monday_token', req.url));
  }

  const tokens = await tokenRes.json();

  await prisma.integration.upsert({
    where: { userId_provider: { userId, provider: 'monday' } },
    update: { token: tokens.access_token },
    create: {
      userId,
      provider: 'monday',
      token: tokens.access_token,
    },
  });

  return NextResponse.redirect(new URL('/?connected=monday', req.url));
}
