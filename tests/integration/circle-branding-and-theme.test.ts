import { beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { registerUser } from '@/features/auth/service';
import { createCircle, updateCircle, getCircleBySlugOrId } from '@/features/circles/service';
import { runDatabaseMigrations, withRlsTransaction } from '@/lib/db/postgres';
import { PATCH as circlePatchRoute, GET as circleGetRoute } from '@/app/api/circles/[circleId]/route';
import { generateCircleThemeStyles, getContrastColor } from '@/lib/theme/utils';

function makeRequest(url: string, method: string, body?: unknown, token?: string): NextRequest {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000',
    'Host': 'localhost:3000',
  });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Community Theme Colors & Branding Suite (All Communities Unrestricted)', () => {
  beforeAll(async () => {
    await runDatabaseMigrations();
  });

  it('1. Calculates high contrast text colors and CSS custom properties accurately', () => {
    // Dark primary -> White foreground
    expect(getContrastColor('#18181b')).toBe('#ffffff');
    expect(getContrastColor('#065f46')).toBe('#ffffff');
    expect(getContrastColor('#3730a3')).toBe('#ffffff');

    // Light primary -> Dark foreground
    expect(getContrastColor('#facc15')).toBe('#000000');
    expect(getContrastColor('#ffffff')).toBe('#000000');
    expect(getContrastColor('#e0f2fe')).toBe('#000000');

    // Test CSS variables generation
    const styles = generateCircleThemeStyles({
      primaryColor: '#065f46',
      accentColor: '#10b981',
      borderRadius: 'lg',
    });

    expect(styles['--circle-primary']).toBe('#065f46');
    expect(styles['--circle-primary-fg']).toBe('#ffffff');
    expect(styles['--circle-accent']).toBe('#10b981');
    expect(styles['--circle-radius']).toBe('0.75rem');
    expect(styles['--circle-primary-subtle']).toContain('rgba(');
  });

  it('2. Updates and persists custom theme colors on any community without tier restrictions', async () => {
    const { user: owner, sessionToken } = await registerUser({
      email: `theme-owner-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `theme_${Date.now()}`,
      displayName: 'Theme Owner',
    });

    // Create a Free circle
    const circle = await createCircle(owner.id, {
      name: `Branded Circle ${Date.now()}`,
      slug: `brand-${Date.now()}`,
      category: 'creator',
    });

    expect(circle.id).toBeDefined();

    // 1. Direct service update
    const updated = await updateCircle(owner.id, circle.id, {
      themeSettings: {
        primaryColor: '#075985',
        accentColor: '#0284c7',
        borderRadius: 'full',
      },
    });

    expect(updated.theme_settings?.primaryColor).toBe('#075985');
    expect(updated.theme_settings?.accentColor).toBe('#0284c7');
    expect(updated.theme_settings?.borderRadius).toBe('full');

    // 2. Fetch circle and verify persistence
    const fetched = await getCircleBySlugOrId(owner.id, circle.id);
    expect(fetched?.theme_settings?.primaryColor).toBe('#075985');
    expect(fetched?.theme_settings?.accentColor).toBe('#0284c7');
    expect(fetched?.theme_settings?.borderRadius).toBe('full');

    // 3. HTTP API PATCH update (as done by Studio Theme Builder)
    const req = makeRequest(
      `http://localhost:3000/api/circles/${circle.id}`,
      'PATCH',
      {
        themeSettings: {
          primaryColor: '#9a3412',
          accentColor: '#f97316',
          borderRadius: 'md',
        },
      },
      sessionToken
    );

    const res = await circlePatchRoute(req, { params: { circleId: circle.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.circle.theme_settings?.primaryColor).toBe('#9a3412');
    expect(body.circle.theme_settings?.accentColor).toBe('#f97316');
    expect(body.circle.theme_settings?.borderRadius).toBe('md');
  });
});
