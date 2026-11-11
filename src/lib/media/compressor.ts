/**
 * Client-Side Image Compression Utility
 *
 * Automatically downsizes and compresses raster images before upload.
 * Reduces bandwidth, speeds up uploads, and prevents excessive storage usage.
 * Preserves animated GIFs and vector SVGs.
 */

export interface ImageCompressionOptions {
  /** Maximum allowable width in pixels. Defaults to 1920. */
  maxWidth?: number;
  /** Maximum allowable height in pixels. Defaults to 1920. */
  maxHeight?: number;
  /** Image quality factor from 0.01 to 1.0. Defaults to 0.82. */
  quality?: number;
  /** Target MIME format. Defaults to 'image/webp' with fallback to original or 'image/jpeg'. */
  targetFormat?: 'image/webp' | 'image/jpeg' | 'image/png' | 'preserve';
  /** Max size in bytes before skipping re-compression if already smaller. Defaults to 100 KB. */
  minCompressSizeBytes?: number;
}

export interface CompressedImageResult {
  file: File;
  base64: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  mimeType: string;
  filename: string;
  width: number;
  height: number;
  compressionRatio: number; // e.g. 0.45 = compressed to 45% of original
}

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.82,
  targetFormat: 'image/webp',
  minCompressSizeBytes: 100 * 1024, // Don't recompress tiny images < 100KB unless dimensions exceed max
};

/**
 * Calculates new dimensions that fit within maxWidth and maxHeight
 * while preserving aspect ratio.
 */
export function calculateTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: Math.max(1, maxWidth), height: Math.max(1, maxHeight) };
  }

  let width = srcWidth;
  let height = srcHeight;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

/**
 * Converts a File or Blob into a base64 Data URL string.
 * Supports both browser (FileReader) and server / Node test environments (arrayBuffer).
 */
export async function fileToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert file to base64.'));
      reader.readAsDataURL(blob);
    });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mime = blob.type || 'application/octet-stream';
  return `data:${mime};base64,${base64}`;
}

/**
 * Compresses an image client-side using HTML5 Canvas or OffscreenCanvas.
 * - Skips animated GIFs and SVGs to preserve animation / vectors.
 * - Scales dimensions down to fit within maxWidth / maxHeight.
 * - Encodes to WebP (default) or specified target format.
 * - Falls back cleanly if canvas or createImageBitmap is unavailable (e.g. SSR).
 */
export async function compressImage(
  file: File,
  options?: ImageCompressionOptions
): Promise<CompressedImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSizeBytes = file.size;

  // SSR or non-browser fallback
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const base64 = await fileToBase64(file);
    return {
      file,
      base64,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
      mimeType: file.type || 'image/jpeg',
      filename: file.name,
      width: 0,
      height: 0,
      compressionRatio: 1,
    };
  }

  // Bypass animated GIFs and SVGs
  const isGif = file.type === 'image/gif';
  const isSvg = file.type === 'image/svg+xml';
  if (isGif || isSvg) {
    const base64 = await fileToBase64(file);
    return {
      file,
      base64,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
      mimeType: file.type,
      filename: file.name,
      width: 0,
      height: 0,
      compressionRatio: 1,
    };
  }

  // Load the image bitmap or HTMLImageElement
  let srcWidth = 0;
  let srcHeight = 0;
  let drawSource: ImageBitmap | HTMLImageElement;

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      srcWidth = bitmap.width;
      srcHeight = bitmap.height;
      drawSource = bitmap;
    } else {
      const img = await loadImageElement(file);
      srcWidth = img.naturalWidth || img.width;
      srcHeight = img.naturalHeight || img.height;
      drawSource = img;
    }
  } catch {
    // If bitmap loading fails, return original file as-is
    const base64 = await fileToBase64(file);
    return {
      file,
      base64,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
      mimeType: file.type || 'image/jpeg',
      filename: file.name,
      width: 0,
      height: 0,
      compressionRatio: 1,
    };
  }

  const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
    srcWidth,
    srcHeight,
    opts.maxWidth,
    opts.maxHeight
  );

  // If already smaller than threshold and not downscaled, we can skip re-encoding
  if (
    originalSizeBytes < opts.minCompressSizeBytes &&
    srcWidth <= opts.maxWidth &&
    srcHeight <= opts.maxHeight
  ) {
    if ('close' in drawSource && typeof drawSource.close === 'function') {
      drawSource.close();
    }
    const base64 = await fileToBase64(file);
    return {
      file,
      base64,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
      mimeType: file.type,
      filename: file.name,
      width: srcWidth,
      height: srcHeight,
      compressionRatio: 1,
    };
  }

  // Draw onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { alpha: true });

  if (!ctx) {
    if ('close' in drawSource && typeof drawSource.close === 'function') {
      drawSource.close();
    }
    const base64 = await fileToBase64(file);
    return {
      file,
      base64,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
      mimeType: file.type,
      filename: file.name,
      width: srcWidth,
      height: srcHeight,
      compressionRatio: 1,
    };
  }

  // Fill background with white if source was JPEG or converting without alpha
  ctx.drawImage(drawSource, 0, 0, targetWidth, targetHeight);

  if ('close' in drawSource && typeof drawSource.close === 'function') {
    drawSource.close();
  }

  // Determine target format
  let targetMime = opts.targetFormat === 'preserve' ? file.type : opts.targetFormat;
  if (!targetMime || targetMime === 'preserve') {
    targetMime = 'image/webp';
  }

  // Generate compressed blob
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      targetMime,
      opts.quality
    );
  });

  if (!blob || (blob.size >= originalSizeBytes && targetWidth === srcWidth && targetHeight === srcHeight)) {
    // If compressed size is somehow larger and dimensions didn't change, keep original
    const base64 = await fileToBase64(file);
    return {
      file,
      base64,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
      mimeType: file.type,
      filename: file.name,
      width: srcWidth,
      height: srcHeight,
      compressionRatio: 1,
    };
  }

  // Generate output filename with new extension if MIME changed
  const extension = targetMime === 'image/webp' ? 'webp' : targetMime === 'image/jpeg' ? 'jpg' : 'png';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newFilename = `${baseName}.${extension}`;

  const compressedFile = new File([blob], newFilename, {
    type: targetMime,
    lastModified: Date.now(),
  });

  const base64 = await fileToBase64(compressedFile);

  return {
    file: compressedFile,
    base64,
    originalSizeBytes,
    compressedSizeBytes: blob.size,
    mimeType: targetMime,
    filename: newFilename,
    width: targetWidth,
    height: targetHeight,
    compressionRatio: Number((blob.size / Math.max(1, originalSizeBytes)).toFixed(3)),
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image element.'));
    };
    img.src = url;
  });
}
