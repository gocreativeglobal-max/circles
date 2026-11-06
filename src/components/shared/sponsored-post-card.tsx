'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SponsoredPostCardProps {
  sponsorName?: string;
  sponsorLogoUrl?: string;
  sponsorCategory?: string;
  headline?: string;
  body?: string;
  ctaText?: string;
  ctaUrl?: string;
  circleSlug?: string;
  isCircleAdmin?: boolean;
}

export function SponsoredPostCard({
  sponsorName = 'Bachs Global Payments',
  sponsorLogoUrl,
  sponsorCategory = 'Fintech Partner',
  headline = 'Accept global cards, bank transfers, and mobile money effortlessly',
  body = 'Powering community commerce across 14 currencies with instant local settlements, zero hidden conversion fees, and enterprise-grade security.',
  ctaText = 'Learn More',
  ctaUrl = 'https://bachs.io',
  circleSlug,
  isCircleAdmin = false,
}: SponsoredPostCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm transition-all hover:border-forest-600/40">
      {/* Top Sponsor Attribution Bar */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-900 text-white font-extrabold text-sm shadow-sm">
            {sponsorLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sponsorLogoUrl}
                alt={sponsorName}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              sponsorName.slice(0, 1)
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-stone-900">{sponsorName}</span>
              <ShieldCheck className="h-3.5 w-3.5 text-forest-700" />
            </div>
            <span className="text-[11px] font-medium text-stone-500">{sponsorCategory}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 border border-amber-200/60">
            <Sparkles className="h-2.5 w-2.5 text-amber-600" />
            Sponsored
          </span>
        </div>
      </div>

      {/* Main Sponsored Content */}
      <div className="mt-3.5 space-y-2">
        <h4 className="text-sm font-bold text-stone-900 leading-snug hover:text-forest-800">
          <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {headline}
          </a>
        </h4>
        <p className="text-xs text-stone-600 leading-relaxed">{body}</p>
      </div>

      {/* Action & Disclosure Footer */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-stone-100 pt-3">
        <div className="text-[11px] text-stone-500">
          {isCircleAdmin && circleSlug ? (
            <Link
              href={`/circles/${circleSlug}/studio`}
              className="font-medium text-forest-700 hover:text-forest-900 underline"
            >
              Upgrade to Pro to remove ads for this circle →
            </Link>
          ) : (
            <span>Verified Circles Partner Placement</span>
          )}
        </div>

        <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold gap-1">
            <span>{ctaText}</span>
            <ExternalLink className="h-3 w-3 text-stone-500" />
          </Button>
        </a>
      </div>
    </div>
  );
}
