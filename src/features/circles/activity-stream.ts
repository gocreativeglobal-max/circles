import { withRlsTransaction } from '@/lib/db/postgres';
import { listCirclePosts } from '@/features/discussions/service';
import { listMarketplaceListings } from '@/features/marketplace/service';
import { listCircleEvents } from '@/features/events/service';
import { listCirclePolls } from '@/features/polls/service';
import { listCourses } from '@/features/courses/service';
import {
  listLearningResources,
  listCircleProjects,
} from '@/features/resources/service';
import { listFundraisingCampaigns } from '@/features/governance/service';
import {
  CircleEventItem,
  CirclePollItem,
  CourseItem,
  FundraisingCampaignItem,
  LearningResourceItem,
  MarketplaceListingItem,
  CircleProjectItem,
  PostItem,
} from '@/types/domain';

export type ActivityStreamItem =
  | {
      id: string;
      itemType: 'post';
      timestamp: string;
      data: PostItem;
    }
  | {
      id: string;
      itemType: 'listing';
      timestamp: string;
      data: MarketplaceListingItem;
    }
  | {
      id: string;
      itemType: 'event';
      timestamp: string;
      data: CircleEventItem;
    }
  | {
      id: string;
      itemType: 'poll';
      timestamp: string;
      data: CirclePollItem;
    }
  | {
      id: string;
      itemType: 'course';
      timestamp: string;
      data: CourseItem;
    }
  | {
      id: string;
      itemType: 'resource';
      timestamp: string;
      data: LearningResourceItem;
    }
  | {
      id: string;
      itemType: 'cause';
      timestamp: string;
      data: FundraisingCampaignItem;
    }
  | {
      id: string;
      itemType: 'project';
      timestamp: string;
      data: CircleProjectItem;
    };

export interface UnifiedStreamData {
  items: ActivityStreamItem[];
  upcomingEvents: CircleEventItem[];
  featuredListings: MarketplaceListingItem[];
  featuredCourses: CourseItem[];
  featuredCauses?: FundraisingCampaignItem[];
  featuredProjects?: CircleProjectItem[];
  counts: {
    posts: number;
    listings: number;
    events: number;
    polls: number;
    courses: number;
    resources: number;
    all: number;
  };
}

/**
 * Aggregates all community updates (courses, events, posts, listings, polls,
 * resources, causes, projects) into a unified, chronological activity stream for the Circle Overview.
 * Uses updated_at || created_at so updates made across any community feature are immediately visible.
 */
