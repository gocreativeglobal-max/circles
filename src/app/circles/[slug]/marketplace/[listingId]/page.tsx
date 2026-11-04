import React from 'react';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import {
  getMarketplaceListing,
  listCircleBookings,
  listMarketplaceListings,
} from '@/features/marketplace/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { ListingDetailClient } from '@/components/circles/listing-detail-client';
import { MarketplaceListingItem, ServiceBookingItem } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function ListingDetailPage({
  params,
}: {
  params: { slug: string; listingId: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const canRead = canReadCircleContent(circle.visibility, {
    userId: user?.id ?? null,
    isPlatformAdmin: user?.is_platform_admin,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  if (!canRead) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
        <Lock className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Marketplace</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to view full listing details, photos, and contact the seller.
        </p>
      </div>
    );
  }

  let listing: MarketplaceListingItem | null = null;
  let bookings: ServiceBookingItem[] = [];
  let relatedListings: MarketplaceListingItem[] = [];

  try {
    listing = await getMarketplaceListing(user?.id ?? null, circle.id, params.listingId);
    if (!listing) {
      notFound();
    }

    if (user && circle.current_user_membership_status === 'active') {
      bookings = await listCircleBookings(user.id, circle.id);
    }

    const allListings = await listMarketplaceListings(user?.id ?? null, circle.id, {
      limit: 6,
    });
    relatedListings = allListings.filter((item) => item.id !== params.listingId).slice(0, 3);
  } catch {
    notFound();
  }

  const isMember = circle.current_user_membership_status === 'active';

  return (
    <ListingDetailClient
      circle={circle}
      initialListing={listing}
      initialBookings={bookings}
      relatedListings={relatedListings}
      isMember={isMember}
      currentUserId={user?.id ?? null}
      currentUserRole={circle.current_user_role ?? null}
    />
  );
}
