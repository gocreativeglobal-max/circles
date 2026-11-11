import { withRlsTransaction } from '@/lib/db/postgres';
import {
  Circle,
  CircleCategory,
  CircleEventItem,
  CirclePollItem,
  CircleRole,
  CircleSpace,
  CircleVisibility,
  CourseItem,
  FundraisingCampaignItem,
  JoinRequestStatus,
  LearningResourceItem,
  MarketplaceListingItem,
  MembershipPolicy,
  MembershipStatus,
  PollOptionItem,
  PostItem,
} from '@/types/domain';

export interface FeedCircleContext {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: CircleCategory;
  location: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  visibility: CircleVisibility;
  membership_policy: MembershipPolicy;
  member_count: number;
  viewer_role: CircleRole | null;
  viewer_membership_status: MembershipStatus | null;
  viewer_join_request_status: JoinRequestStatus | null;
}

export type GlobalFeedItem =
  | {
      id: string;
      itemType: 'post';
      timestamp: string;
      engagementScore: number;
      circle: FeedCircleContext;
      authorRole: CircleRole | null;
      data: PostItem;
    }
  | {
      id: string;
      itemType: 'event';
      timestamp: string;
      engagementScore: number;
      circle: FeedCircleContext;
      data: CircleEventItem;
    }
  | {
      id: string;
      itemType: 'listing';
      timestamp: string;
      engagementScore: number;
      circle: FeedCircleContext;
      data: MarketplaceListingItem;
    }
  | {
      id: string;
      itemType: 'course';
      timestamp: string;
      engagementScore: number;
      circle: FeedCircleContext;
      data: CourseItem;
    }
  | {
      id: string;
      itemType: 'resource';
      timestamp: string;
      engagementScore: number;
      circle: FeedCircleContext;
      data: LearningResourceItem;
    }
  | {
      id: string;
      itemType: 'cause';
      timestamp: string;
      engagementScore: number;
      circle: FeedCircleContext;
      data: FundraisingCampaignItem;
    };

export interface ComposerCircleOption {
  id: string;
  name: string;
  slug: string;
  category: CircleCategory;
  visibility: CircleVisibility;
  avatar_url: string | null;
  role: CircleRole;
  pollsEnabled: boolean;
  spaces: Array<{
    id: string;
    name: string;
    slug: string;
    posting_policy: 'members' | 'moderators' | 'admins';
  }>;
}

export interface GlobalFeedData {
  items: GlobalFeedItem[];
  composerCircles: ComposerCircleOption[];
  myCircles: Circle[];
  trendingCircles: Circle[];
  upcomingEvents: Array<CircleEventItem & { circle: FeedCircleContext }>;
  stats: {
    publicCircleCount: number;
    totalPostCount: number;
    upcomingEventCount: number;
  };
}

export interface GetGlobalFeedOptions {
  limit?: number;
}