export async function getCircleActivityStream(
  actorUserId: string | null,
  circleId: string,
  enabledCapabilityKeys: string[]
): Promise<UnifiedStreamData> {
  const isEnabled = (key: string) => enabledCapabilityKeys.includes(key);

  const [
    postsRes,
    listingsRes,
    eventsRes,
    pollsRes,
    coursesRes,
    resourcesRes,
    causesRes,
    projectsRes,
  ] = await Promise.all([
    isEnabled('discussions')
      ? listCirclePosts(actorUserId, circleId, { limit: 20 }).catch(() => [])
      : Promise.resolve([]),
    isEnabled('marketplace') || isEnabled('listings_discovery') || isEnabled('rentals_sharing')
      ? listMarketplaceListings(actorUserId, circleId, { limit: 20 }).catch(() => [])
      : Promise.resolve([]),
    isEnabled('events') || isEnabled('events_activities')
      ? listCircleEvents(actorUserId, circleId).catch(() => [])
      : Promise.resolve([]),
    isEnabled('polls_decisions') || isEnabled('polls')
      ? listCirclePolls(actorUserId, circleId).catch(() => [])
      : Promise.resolve([]),
    // 5. Courses created in this Circle (always included when courses exist)
    withRlsTransaction(actorUserId, async (tx) => {
      const crsRes = await tx.query<
        CourseItem & {
          instructor_username: string;
          instructor_display_name: string;
          instructor_avatar_url: string | null;
          total_lessons_count: string;
        }
      >(
        `SELECT 
           c.*,
           COALESCE(p.username, 'instructor') AS instructor_username,
           COALESCE(p.display_name, 'Instructor') AS instructor_display_name,
           p.avatar_url AS instructor_avatar_url,
           (
             SELECT COUNT(*)::text 
             FROM public.course_lessons l 
             WHERE l.course_id = c.id AND l.circle_id = c.circle_id AND l.status = 'published'
           ) AS total_lessons_count
         FROM public.courses c
         LEFT JOIN public.profiles p ON p.id = c.instructor_id
         WHERE c.circle_id = $1 AND c.status = 'published'
         ORDER BY COALESCE(c.updated_at, c.created_at) DESC
         LIMIT 25;`,
        [circleId]
      );
      return crsRes.rows.map((row) => ({
        ...row,
        estimated_duration_hours: Number(row.estimated_duration_hours ?? 0),
        sort_order: Number(row.sort_order ?? 0),
        total_lessons_count: parseInt(row.total_lessons_count || '0', 10),
        instructor: {
          id: row.instructor_id,
          username: row.instructor_username,
          display_name: row.instructor_display_name,
          avatar_url: row.instructor_avatar_url,
        },
      }));
    }).catch(async () => {
      return listCourses(actorUserId, circleId).catch(() => []);
    }),
    isEnabled('learning_resources') || isEnabled('knowledge_base')
      ? listLearningResources(actorUserId, circleId).catch(() => [])
      : Promise.resolve([]),
    isEnabled('fundraising_causes') || isEnabled('causes')
      ? listFundraisingCampaigns(actorUserId, circleId).catch(() => [])
      : Promise.resolve([]),
    isEnabled('projects_collaboration') || isEnabled('projects')
      ? listCircleProjects(actorUserId, circleId).catch(() => [])
      : Promise.resolve([]),
  ]);

  const streamItems: ActivityStreamItem[] = [];

  // 1. Discussion Posts (use updated_at if updated, else created_at)
  for (const post of postsRes) {
    streamItems.push({
      id: `post-${post.id}`,
      itemType: 'post',
      timestamp: post.updated_at || post.created_at,
      data: post,
    });
  }

  // 2. Courses (new or updated)
  for (const course of coursesRes) {
    streamItems.push({
      id: `course-${course.id}`,
      itemType: 'course',
      timestamp: course.updated_at || course.created_at,
      data: course,
    });
  }

  // 3. Events (new or updated)
  for (const event of eventsRes) {
    streamItems.push({
      id: `event-${event.id}`,
      itemType: 'event',
      timestamp: event.updated_at || event.created_at,
      data: event,
    });
  }

  // 4. Marketplace & Housing Listings
  for (const listing of listingsRes) {
    streamItems.push({
      id: `listing-${listing.id}`,
      itemType: 'listing',
      timestamp: listing.updated_at || listing.created_at,
      data: listing,
    });
  }

  // 5. Polls
  for (const poll of pollsRes) {
    streamItems.push({
      id: `poll-${poll.id}`,
      itemType: 'poll',
      timestamp: poll.created_at,
      data: poll,
    });
  }

  // 6. Learning Resources & Guides
  for (const resource of resourcesRes) {
    streamItems.push({
      id: `resource-${resource.id}`,
      itemType: 'resource',
      timestamp: resource.updated_at || resource.created_at,
      data: resource,
    });
  }

  // 7. Fundraising Campaigns & Causes
  for (const cause of causesRes) {
    streamItems.push({
      id: `cause-${cause.id}`,
      itemType: 'cause',
      timestamp: cause.updated_at || cause.created_at,
      data: cause,
    });
  }

  // 8. Projects
  for (const proj of projectsRes) {
    streamItems.push({
      id: `project-${proj.id}`,
      itemType: 'project',
      timestamp: proj.updated_at || proj.created_at,
      data: proj,
    });
  }

  // Sort chronological descending (newest activity / update first)
  streamItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter upcoming events for spotlight
  const now = Date.now();
  const upcomingEvents = eventsRes
    .filter((e) => new Date(e.starts_at).getTime() >= now - 3600_000)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 4);

  // Filter featured marketplace listings for spotlight
  const featuredListings = listingsRes
    .filter((l) => l.status === 'published')
    .slice(0, 4);

  // Filter featured courses
  const featuredCourses = coursesRes.slice(0, 3);
  const featuredCauses = causesRes.slice(0, 2);
  const featuredProjects = projectsRes.slice(0, 2);

  return {
    items: streamItems,
    upcomingEvents,
    featuredListings,
    featuredCourses,
    featuredCauses,
    featuredProjects,
    counts: {
      posts: postsRes.length,
      listings: listingsRes.length,
      events: eventsRes.length,
      polls: pollsRes.length,
      courses: coursesRes.length,
      resources: resourcesRes.length,
      all: streamItems.length,
    },
  };
}
