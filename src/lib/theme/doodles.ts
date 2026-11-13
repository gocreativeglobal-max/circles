/**
 * Circles Community Vector Doodles
 * Subtle hand-drawn community icons in an infinite seamless repeating tile.
 */

export interface CanvasTonePreset {
  id: string;
  name: string;
  hex: string;
  border: string;
  description: string;
  isDark?: boolean;
}

export const CANVAS_TONE_PRESETS: CanvasTonePreset[] = [
  {
    id: 'linen',
    name: 'Warm Linen',
    hex: '#FAF9F6',
    border: '#E7E5E4',
    description: 'Clean off-white neutral canvas (default)',
  },
  {
    id: 'sage',
    name: 'Soft Sage',
    hex: '#F1F5F2',
    border: '#D8E2DA',
    description: 'Gentle, organic herbal tone for eco and calm spaces',
  },
  {
    id: 'slate',
    name: 'Cambridge Slate',
    hex: '#EFF4F9',
    border: '#D5E1ED',
    description: 'Crisp academic blue-grey for research and tech hubs',
  },
  {
    id: 'sand',
    name: 'Desert Sand',
    hex: '#F7F3EC',
    border: '#E8DFD1',
    description: 'Cozy terracotta-tinted warmth for social collectives',
  },
  {
    id: 'lavender',
    name: 'Muted Lilac',
    hex: '#F5F2F8',
    border: '#E5DDEE',
    description: 'Soft creative violet for arts, design and music clubs',
  },
];

export function getCanvasTonePreset(idOrHex?: string | null): CanvasTonePreset {
  if (!idOrHex) return CANVAS_TONE_PRESETS[0];
  const byId = CANVAS_TONE_PRESETS.find((p) => p.id === idOrHex);
  if (byId) return byId;
  const byHex = CANVAS_TONE_PRESETS.find((p) => p.hex.toLowerCase() === idOrHex.toLowerCase());
  if (byHex) return byHex;
  return {
    id: 'custom',
    name: 'Custom',
    hex: idOrHex,
    border: '#E7E5E4',
    description: 'Custom community canvas tone',
  };
}

/**
 * Generates an optimized, seamless SVG doodle tile data-uri.
 * Stroke color adjusts automatically based on whether the background is light or dark.
 */
export function getCommunityDoodleSvg(isDark: boolean = false): string {
  const strokeColor = isDark ? '%23ffffff' : '%2352525b';
  const strokeOpacity = isDark ? '0.14' : '0.075';

  return `data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='${strokeColor}' stroke-width='1.35' stroke-linecap='round' stroke-linejoin='round' opacity='${strokeOpacity}'%3E` +
    // 1. Coffee Mug with Steam (x: 15-42, y: 18-45)
    `%3Cpath d='M16 26h18v12a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5V26zM34 29h4a4 4 0 0 1 0 8h-4M21 18c1 2-1 4 0 6M26 18c1 2-1 4 0 6M31 18c1 2-1 4 0 6'/%3E` +
    // 2. Speech Bubble (x: 55-85, y: 18-42)
    `%3Cpath d='M58 20h22a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6h-8l-7 6v-6h-7a6 6 0 0 1-6-6V26a6 6 0 0 1 6-6z'/%3E` +
    // 3. Lightbulb (x: 110-130, y: 15-45)
    `%3Cpath d='M120 18a7 7 0 0 1 6 10c-1 2-2 3-2 5h-8c0-2-1-3-2-5a7 7 0 0 1 6-10zM116 35h8M117 38h6M120 12v3M111 15l2 2M129 15l-2 2'/%3E` +
    // 4. Open Book (x: 150-188, y: 20-42)
    `%3Cpath d='M168 22c-5-2-11-2-16 1v16c5-3 11-3 16-1zm0 0c5-2 11-2 16 1v16c-5-3-11-3-16-1z'/%3E` +
    // 5. Handshake (x: 18-46, y: 70-92)
    `%3Cpath d='M20 80l8-8 8 8 8-8M24 84l8-8M28 88l8-8'/%3E` +
    // 6. Megaphone (x: 65-94, y: 68-94)
    `%3Cpath d='M70 76l16-6v22l-16-6zM70 77h-6v6h6M66 83v8h4'/%3E` +
    // 7. Spark / Star (x: 115-135, y: 68-90)
    `%3Cpath d='M125 68c0 6 5 11 11 11-6 0-11 5-11 11 0-6-5-11-11-11 6 0 11-5 11-11z'/%3E` +
    // 8. Compass (x: 155-185, y: 70-98)
    `%3Ccircle cx='170' cy='82' r='10'/%3E%3Cpath d='M168 85l4-6-1 7z'/%3E` +
    // 9. Graduation Cap (x: 20-55, y: 125-155)
    `%3Cpath d='M22 136l18-8 18 8-18 8zM28 140v9c5 4 15 4 20 0v-9M58 136v10'/%3E` +
    // 10. Heart Outline (x: 75-98, y: 125-150)
    `%3Cpath d='M86 130a4 4 0 0 0-6 0 4 4 0 0 0 0 6l6 6 6-6a4 4 0 0 0 0-6 4 4 0 0 0-6 0z'/%3E` +
    // 11. Thumbs Up (x: 115-140, y: 122-152)
    `%3Cpath d='M120 135v12h12l4-8v-4h-8v-8a3 3 0 0 0-3-3l-5 11z'/%3E` +
    // 12. Planet with Ring (x: 155-188, y: 125-155)
    `%3Ccircle cx='170' cy='140' r='7'/%3E%3Cellipse cx='170' cy='140' rx='13' ry='4' transform='rotate(-20 170 140)'/%3E` +
    `%3C/g%3E%3C/svg%3E`;
}
