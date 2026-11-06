import { NextRequest, NextResponse } from 'next/server';
import { authenticateWithGoogle, signOutUser } from '@/features/auth/service';
import { getAppBaseUrl, getGoogleOAuthCredentials } from '@/lib/config/env';
import { extractRequestSessionToken } from '@/lib/auth/api-helpers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logger } from '@/lib/logging';

export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto =
    req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : getAppBaseUrl();
  const loginUrl = new URL('/login', origin);

  const searchParams = req.nextUrl.searchParams;
  const errorParam = searchParams.get('error');
  if (errorParam) {
    logger.warn('Google OAuth returned error', { error: errorParam });
    loginUrl.searchParams.set('error', 'Google authentication was cancelled or denied.');
    return NextResponse.redirect(loginUrl);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = req.cookies.get('circles_oauth_state')?.value;
  const returnPath = req.cookies.get('circles_oauth_return')?.value || '/circles';

  if (!code || !state || !storedState || state !== storedState) {
    logger.warn('Google OAuth state mismatch or missing authorization code', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasStoredState: Boolean(storedState),
    });
    loginUrl.searchParams.set('error', 'Authentication state invalid. Please try signing in again.');
    return NextResponse.redirect(loginUrl);
  }

  const credentials = getGoogleOAuthCredentials();
  if (!credentials) {
    loginUrl.searchParams.set('error', 'Google sign-in is not configured on this server.');
    return NextResponse.redirect(loginUrl);
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      logger.error('Google token exchange failed', { status: tokenRes.status, body: errText });
      loginUrl.searchParams.set('error', 'Failed to exchange authorization code with Google.');
      return NextResponse.redirect(loginUrl);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      id_token?: string;
    };

    if (!tokenData.access_token) {
      loginUrl.searchParams.set('error', 'No access token received from Google.');
      return NextResponse.redirect(loginUrl);
    }

    // 2. Fetch authenticated user profile from Google UserInfo endpoint
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userRes.ok) {
      loginUrl.searchParams.set('error', 'Failed to fetch user profile from Google.');
      return NextResponse.redirect(loginUrl);
    }

    const googleUser = (await userRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!googleUser.email || !googleUser.sub) {
      loginUrl.searchParams.set('error', 'Google account does not provide a valid email or user identifier.');
      return NextResponse.redirect(loginUrl);
    }

    // If an existing local session exists, sign out first for clean rotation
    const priorToken = extractRequestSessionToken(req);
    if (priorToken) {
      await signOutUser(priorToken);
    }

    // 3. Upsert user and issue session
    const { sessionToken } = await authenticateWithGoogle({
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      sub: googleUser.sub,
    });

    // 4. Redirect to destination and set cookies
    const destination = new URL(returnPath, origin);
    const response = NextResponse.redirect(destination);

    const isProd = process.env.NODE_ENV === 'production';

    // Set session cookie
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProd,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Clear OAuth temporary cookies
    response.cookies.delete('circles_oauth_state');
    response.cookies.delete('circles_oauth_return');

    return response;
  } catch (error) {
    logger.error('Unexpected error during Google authentication callback', {
      error: error instanceof Error ? error.message : String(error),
    });
    loginUrl.searchParams.set('error', 'An unexpected error occurred during Google sign in.');
    return NextResponse.redirect(loginUrl);
  }
}
