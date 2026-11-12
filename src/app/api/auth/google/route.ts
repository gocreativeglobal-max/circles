import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAppBaseUrl, getGoogleOAuthCredentials } from '@/lib/config/env';

export async function GET(req: NextRequest) {
  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    return NextResponse.redirect(new URL('/login?error=google_not_configured', req.url));
  }

  // Determine dynamic origin (supports localhost and joincircles.online)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto =
    req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : getAppBaseUrl();
  const redirectUri = `${origin}/api/auth/google/callback`;

  // Cryptographically secure state for CSRF mitigation
  const state = crypto.randomBytes(24).toString('hex');
  const returnUrl =
    req.nextUrl.searchParams.get('returnUrl') ||
    req.nextUrl.searchParams.get('next') ||
    '/circles';

  // Build Google OAuth authorization URL
  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const response = NextResponse.redirect(googleAuthUrl);

  const isProd = process.env.NODE_ENV === 'production';

  // Store state in HTTP-only cookie for verification on callback
  response.cookies.set('circles_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProd,
    maxAge: 600, // 10 minutes
  });

  // Store sanitize return URL
  const safeReturn = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/circles';
  response.cookies.set('circles_oauth_return', safeReturn, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProd,
    maxAge: 600,
  });

  return response;
}
