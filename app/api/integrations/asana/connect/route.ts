import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = process.env.ASANA_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: 'Asana OAuth not configured' }, { status: 500 });

  const baseUrl = process.env.NEXTAUTH_URL || '';
  const redirectUri = `${baseUrl}/api/integrations/asana/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  return NextResponse.redirect(`https://app.asana.com/-/oauth_authorize?${params}`);
}
