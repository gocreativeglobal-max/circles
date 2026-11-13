import React from 'react';
import { CircleThemeSettings } from '@/types/domain';

export function hexToRgb(hexStr?: string | null): { r: number; g: number; b: number } | null {
  if (!hexStr) return null;
  let clean = hexStr.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (clean.length !== 6) return null;

  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Returns '#ffffff' or '#000000' based on WCAG luminance formula for maximum readability.
 */
export function getContrastColor(hexStr?: string | null): '#ffffff' | '#000000' {
  const rgb = hexToRgb(hexStr);
  if (!rgb) return '#ffffff';

  // Perceived relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55 ? '#000000' : '#ffffff';
}

export function getRadiusValue(radius?: string | null): string {
  switch (radius) {
    case 'none':
      return '0px';
    case 'sm':
      return '0.25rem'; // 4px
    case 'md':
      return '0.5rem';  // 8px
    case 'lg':
      return '0.75rem'; // 12px
    case 'full':
      return '9999px';
    default:
      return '0.5rem';
  }
}

export interface CircleThemeVariables extends React.CSSProperties {
  '--circle-primary'?: string;
  '--circle-primary-fg'?: string;
  '--circle-primary-subtle'?: string;
  '--circle-primary-hover'?: string;
  '--circle-accent'?: string;
  '--circle-accent-fg'?: string;
  '--circle-accent-subtle'?: string;
  '--circle-radius'?: string;
}

export const DEFAULT_THEME_SETTINGS: CircleThemeSettings = {
  primaryColor: '#18181b', // Zinc 900
  accentColor: '#2563eb',  // Blue 600
  brandMode: 'system',
  borderRadius: 'md',
};

export const THEME_PRESETS: Array<{
  id: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  description: string;
}> = [
  {
    id: 'noir',
    name: 'Modern Noir',
    primaryColor: '#18181b',
    accentColor: '#3b82f6',
    description: 'Minimal, clean monochrome with bright blue accents.',
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    primaryColor: '#065f46',
    accentColor: '#10b981',
    description: 'Calm, organic deep green with vibrant mint tones.',
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    primaryColor: '#3730a3',
    accentColor: '#6366f1',
    description: 'Polished academic purple-blue with modern violet accents.',
  },
  {
    id: 'terracotta',
    name: 'Sunset Amber',
    primaryColor: '#9a3412',
    accentColor: '#f97316',
    description: 'Warm, energetic earthen orange with sunset highlights.',
  },
  {
    id: 'ocean',
    name: 'Ocean Deep',
    primaryColor: '#075985',
    accentColor: '#0284c7',
    description: 'Crisp navy blue with clear cyan indicators.',
  },
  {
    id: 'berry',
    name: 'Berry Wine',
    primaryColor: '#831843',
    accentColor: '#db2777',
    description: 'Rich, bold magenta for creative collectives and design clubs.',
  },
];

export function generateCircleThemeStyles(
  settings?: CircleThemeSettings | null
): CircleThemeVariables {
  const primary = settings?.primaryColor || DEFAULT_THEME_SETTINGS.primaryColor || '#18181b';
  const accent = settings?.accentColor || DEFAULT_THEME_SETTINGS.accentColor || '#2563eb';
  const radius = getRadiusValue(settings?.borderRadius);

  const rgbPrimary = hexToRgb(primary) || { r: 24, g: 24, b: 27 };
  const rgbAccent = hexToRgb(accent) || { r: 37, g: 99, b: 235 };

  const primaryFg = getContrastColor(primary);
  const accentFg = getContrastColor(accent);

  return {
    '--circle-primary': primary,
    '--circle-primary-fg': primaryFg,
    '--circle-primary-subtle': `rgba(${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}, 0.08)`,
    '--circle-primary-hover': `rgba(${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}, 0.88)`,
    '--circle-accent': accent,
    '--circle-accent-fg': accentFg,
    '--circle-accent-subtle': `rgba(${rgbAccent.r}, ${rgbAccent.g}, ${rgbAccent.b}, 0.1)`,
    '--circle-radius': radius,
  };
}
