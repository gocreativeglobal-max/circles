import { CircleCategory, CircleVisibility, MembershipPolicy } from '@/types/domain';

export interface CircleTemplateSpec {
  key: string;
  name: string;
  version: number;
  category: CircleCategory;
  summary: string;
  defaultVisibility: CircleVisibility;
  defaultMembershipPolicy: MembershipPolicy;
  enabledCapabilities: string[];
  suggestedSpaces?: Array<{
    name: string;
    slug: string;
    description: string;
    icon: string;
    capabilityKey: string | null;
    postingPolicy: 'members' | 'moderators' | 'admins';
  }>;
}

export const CIRCLE_TEMPLATES: Record<string, CircleTemplateSpec> = {
  university: {
    key: 'university',
    name: 'University & Campus Hub',
    version: 1,
    category: 'university',
    summary:
      'Designed for universities, faculties, and student unions with study spaces, campus announcements, events, and opportunities.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'open',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'events',
      'rsvps',
      'learning_resources',
      'marketplace',
    ],
    suggestedSpaces: [],
  },
  neighbourhood: {
    key: 'neighbourhood',
    name: 'Neighbourhood Association',
    version: 1,
    category: 'neighbourhood',
    summary:
      'Connect residents with local announcements, mutual aid requests, neighbourhood events, and shared resources.',
    defaultVisibility: 'discoverable_approval',
    defaultMembershipPolicy: 'approval',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'events',
    ],
    suggestedSpaces: [],
  },
  professional: {
    key: 'professional',
    name: 'Professional Network',
    version: 1,
    category: 'professional',
    summary:
      'Curated industry network with topical discussions, member directory, job opportunities, and peer mentorship.',
    defaultVisibility: 'discoverable_approval',
    defaultMembershipPolicy: 'approval',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'marketplace',
      'events',
    ],
    suggestedSpaces: [],
  },
  creator: {
    key: 'creator',
    name: 'Creator Community',
    version: 1,
    category: 'creator',
    summary:
      'Gather supporters and collaborators around discussions, behind-the-scenes updates, and creative feedback spaces.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'open',
    enabledCapabilities: ['discussions', 'spaces', 'member_directory', 'events'],
    suggestedSpaces: [],
  },
  learning: {
    key: 'learning',
    name: 'Learning & Cohort Community',
    version: 1,
    category: 'learning',
    summary:
      'Run structured study groups, curriculum spaces, Q&A discussions, and shared resource libraries.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'open',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'learning_resources',
    ],
    suggestedSpaces: [],
  },
  sports: {
    key: 'sports',
    name: 'Sports & Athletics Club',
    version: 1,
    category: 'sports',
    summary:
      'Coordinate training sessions, match schedules, RSVPs, and club announcements.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'open',
    enabledCapabilities: ['discussions', 'spaces', 'member_directory', 'events', 'rsvps'],
    suggestedSpaces: [],
  },
  project: {
    key: 'project',
    name: 'Startup & Project Team',
    version: 1,
    category: 'project',
    summary:
      'Organize builders around project tracks, release discussions, help desks, and shared specs.',
    defaultVisibility: 'private',
    defaultMembershipPolicy: 'invite_only',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'projects_collaboration',
    ],
    suggestedSpaces: [],
  },
  local_business: {
    key: 'local_business',
    name: 'Local Business Collective',
    version: 1,
    category: 'local_business',
    summary:
      'Unite local merchants, chambers of commerce, and community partners for events and collaborative initiatives.',
    defaultVisibility: 'public',
    defaultMembershipPolicy: 'approval',
    enabledCapabilities: [
      'discussions',
      'spaces',
      'member_directory',
      'events',
    ],
    suggestedSpaces: [],
  },
};

export function getAllCircleTemplates(): CircleTemplateSpec[] {
  return Object.values(CIRCLE_TEMPLATES);
}
