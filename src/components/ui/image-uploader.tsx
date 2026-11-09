'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  UploadCloud,
  X,
  Loader2,
  Link as LinkIcon,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ImageUploaderProps<T extends string | string[] = string | string[]> {
  circleId?: string;
  value: T;
  onChange: (val: T) => void;
  multiple?: boolean;
  maxFiles?: number;
  label?: string;
  helperText?: string;
  aspectRatio?: 'video' | 'square' | 'banner';
  className?: string;
}

export function ImageUploader<T extends string | string[]>({
  circleId,
  value,
  onChange,
  multiple = false,
  maxFiles = 6,
  label,
  helperText,
  aspectRatio = 'video',
  className = '',
}: ImageUploaderProps<T>) {
  const images: string[] = useMemo(() => {
    if (Array.isArray(value)) {
      return (value as string[]).filter(Boolean);
    }
    return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  }, [value]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'banner'
        ? 'aspect-[21/9]'
        : 'aspect-video';

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setErrorMessage(null);
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB

      // Check max files
      if (multiple && images.length + fileList.length > maxFiles) {
        setErrorMessage(`You can upload at most ${maxFiles} photos.`);
        return;
      }

      setUploading(true);
      const newUrls: string[] = [];

      try {
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          setUploadProgress(`Uploading ${i + 1} of ${fileList.length}...`);

          if (!allowedTypes.includes(file.type)) {
            throw new Error(`"${file.name}" is not a supported image (PNG, JPG, WebP, GIF only).`);
          }

          if (file.size > maxSizeBytes) {
            throw new Error(`"${file.name}" exceeds the 10MB size limit.`);
          }

          // Convert to base64
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsDataURL(file);
          });

          const res = await fetch('/api/uploads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              circleId: circleId || null,
              originalFilename: file.name,
              mimeType: file.type,
              visibility: 'public',
              contentBase64: base64Data,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Upload failed with status ${res.status}`);
          }

          const { upload } = await res.json();
          // Use /api/uploads/[id] or upload.signed_download_url
          const downloadUrl = `/api/uploads/${upload.id}`;
          newUrls.push(downloadUrl);

          if (!multiple) break; // In single mode, take only the first one
        }

        if (multiple) {
          onChange([...images, ...newUrls] as T);
        } else {
          onChange((newUrls[0] || '') as T);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      } finally {
        setUploading(false);
        setUploadProgress(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [circleId, images, maxFiles, multiple, onChange]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!uploading) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    if (multiple) {
      onChange(images.filter((_, idx) => idx !== indexToRemove) as T);
    } else {
      onChange('' as T);
    }
  };

  const handleAddManualUrl = () => {
    if (!manualUrl.trim()) return;
    if (multiple) {
      if (images.length >= maxFiles) {
        setErrorMessage(`Maximum of ${maxFiles} images reached.`);
        return;
      }
      onChange([...images, manualUrl.trim()] as T);
    } else {
      onChange(manualUrl.trim() as T);
    }
    setManualUrl('');
    setShowUrlInput(false);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">
            {label}
          </label>
          {multiple && (
            <span className="text-[11px] font-mono text-stone-400">
              {images.length}/{maxFiles} photos
            </span>
          )}
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span className="flex-1 font-medium">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-stone-400 hover:text-stone-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Image Preview Grid (when images exist) */}
      {images.length > 0 && (
        <div
          className={`grid gap-3 ${
            multiple
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
              : 'grid-cols-1'
          }`}
        >
          {images.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className={`group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-xs ${aspectClass}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Photo ${idx + 1}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-stone-950/20 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Primary badge for first image in multi mode */}
              {multiple && idx === 0 && (
                <span className="absolute top-2 left-2 rounded-md bg-black/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
                  Cover Photo
                </span>
              )}

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => handleRemoveImage(idx)}
                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/80 text-white shadow-md hover:bg-red-600 transition-colors"
                title="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone (show if single and no image, or multiple and under limit) */}
      {(!images.length || (multiple && images.length < maxFiles)) && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
            isDragOver
              ? 'border-black bg-stone-100 scale-[0.99]'
              : 'border-stone-200 hover:border-stone-400 bg-stone-50/50 hover:bg-stone-50'
          } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple={multiple}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-stone-200 shadow-xs text-stone-900">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UploadCloud className="h-5 w-5" />
              )}
            </div>

            <div className="text-xs">
              <span className="font-semibold text-stone-800">
                {uploading
                  ? uploadProgress || 'Processing upload...'
                  : 'Click to upload image'}
              </span>
              {!uploading && (
                <span className="text-stone-500"> or drag and drop</span>
              )}
            </div>

            <p className="text-[11px] text-stone-400">
              PNG, JPG, WebP, or GIF up to 10MB
              {multiple && ` (max ${maxFiles} photos)`}
            </p>
          </div>
        </div>
      )}

      {/* Manual URL toggle / input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="inline-flex items-center gap-1 font-medium text-stone-900 hover:text-stone-900 transition-colors"
          >
            <LinkIcon className="h-3 w-3" />
            <span>{showUrlInput ? 'Hide URL input' : 'Or enter image link directly'}</span>
          </button>
          {helperText && <span className="text-stone-400">{helperText}</span>}
        </div>

        {showUrlInput && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManualUrl();
                }
              }}
              placeholder="https://images.unsplash.com/photo-..."
              className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-black focus:ring-1 focus:ring-black"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddManualUrl}
              disabled={!manualUrl.trim()}
              className="rounded-xl px-3 text-xs"
            >
              Add URL
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
