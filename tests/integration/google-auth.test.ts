import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { resetTestDatabase } from '@/lib/db/postgres';
import { authenticateWithGoogle } from '@/features/auth/service';
import { verifySignedSessionToken } from '@/lib/auth/session';
import { GET as googleInitRoute } from '@/app/api/auth/google/route';
import { GET as googleCallbackRoute } from '@/app/api/auth/google/callback/route';

describe('Google OAuth Integration & Verification Suite', () => {
  beforeEach(async () => {
    process.env.GOOGLE_CLIENT_ID = 'mock-google-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'mock-google-client-secret-dummy';
    await resetTestDatabase();
  });

  it('provisions a new member via authenticateWithGoogle and issues an authenticated session', async () => {
    const { user, sessionToken } = await authenticateWithGoogle({
      email: 'alex.rivera@example.com',
      name: 'Alex Rivera',
      picture: 'https://lh3.googleusercontent.com/a/avatar123',
      sub: 'google-sub-10001',
    });

    expect(user.email).toBe('alex.rivera@example.com');
    expect(user.display_name).toBe('Alex Rivera');
    expect(user.avatar_url).toBe('https://lh3.googleusercontent.com/a/avatar123');
    expect(user.username).toMatch(/^[a-z0-9_]{3,32}$/);
    expect(user.id).toBeDefined();

    // Verify session token is valid and verifiable
    const payload = verifySignedSessionToken(sessionToken);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(user.id);
    expect(payload?.email).toBe('alex.rivera@example.com');
  });

  it('seamlessly links to existing user account if email matches and avoids duplicate accounts', async () => {
    // 1. Initial Google login
    const firstLogin = await authenticateWithGoogle({
      email: 'sam.taylor@example.com',
      name: 'Sam Taylor',
      sub: 'google-sub-10002',
    });

    // 2. Subsequent Google login with same email and new avatar
    const secondLogin = await authenticateWithGoogle({
      email: 'sam.taylor@example.com',
      name: 'Sam Taylor Updated',
      picture: 'https://lh3.googleusercontent.com/a/new-pic',
      sub: 'google-sub-10002',
    });

    expect(secondLogin.user.id).toBe(firstLogin.user.id);
    expect(secondLogin.user.avatar_url).toBe('https://lh3.googleusercontent.com/a/new-pic');
  });

  it('initiates Google OAuth flow and sets CSRF state cookie', async () => {
    const req = new NextRequest(new URL('/api/auth/google', 'http://localhost:3000'), {
      method: 'GET',
    });

    const res = await googleInitRoute(req);
    expect(res.status).toBe(307); // NextResponse.redirect

    const location = res.headers.get('location') || '';
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain('client_id=mock-google-client-id.apps.googleusercontent.com');
    expect(location).toContain('scope=openid+email+profile');
    expect(location).toContain('response_type=code');

    // Verify state cookie is set
    const cookies = res.cookies.getAll();
    const stateCookie = cookies.find((c) => c.name === 'circles_oauth_state');
    expect(stateCookie).toBeDefined();
    expect(stateCookie?.value.length).toBeGreaterThan(16);
  });

  it('rejects callback with state mismatch', async () => {
    const callbackUrl = new URL('/api/auth/google/callback?code=mock_code&state=bad_state', 'http://localhost:3000');
    const req = new NextRequest(callbackUrl, {
      method: 'GET',
    });
    // Set a different state cookie
    req.cookies.set('circles_oauth_state', 'good_state');

    const res = await googleCallbackRoute(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/login?error=');
    expect(location).toContain('Authentication+state+invalid');
  });
});
