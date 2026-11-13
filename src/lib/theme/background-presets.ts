export interface BannerPreset {
  id: string;
  name: string;
  category: string;
  url: string;
  description: string;
}

export const HERO_BANNER_PRESETS: BannerPreset[] = [
  {
    id: 'abstract_art',
    name: 'Abstract Expression',
    category: 'Creative & Art',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1600&q=80',
    description: 'Vivid expressive paint strokes, bold purple and terracotta tones',
  },
  {
    id: 'cyber_mesh',
    name: 'Holographic Wave',
    category: 'Modern & Digital',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
    description: 'Fluid ultraviolet and indigo luminous gradient ripples',
  },
  {
    id: 'dark_obsidian',
    name: 'Dark Obsidian',
    category: 'Minimal & Tech',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=80',
    description: 'Architectural carbon texture with subtle studio chiaroscuro',
  },
  {
    id: 'warm_terracotta',
    name: 'Warm Clay & Sand',
    category: 'Earthy & Natural',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
    description: 'Sun-drenched golden warmth and earthy natural horizons',
  },
  {
    id: 'ocean_depths',
    name: 'Ocean Depths',
    category: 'Nature & Calm',
    url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80',
    description: 'Deep marine waters, aquatic currents, and sapphire tranquility',
  },
  {
    id: 'minimal_studio',
    name: 'Daylight Atelier',
    category: 'Professional & Studio',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
    description: 'Clean architectural light, natural shadows, and modern wood tones',
  },
];

export function getPresetBannerUrl(presetId?: string | null): string | null {
  if (!presetId) return null;
  const match = HERO_BANNER_PRESETS.find((p) => p.id === presetId);
  return match ? match.url : null;
}

/**
 * Lightweight SVG patterns as base64 / inline data URIs
 */
export const WALLPAPER_PATTERNS = {
  dots: `data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%2371717a' fill-opacity='0.18'/%3E%3C/svg%3E`,
  grid: `data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 40M40 0L40 40' fill='none' stroke='%2371717a' stroke-width='0.75' stroke-opacity='0.15'/%3E%3C/svg%3E`,
  topography: `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 Q 30 60 70 30 T 90 90' fill='none' stroke='%2371717a' stroke-width='0.8' stroke-opacity='0.18'/%3E%3Cpath d='M0 50 Q 50 10 100 50' fill='none' stroke='%2371717a' stroke-width='0.8' stroke-opacity='0.15'/%3E%3C/svg%3E`,
  noise: `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E`,
};
