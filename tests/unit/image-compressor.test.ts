import { describe, it, expect } from 'vitest';
import {
  calculateTargetDimensions,
  compressImage,
  fileToBase64,
} from '@/lib/media/compressor';

describe('Image Compressor & Dimension Optimization Suite', () => {
  describe('calculateTargetDimensions', () => {
    it('1. Scales down proportionally when image width exceeds maxWidth', () => {
      // 4K 16:9 image scaled to 1920 max
      const result = calculateTargetDimensions(3840, 2160, 1920, 1920);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('2. Scales down proportionally when image height exceeds maxHeight', () => {
      // Tall portrait banner 1200 x 3600
      const result = calculateTargetDimensions(1200, 3600, 1920, 1200);
      expect(result.height).toBe(1200);
      expect(result.width).toBe(400);
    });

    it('3. Preserves original dimensions if image is already smaller than max bounds', () => {
      const result = calculateTargetDimensions(800, 600, 1920, 1920);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('4. Correctly scales exact square images', () => {
      const result = calculateTargetDimensions(3000, 3000, 1920, 1920);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1920);
    });

    it('5. Handles degenerate or zero dimensions safely without crashing', () => {
      const result = calculateTargetDimensions(0, 0, 1920, 1920);
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe('compressImage bypassed formats & utilities', () => {
    it('6. Bypasses animated GIFs to preserve frame animation', async () => {
      const gifBlob = new Blob(['GIF89a...dummy-gif-bytes'], { type: 'image/gif' });
      const gifFile = new File([gifBlob], 'reaction.gif', { type: 'image/gif' });

      const result = await compressImage(gifFile);
      expect(result.mimeType).toBe('image/gif');
      expect(result.filename).toBe('reaction.gif');
      expect(result.compressionRatio).toBe(1);
      expect(result.base64).toContain('data:image/gif;base64,');
    });

    it('7. Bypasses SVG vector files to prevent rasterization', async () => {
      const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      const svgFile = new File([svgBlob], 'vector-logo.svg', { type: 'image/svg+xml' });

      const result = await compressImage(svgFile);
      expect(result.mimeType).toBe('image/svg+xml');
      expect(result.filename).toBe('vector-logo.svg');
      expect(result.compressionRatio).toBe(1);
      expect(result.base64).toContain('data:image/svg+xml;base64,');
    });

    it('8. Converts Blob to base64 Data URL accurately', async () => {
      const textBlob = new Blob(['hello circles image compressor'], { type: 'text/plain' });
      const base64 = await fileToBase64(textBlob);
      expect(base64).toMatch(/^data:text\/plain;base64,/);
    });
  });
});