export async function getGlobalFeedData(
  actorUserId: string | null,
  options: GetGlobalFeedOptions = {}
): Promise<GlobalFeedData> {
  const limit = Math.min(Math.max(options.limit ?? 40, 10), 100);

  return withRlsTransaction(actorUserId, async (tx) => {
    // 1. Fetch Posts across all readable Circles (public Circles + user's joined Circles)
    type PostFeedRow = PostItem & {
      poll_id: string | null;
      author_username: string;
      author_display_name: string;
      author_avatar_url: string | null;
      author_circle_role: CircleRole | null;
      space_name: string | null;
      space_slug: string | null;
      space_icon: string | null;
      viewer_has_liked: boolean;
      viewer_has_saved: boolean;
      circle_name: string;
      circle_slug: string;
      circle_description: string;
      circle_category: CircleCategory;
      circle_location: string | null;
      circle_avatar_url: string | null;
      circle_cover_url: string | null;
      circle_visibility: CircleVisibility;
      circle_membership_policy: MembershipPolicy;
      circle_member_count: string;
      viewer_role: CircleRole | null;
      viewer_membership_status: MembershipStatus | null;
      viewer_join_request_status: JoinRequestStatus | null;
    };

    const postsRes = await tx.query<PostFeedRow>(
      `SELECT p.*,
         COALESCE(u.username, 'member') AS author_username,
         COALESCE(u.display_name, 'Circle Member') AS author_display_name,
         u.avatar_url AS author_avatar_url,
         (SELECT am.role FROM public.circle_memberships am
          WHERE am.circle_id = p.circle_id AND am.user_id = p.author_id AND am.status = 'active'
          LIMIT 1) AS author_circle_role,
         s.name AS space_name,
         s.slug AS space_slug,
         s.icon AS space_icon,
         EXISTS (
           SELECT 1 FROM public.reactions r
           WHERE r.post_id = p.id AND r.user_id = $1::uuid
         ) AS viewer_has_liked,
         EXISTS (
           SELECT 1 FROM public.saved_items si
           WHERE si.post_id = p.id AND si.user_id = $1::uuid
         ) AS viewer_has_saved,
         c.name AS circle_name,
         c.slug AS circle_slug,
         c.description AS circle_description,
         c.category AS circle_category,
         c.location AS circle_location,
         c.avatar_url AS circle_avatar_url,
         c.cover_url AS circle_cover_url,
         c.visibility AS circle_visibility,
         c.membership_policy AS circle_membership_policy,
         (SELECT COUNT(*)::text FROM public.circle_memberships cm WHERE cm.circle_id = c.id AND cm.status = 'active') AS circle_member_count,
         (SELECT vm.role FROM public.circle_memberships vm WHERE vm.circle_id = c.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_role,
         (SELECT vm.status FROM public.circle_memberships vm WHERE vm.circle_id = c.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_membership_status,
         (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = c.id AND jr.user_id = $1::uuid ORDER BY jr.created_at DESC LIMIT 1) AS viewer_join_request_status
       FROM public.posts p
       JOIN public.circles c ON c.id = p.circle_id
       LEFT JOIN public.profiles u ON u.id = p.author_id
       LEFT JOIN public.circle_spaces s ON s.id = p.space_id
       WHERE p.status = 'published'
         AND c.status = 'active'
         AND (
           c.visibility = 'public'
           OR ($1::uuid IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.circle_memberships m
             WHERE m.circle_id = c.id AND m.user_id = $1::uuid AND m.status = 'active'
           ))
         )
       ORDER BY p.created_at DESC
       LIMIT $2;`,
      [actorUserId, limit]
    );

    // Enrich polls for posts that have poll_id
    const pollIds = postsRes.rows
      .map((r) => r.poll_id)
      .filter((id): id is string => Boolean(id));

    const pollMap = new Map<string, CirclePollItem>();
    if (pollIds.length > 0) {
      try {
        const pollsRes = await tx.query<
          CirclePollItem & {
            creator_username: string;
            creator_display_name: string;
            creator_avatar_url: string | null;
          }
        >(
          `SELECT cp.*,
             COALESCE(u.username, 'member') AS creator_username,
             COALESCE(u.display_name, 'Member') AS creator_display_name,
             u.avatar_url AS creator_avatar_url
           FROM public.circle_polls cp
           LEFT JOIN public.profiles u ON u.id = cp.creator_id
           WHERE cp.id = ANY($1::uuid[]);`,
          [pollIds]
        );

        const optionsRes = await tx.query<
          PollOptionItem & {
            vote_count: number;
            viewer_voted: boolean;
          }
        >(
          `SELECT po.*,
             (SELECT COUNT(*)::int FROM public.poll_votes pv WHERE pv.option_id = po.id) AS vote_count,
             EXISTS (
               SELECT 1 FROM public.poll_votes pv2
               WHERE pv2.option_id = po.id AND pv2.user_id = $2::uuid
             ) AS viewer_voted
           FROM public.poll_options po
           WHERE po.poll_id = ANY($1::uuid[])
           ORDER BY po.sort_order ASC;`,
          [pollIds, actorUserId]
        );

        const optionsByPoll = new Map<string, PollOptionItem[]>();
        for (const opt of optionsRes.rows) {
          const list = optionsByPoll.get(opt.poll_id) ?? [];
          list.push({
            id: opt.id,
            poll_id: opt.poll_id,
            circle_id: opt.circle_id,
            label: opt.label,
            sort_order: opt.sort_order,
            vote_count: Number(opt.vote_count ?? 0),
            percentage: 0,
            viewer_voted: Boolean(opt.viewer_voted),
          });
          optionsByPoll.set(opt.poll_id, list);
        }

        for (const pRow of pollsRes.rows) {
          const rawOpts = optionsByPoll.get(pRow.id) ?? [];
          const totalVotes = rawOpts.reduce((acc, o) => acc + (o.vote_count ?? 0), 0);
          const opts = rawOpts.map((o) => ({
            ...o,
            percentage: totalVotes > 0 ? Math.round(((o.vote_count ?? 0) / totalVotes) * 100) : 0,
          }));
          pollMap.set(pRow.id, {
            ...pRow,
            options: opts,
            total_votes: totalVotes,
            creator: {
              id: pRow.creator_id,
              username: pRow.creator_username,
              display_name: pRow.creator_display_name,
              avatar_url: pRow.creator_avatar_url,
            },
          });
        }
      } catch {
        // Ignore poll enrichment errors if table not populated
      }
    }

    // 2. Fetch Events across all readable Circles
    type EventFeedRow = CircleEventItem & {
      organizer_username: string;
      organizer_display_name: string;
      organizer_avatar_url: string | null;
      host_username: string | null;
      host_display_name: string | null;
      host_avatar_url: string | null;
      going_count: number;
      waitlisted_count: number;
      viewer_rsvp_status: 'going' | 'waitlisted' | 'cancelled' | null;
      circle_name: string;
      circle_slug: string;
      circle_description: string;
      circle_category: CircleCategory;
      circle_location: string | null;
      circle_avatar_url: string | null;
      circle_cover_url: string | null;
      circle_visibility: CircleVisibility;
      circle_membership_policy: MembershipPolicy;
      circle_member_count: string;
      viewer_role: CircleRole | null;
      viewer_membership_status: MembershipStatus | null;
      viewer_join_request_status: JoinRequestStatus | null;
    };

    let eventsRows: EventFeedRow[] = [];
    try {
      const evRes = await tx.query<EventFeedRow>(
        `SELECT e.*,
           COALESCE(u.username, 'member') AS organizer_username,
           COALESCE(u.display_name, 'Organizer') AS organizer_display_name,
           u.avatar_url AS organizer_avatar_url,
           hu.username AS host_username,
           hu.display_name AS host_display_name,
           hu.avatar_url AS host_avatar_url,
           (SELECT COUNT(*)::int FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count,
           (SELECT COUNT(*)::int FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'waitlisted') AS waitlisted_count,
           (SELECT r.status FROM public.event_rsvps r WHERE r.event_id = e.id AND r.user_id = $1::uuid LIMIT 1) AS viewer_rsvp_status,
           c.name AS circle_name,
           c.slug AS circle_slug,
           c.description AS circle_description,
           c.category AS circle_category,
           c.location AS circle_location,
           c.avatar_url AS circle_avatar_url,
           c.cover_url AS circle_cover_url,
           c.visibility AS circle_visibility,
           c.membership_policy AS circle_membership_policy,
           (SELECT COUNT(*)::text FROM public.circle_memberships cm WHERE cm.circle_id = c.id AND cm.status = 'active') AS circle_member_count,
           (SELECT vm.role FROM public.circle_memberships vm WHERE vm.circle_id = c.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_role,
           (SELECT vm.status FROM public.circle_memberships vm WHERE vm.circle_id = c.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_membership_status,
           (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = c.id AND jr.user_id = $1::uuid ORDER BY jr.created_at DESC LIMIT 1) AS viewer_join_request_status
         FROM public.circle_events e
         JOIN public.circles c ON c.id = e.circle_id
         LEFT JOIN public.profiles u ON u.id = e.organizer_id
         LEFT JOIN public.profiles hu ON hu.id = e.host_id
         WHERE e.status = 'published'
           AND c.status = 'active'
           AND (
             c.visibility = 'public'
             OR ($1::uuid IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.circle_memberships m
               WHERE m.circle_id = c.id AND m.user_id = $1::uuid AND m.status = 'active'
             ))
           )
         ORDER BY e.created_at DESC
         LIMIT 25;`,
        [actorUserId]
      );
      eventsRows = evRes.rows;
    } catch {
      eventsRows = [];
    }

    // 3. Fetch Marketplace Listings across readable Circles
    type ListingFeedRow = MarketplaceListingItem & {
      seller_username: string;
      seller_display_name: string;
      seller_avatar_url: string | null;
      circle_name: string;
      circle_slug: string;
      circle_description: string;
      circle_category: CircleCategory;
      circle_location: string | null;
      circle_avatar_url: string | null;
      circle_cover_url: string | null;
      circle_visibility: CircleVisibility;
      circle_membership_policy: MembershipPolicy;
      circle_member_count: string;
      viewer_role: CircleRole | null;
      viewer_membership_status: MembershipStatus | null;
      viewer_join_request_status: JoinRequestStatus | null;
    };

    let listingsRows: ListingFeedRow[] = [];
    try {
      const listRes = await tx.query<ListingFeedRow>(
        `SELECT l.*,
           COALESCE(u.username, 'member') AS seller_username,
           COALESCE(u.display_name, 'Seller') AS seller_display_name,
           u.avatar_url AS seller_avatar_url,
           c.name AS circle_name,
           c.slug AS circle_slug,
           c.description AS circle_description,
           c.category AS circle_category,
           c.location AS circle_location,
           c.avatar_url AS circle_avatar_url,
           c.cover_url AS circle_cover_url,
           c.visibility AS circle_visibility,
           c.membership_policy AS circle_membership_policy,
           (SELECT COUNT(*)::text FROM public.circle_memberships cm WHERE cm.circle_id = c.id AND cm.status = 'active') AS circle_member_count,
           (SELECT vm.role FROM public.circle_memberships vm WHERE vm.circle_id = c.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_role,
           (SELECT vm.status FROM public.circle_memberships vm WHERE vm.circle_id = c.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_membership_status,
           (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = c.id AND jr.user_id = $1::uuid ORDER BY jr.created_at DESC LIMIT 1) AS viewer_join_request_status
         FROM public.marketplace_listings l
         JOIN public.circles c ON c.id = l.circle_id
         LEFT JOIN public.profiles u ON u.id = l.seller_id
         WHERE l.status = 'published'
           AND c.status = 'active'
           AND (
             c.visibility = 'public'
             OR ($1::uuid IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.circle_memberships m
               WHERE m.circle_id = c.id AND m.user_id = $1::uuid AND m.status = 'active'
             ))
           )
         ORDER BY l.created_at DESC
         LIMIT 20;`,
        [actorUserId]
      );
      listingsRows = listRes.rows;
    } catch {
      listingsRows = [];
    }

    // 4. Fetch Courses across all readable Circles (public Circles + user's joined Circles)
    type CourseFeedRow = CourseItem & {
      instructor_username: string;
      instructor_display_name: string;
      instructor_avatar_url: string | null;
      total_lessons_count: string;
      circle_name: string;
      circle_slug: string;
      circle_description: string;
      circle_category: CircleCategory;
      circle_location: string | null;
      circle_avatar_url: string | null;
      circle_cover_url: string | null;
      circle_visibility: CircleVisibility;
      circle_membership_policy: MembershipPolicy;
      circle_member_count: string;
      viewer_role: CircleRole | null;
      viewer_membership_status: MembershipStatus | null;
      viewer_join_request_status: JoinRequestStatus | null;
    };

    let coursesRows: CourseFeedRow[] = [];
    try {
      const crsRes = await tx.query<CourseFeedRow>(
        `SELECT c.*,
           COALESCE(u.username, 'instructor') AS instructor_username,
           COALESCE(u.display_name, 'Instructor') AS instructor_display_name,
           u.avatar_url AS instructor_avatar_url,
           (
             SELECT COUNT(*)::text 
             FROM public.course_lessons l 
             WHERE l.course_id = c.id AND l.circle_id = c.circle_id AND l.status = 'published'
           ) AS total_lessons_count,
           circ.name AS circle_name,
           circ.slug AS circle_slug,
           circ.description AS circle_description,
           circ.category AS circle_category,
           circ.location AS circle_location,
           circ.avatar_url AS circle_avatar_url,
           circ.cover_url AS circle_cover_url,
           circ.visibility AS circle_visibility,
           circ.membership_policy AS circle_membership_policy,
           (SELECT COUNT(*)::text FROM public.circle_memberships cm WHERE cm.circle_id = circ.id AND cm.status = 'active') AS circle_member_count,
           (SELECT vm.role FROM public.circle_memberships vm WHERE vm.circle_id = circ.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_role,
           (SELECT vm.status FROM public.circle_memberships vm WHERE vm.circle_id = circ.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_membership_status,
           (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = circ.id AND jr.user_id = $1::uuid ORDER BY jr.created_at DESC LIMIT 1) AS viewer_join_request_status
         FROM public.courses c
         JOIN public.circles circ ON circ.id = c.circle_id
         LEFT JOIN public.profiles u ON u.id = c.instructor_id
         WHERE c.status = 'published'
           AND circ.status = 'active'
           AND (
             circ.visibility = 'public'
             OR ($1::uuid IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.circle_memberships m
               WHERE m.circle_id = circ.id AND m.user_id = $1::uuid AND m.status = 'active'
             ))
           )
         ORDER BY COALESCE(c.updated_at, c.created_at) DESC
         LIMIT 25;`,
        [actorUserId]
      );
      coursesRows = crsRes.rows;
    } catch {
      coursesRows = [];
    }

    // 5. Fetch Learning Resources across readable Circles
    type ResourceFeedRow = LearningResourceItem & {
      author_username: string;
      author_display_name: string;
      author_avatar_url: string | null;
      circle_name: string;
      circle_slug: string;
      circle_description: string;
      circle_category: CircleCategory;
      circle_location: string | null;
      circle_avatar_url: string | null;
      circle_cover_url: string | null;
      circle_visibility: CircleVisibility;
      circle_membership_policy: MembershipPolicy;
      circle_member_count: string;
      viewer_role: CircleRole | null;
      viewer_membership_status: MembershipStatus | null;
      viewer_join_request_status: JoinRequestStatus | null;
    };

    let resourcesRows: ResourceFeedRow[] = [];
    try {
      const resRes = await tx.query<ResourceFeedRow>(
        `SELECT r.*,
           COALESCE(u.username, 'author') AS author_username,
           COALESCE(u.display_name, 'Author') AS author_display_name,
           u.avatar_url AS author_avatar_url,
           circ.name AS circle_name,
           circ.slug AS circle_slug,
           circ.description AS circle_description,
           circ.category AS circle_category,
           circ.location AS circle_location,
           circ.avatar_url AS circle_avatar_url,
           circ.cover_url AS circle_cover_url,
           circ.visibility AS circle_visibility,
           circ.membership_policy AS circle_membership_policy,
           (SELECT COUNT(*)::text FROM public.circle_memberships cm WHERE cm.circle_id = circ.id AND cm.status = 'active') AS circle_member_count,
           (SELECT vm.role FROM public.circle_memberships vm WHERE vm.circle_id = circ.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_role,
           (SELECT vm.status FROM public.circle_memberships vm WHERE vm.circle_id = circ.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_membership_status,
           (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = circ.id AND jr.user_id = $1::uuid ORDER BY jr.created_at DESC LIMIT 1) AS viewer_join_request_status
         FROM public.learning_resources_items r
         JOIN public.circles circ ON circ.id = r.circle_id
         LEFT JOIN public.profiles u ON u.id = r.author_id
         WHERE r.status = 'published'
           AND circ.status = 'active'
           AND (
             circ.visibility = 'public'
             OR ($1::uuid IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.circle_memberships m
               WHERE m.circle_id = circ.id AND m.user_id = $1::uuid AND m.status = 'active'
             ))
           )
         ORDER BY COALESCE(r.updated_at, r.created_at) DESC
         LIMIT 15;`,
        [actorUserId]
      );
      resourcesRows = resRes.rows;
    } catch {
      resourcesRows = [];
    }

    // 6. Fetch Active Community Causes across readable Circles
    type CauseFeedRow = FundraisingCampaignItem & {
      circle_name: string;
      circle_slug: string;
      circle_description: string;
      circle_category: CircleCategory;
      circle_location: string | null;
      circle_avatar_url: string | null;
      circle_cover_url: string | null;
      circle_visibility: CircleVisibility;
      circle_membership_policy: MembershipPolicy;
      circle_member_count: string;
      viewer_role: CircleRole | null;
      viewer_membership_status: MembershipStatus | null;
      viewer_join_request_status: JoinRequestStatus | null;
    };

    let causesRows: CauseFeedRow[] = [];
    try {
      const causeRes = await tx.query<CauseFeedRow>(
        `SELECT fc.*,
           (SELECT COALESCE(SUM(p.pledge_amount), 0)::float FROM public.fundraising_pledges p WHERE p.campaign_id = fc.id) AS pledged_total,
           (SELECT COUNT(*)::int FROM public.fundraising_pledges p WHERE p.campaign_id = fc.id) AS pledge_count,
           circ.name AS circle_name,
           circ.slug AS circle_slug,
           circ.description AS circle_description,
           circ.category AS circle_category,
           circ.location AS circle_location,
           circ.avatar_url AS circle_avatar_url,
           circ.cover_url AS circle_cover_url,
           circ.visibility AS circle_visibility,
           circ.membership_policy AS circle_membership_policy,
           (SELECT COUNT(*)::text FROM public.circle_memberships cm WHERE cm.circle_id = circ.id AND cm.status = 'active') AS circle_member_count,
           (SELECT vm.role FROM public.circle_memberships vm WHERE vm.circle_id = circ.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_role,
           (SELECT vm.status FROM public.circle_memberships vm WHERE vm.circle_id = circ.id AND vm.user_id = $1::uuid LIMIT 1) AS viewer_membership_status,
           (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = circ.id AND jr.user_id = $1::uuid ORDER BY jr.created_at DESC LIMIT 1) AS viewer_join_request_status
         FROM public.fundraising_campaigns fc
         JOIN public.circles circ ON circ.id = fc.circle_id
         WHERE fc.status = 'active'
           AND circ.status = 'active'
           AND (
             circ.visibility = 'public'
             OR ($1::uuid IS NOT NULL AND EXISTS (
               SELECT 1 FROM public.circle_memberships m
               WHERE m.circle_id = circ.id AND m.user_id = $1::uuid AND m.status = 'active'
             ))
           )
         ORDER BY COALESCE(fc.updated_at, fc.created_at) DESC
         LIMIT 15;`,
        [actorUserId]
      );
      causesRows = causeRes.rows;
    } catch {
      causesRows = [];
    }

    // Build unified GlobalFeedItem[]
    const items: GlobalFeedItem[] = [];

    for (const r of postsRes.rows) {
      const circleCtx: FeedCircleContext = {
        id: r.circle_id,
        name: r.circle_name,
        slug: r.circle_slug,
        description: r.circle_description,
        category: r.circle_category,
        location: r.circle_location,
        avatar_url: r.circle_avatar_url,
        cover_url: r.circle_cover_url,
        visibility: r.circle_visibility,
        membership_policy: r.circle_membership_policy,
        member_count: parseInt(r.circle_member_count ?? '1', 10),
        viewer_role: r.viewer_role,
        viewer_membership_status: r.viewer_membership_status,
        viewer_join_request_status: r.viewer_join_request_status,
      };

      const poll = r.poll_id ? pollMap.get(r.poll_id) ?? null : null;
      const postItem: PostItem = {
        id: r.id,
        circle_id: r.circle_id,
        space_id: r.space_id,
        author_id: r.author_id,
        title: r.title,
        body: r.body,
        status: r.status,
        is_pinned: r.is_pinned,
        comment_count: Number(r.comment_count ?? 0),
        reaction_count: Number(r.reaction_count ?? 0),
        created_at: r.created_at,
        updated_at: r.updated_at,
        author: {
          id: r.author_id,
          username: r.author_username,
          display_name: r.author_display_name,
          avatar_url: r.author_avatar_url,
        },
        space: r.space_id
          ? {
              id: r.space_id,
              name: r.space_name ?? 'General',
              slug: r.space_slug ?? 'general',
              icon: r.space_icon ?? 'message-square',
            }
          : null,
        viewer_has_liked: Boolean(r.viewer_has_liked),
        viewer_has_saved: Boolean(r.viewer_has_saved),
        poll_id: r.poll_id,
        poll,
      };

      const engagementScore =
        postItem.reaction_count * 2 +
        postItem.comment_count * 3 +
        (poll ? (poll.total_votes ?? 0) * 2 : 0) +
        (postItem.is_pinned ? 4 : 0);

      items.push({
        id: `post-${r.id}`,
        itemType: 'post',
        timestamp: r.created_at,
        engagementScore,
        circle: circleCtx,
        authorRole: r.author_circle_role,
        data: postItem,
      });
    }

    const upcomingEvents: Array<CircleEventItem & { circle: FeedCircleContext }> = [];
    const nowMs = Date.now();

    for (const e of eventsRows) {
      const circleCtx: FeedCircleContext = {
        id: e.circle_id,
        name: e.circle_name,
        slug: e.circle_slug,
        description: e.circle_description,
        category: e.circle_category,
        location: e.circle_location,
        avatar_url: e.circle_avatar_url,
        cover_url: e.circle_cover_url,
        visibility: e.circle_visibility,
        membership_policy: e.circle_membership_policy,
        member_count: parseInt(e.circle_member_count ?? '1', 10),
        viewer_role: e.viewer_role,
        viewer_membership_status: e.viewer_membership_status,
        viewer_join_request_status: e.viewer_join_request_status,
      };

      const isConfirmedAttendee =
        e.viewer_rsvp_status === 'going' || e.viewer_membership_status === 'active';
      const hideLoc =
        Boolean(e.host_controls?.hide_location_from_non_attendees) && !isConfirmedAttendee;

      const eventItem: CircleEventItem = {
        ...e,
        venue_text: hideLoc ? 'RSVP to reveal venue' : e.venue_text,
        meeting_url: hideLoc ? null : e.meeting_url,
        location_hidden: hideLoc,
        going_count: Number(e.going_count ?? 0),
        waitlisted_count: Number(e.waitlisted_count ?? 0),
        organizer: {
          id: e.organizer_id,
          username: e.organizer_username,
          display_name: e.organizer_display_name,
          avatar_url: e.organizer_avatar_url,
        },
        host: e.host_username
          ? {
              id: e.host_id || e.organizer_id,
              username: e.host_username,
              display_name: e.host_display_name || e.host_username,
              avatar_url: e.host_avatar_url,
            }
          : {
              id: e.organizer_id,
              username: e.organizer_username,
              display_name: e.organizer_display_name,
              avatar_url: e.organizer_avatar_url,
            },
      };

      items.push({
        id: `event-${e.id}`,
        itemType: 'event',
        timestamp: e.created_at,
        engagementScore: (eventItem.going_count ?? 0) * 3 + 2,
        circle: circleCtx,
        data: eventItem,
      });

      if (new Date(e.ends_at).getTime() >= nowMs) {
        upcomingEvents.push({
          ...eventItem,
          circle: circleCtx,
        });
      }
    }

    upcomingEvents.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );

    for (const l of listingsRows) {
      const circleCtx: FeedCircleContext = {
        id: l.circle_id,
        name: l.circle_name,
        slug: l.circle_slug,
        description: l.circle_description,
        category: l.circle_category,
        location: l.circle_location,
        avatar_url: l.circle_avatar_url,
        cover_url: l.circle_cover_url,
        visibility: l.circle_visibility,
        membership_policy: l.circle_membership_policy,
        member_count: parseInt(l.circle_member_count ?? '1', 10),
        viewer_role: l.viewer_role,
        viewer_membership_status: l.viewer_membership_status,
        viewer_join_request_status: l.viewer_join_request_status,
      };

      const listingItem: MarketplaceListingItem = {
        ...l,
        price_amount:
          l.price_amount !== null && l.price_amount !== undefined ? Number(l.price_amount) : null,
        image_urls: Array.isArray(l.image_urls) ? (l.image_urls as string[]) : [],
        tags: Array.isArray(l.tags) ? (l.tags as string[]) : [],
        custom_fields:
          typeof l.custom_fields === 'object' && l.custom_fields !== null ? l.custom_fields : {},
        seller: {
          id: l.seller_id,
          username: l.seller_username,
          display_name: l.seller_display_name,
          avatar_url: l.seller_avatar_url,
        },
      };

      items.push({
        id: `listing-${l.id}`,
        itemType: 'listing',
        timestamp: l.created_at,
        engagementScore: 2,
        circle: circleCtx,
        data: listingItem,
      });
    }

    // Add Courses to unified stream
    for (const c of coursesRows) {
      const circleCtx: FeedCircleContext = {
        id: c.circle_id,
        name: c.circle_name,
        slug: c.circle_slug,
        description: c.circle_description,
        category: c.circle_category,
        location: c.circle_location,
        avatar_url: c.circle_avatar_url,
        cover_url: c.circle_cover_url,
        visibility: c.circle_visibility,
        membership_policy: c.circle_membership_policy,
        member_count: parseInt(c.circle_member_count ?? '1', 10),
        viewer_role: c.viewer_role,
        viewer_membership_status: c.viewer_membership_status,
        viewer_join_request_status: c.viewer_join_request_status,
      };

      const courseItem: CourseItem = {
        ...c,
        estimated_duration_hours: Number(c.estimated_duration_hours ?? 0),
        sort_order: Number(c.sort_order ?? 0),
        total_lessons_count: parseInt(c.total_lessons_count || '0', 10),
        instructor: {
          id: c.instructor_id,
          username: c.instructor_username,
          display_name: c.instructor_display_name,
          avatar_url: c.instructor_avatar_url,
        },
      };

      items.push({
        id: `course-${c.id}`,
        itemType: 'course',
        timestamp: c.updated_at || c.created_at,
        engagementScore: (courseItem.total_lessons_count || 1) * 2 + 3,
        circle: circleCtx,
        data: courseItem,
      });
    }

    // Add Learning Resources & Guides to unified stream
    for (const r of resourcesRows) {
      const circleCtx: FeedCircleContext = {
        id: r.circle_id,
        name: r.circle_name,
        slug: r.circle_slug,
        description: r.circle_description,
        category: r.circle_category,
        location: r.circle_location,
        avatar_url: r.circle_avatar_url,
        cover_url: r.circle_cover_url,
        visibility: r.circle_visibility,
        membership_policy: r.circle_membership_policy,
        member_count: parseInt(r.circle_member_count ?? '1', 10),
        viewer_role: r.viewer_role,
        viewer_membership_status: r.viewer_membership_status,
        viewer_join_request_status: r.viewer_join_request_status,
      };

      const resItem: LearningResourceItem = {
        ...r,
        author: {
          id: r.author_id,
          username: r.author_username,
          display_name: r.author_display_name,
          avatar_url: r.author_avatar_url,
        },
      };

      items.push({
        id: `resource-${r.id}`,
        itemType: 'resource',
        timestamp: r.updated_at || r.created_at,
        engagementScore: 2,
        circle: circleCtx,
        data: resItem,
      });
    }

    // Add Community Causes to unified stream
    for (const fc of causesRows) {
      const circleCtx: FeedCircleContext = {
        id: fc.circle_id,
        name: fc.circle_name,
        slug: fc.circle_slug,
        description: fc.circle_description,
        category: fc.circle_category,
        location: fc.circle_location,
        avatar_url: fc.circle_avatar_url,
        cover_url: fc.circle_cover_url,
        visibility: fc.circle_visibility,
        membership_policy: fc.circle_membership_policy,
        member_count: parseInt(fc.circle_member_count ?? '1', 10),
        viewer_role: fc.viewer_role,
        viewer_membership_status: fc.viewer_membership_status,
        viewer_join_request_status: fc.viewer_join_request_status,
      };

      const causeItem: FundraisingCampaignItem = {
        ...fc,
        goal_amount: Number(fc.goal_amount ?? 0),
        pledged_total: Number(fc.pledged_total ?? 0),
        pledge_count: Number(fc.pledge_count ?? 0),
      };

      items.push({
        id: `cause-${fc.id}`,
        itemType: 'cause',
        timestamp: fc.updated_at || fc.created_at,
        engagementScore: (causeItem.pledge_count || 1) * 2 + 3,
        circle: circleCtx,
        data: causeItem,
      });
    }

    // Default sort: chronological newest first
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 4. Fetch Trending Public Circles for Discovery & Right Rail
    const circlesRes = await tx.query<
      Circle & {
        member_count: string;
        current_user_role: CircleRole | null;
        current_user_membership_status: MembershipStatus | null;
        current_user_join_request_status: JoinRequestStatus | null;
      }
    >(
      `SELECT c.*,
         (SELECT COUNT(*)::text FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.status = 'active') AS member_count,
         (SELECT m.role FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.user_id = $1::uuid LIMIT 1) AS current_user_role,
         (SELECT m.status FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.user_id = $1::uuid LIMIT 1) AS current_user_membership_status,
         (SELECT jr.status FROM public.circle_join_requests jr WHERE jr.circle_id = c.id AND jr.user_id = $1::uuid ORDER BY jr.created_at DESC LIMIT 1) AS current_user_join_request_status
       FROM public.circles c
       WHERE c.status = 'active'
         AND c.visibility IN ('public', 'discoverable_approval')
       ORDER BY
         (SELECT COUNT(*) FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.status = 'active') DESC,
         c.created_at DESC
       LIMIT 12;`,
      [actorUserId]
    );

    const trendingCircles: Circle[] = circlesRes.rows.map((row) => ({
      ...row,
      member_count: parseInt(row.member_count ?? '1', 10),
    }));

    // 5. Fetch User's Joined Circles & Composer Options (if logged in)
    let myCircles: Circle[] = [];
    const composerCircles: ComposerCircleOption[] = [];

    if (actorUserId) {
      const myRes = await tx.query<
        Circle & {
          member_count: string;
          current_user_role: CircleRole;
          current_user_membership_status: MembershipStatus;
          discussions_enabled: boolean;
          polls_enabled: boolean;
          allow_member_posts: boolean;
        }
      >(
        `SELECT c.*,
           (SELECT COUNT(*)::text FROM public.circle_memberships cm WHERE cm.circle_id = c.id AND cm.status = 'active') AS member_count,
           m.role AS current_user_role,
           m.status AS current_user_membership_status,
           EXISTS (
             SELECT 1 FROM public.circle_capabilities cc
             WHERE cc.circle_id = c.id AND cc.capability_key = 'discussions' AND cc.enabled = true
           ) AS discussions_enabled,
           EXISTS (
             SELECT 1 FROM public.circle_capabilities cc
             WHERE cc.circle_id = c.id AND cc.capability_key = 'polls_decisions' AND cc.enabled = true
           ) AS polls_enabled,
           COALESCE(
             (SELECT (cc.settings->>'allowMemberPosts')::boolean
              FROM public.circle_capabilities cc
              WHERE cc.circle_id = c.id AND cc.capability_key = 'discussions'
              LIMIT 1),
             true
           ) AS allow_member_posts
         FROM public.circle_memberships m
         JOIN public.circles c ON c.id = m.circle_id
         WHERE m.user_id = $1::uuid AND m.status = 'active' AND c.status = 'active'
         ORDER BY
           CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END,
           c.name ASC;`,
        [actorUserId]
      );

      myCircles = myRes.rows.map((r) => ({
        ...r,
        member_count: parseInt(r.member_count ?? '1', 10),
      }));

      const myCircleIds = myRes.rows.map((r) => r.id);
      if (myCircleIds.length > 0) {
        const spacesRes = await tx.query<CircleSpace>(
          `SELECT * FROM public.circle_spaces
           WHERE circle_id = ANY($1::uuid[])
             AND is_archived = false
             AND (capability_key IS NULL OR capability_key = 'discussions')
           ORDER BY sort_order ASC;`,
          [myCircleIds]
        );

        const spacesByCircle = new Map<string, CircleSpace[]>();
        for (const sp of spacesRes.rows) {
          const arr = spacesByCircle.get(sp.circle_id) ?? [];
          arr.push(sp);
          spacesByCircle.set(sp.circle_id, arr);
        }

        for (const row of myRes.rows) {
          if (!row.discussions_enabled) continue;
          const isStaff = ['owner', 'admin', 'moderator'].includes(row.current_user_role);
          if (!row.allow_member_posts && !isStaff) continue;

          const allSpaces = spacesByCircle.get(row.id) ?? [];
          const postableSpaces = allSpaces.filter((sp) => {
            if (sp.posting_policy === 'members') return true;
            if (sp.posting_policy === 'moderators') return isStaff;
            if (sp.posting_policy === 'admins') {
              return ['owner', 'admin'].includes(row.current_user_role);
            }
            return false;
          });

          composerCircles.push({
            id: row.id,
            name: row.name,
            slug: row.slug,
            category: row.category,
            visibility: row.visibility,
            avatar_url: row.avatar_url,
            role: row.current_user_role,
            pollsEnabled: Boolean(row.polls_enabled),
            spaces: postableSpaces.map((sp) => ({
              id: sp.id,
              name: sp.name,
              slug: sp.slug,
              posting_policy: sp.posting_policy,
            })),
          });
        }
      }
    }

    return {
      items,
      composerCircles,
      myCircles,
      trendingCircles,
      upcomingEvents: upcomingEvents.slice(0, 6),
      stats: {
        publicCircleCount: trendingCircles.length,
        totalPostCount: postsRes.rows.length,
        upcomingEventCount: upcomingEvents.length,
      },
    };
  });
}
