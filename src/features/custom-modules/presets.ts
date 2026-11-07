import { CircleCustomModuleField } from '@/types/domain';

export interface CustomFeatureTemplatePreset {
  key: string;
  name: string;
  description: string;
  icon: string;
  layoutType: 'cards' | 'wall' | 'board' | 'embed';
  reactionLabel: string;
  enablePayments: boolean;
  paymentLabel: string;
  boardColumns: string[];
  fieldsSchema: CircleCustomModuleField[];
}

export const BUILT_IN_CUSTOM_FEATURE_TEMPLATES: CustomFeatureTemplatePreset[] = [
  {
    key: 'mentorship_directory',
    name: 'Mentorship & Office Hours',
    description: 'Members offer 1-on-1 mentorship, portfolio reviews, or paid/free advice calls.',
    icon: 'graduation-cap',
    layoutType: 'cards',
    reactionLabel: 'Recommend',
    enablePayments: true,
    paymentLabel: 'Book / Tip Mentor',
    boardColumns: ['Open', 'In Progress', 'Completed'],
    fieldsSchema: [
      { key: 'expertise', label: 'Areas of Expertise', type: 'text', required: true },
      {
        key: 'session_duration',
        label: 'Session Length',
        type: 'select',
        options: ['15 mins', '30 mins', '45 mins', '60 mins'],
      },
      { key: 'booking_link', label: 'Calendar / Meeting Link', type: 'url' },
    ],
  },
  {
    key: 'prayer_testimony_wall',
    name: 'Prayer & Testimony Wall',
    description: 'Share prayer requests, gratitude notes, and community testimonies.',
    icon: 'heart',
    layoutType: 'wall',
    reactionLabel: 'Amen / Praying',
    enablePayments: false,
    paymentLabel: 'Support',
    boardColumns: ['Prayer Request', 'Answered / Praise'],
    fieldsSchema: [
      {
        key: 'request_type',
        label: 'Category',
        type: 'select',
        options: ['Prayer Request', 'Testimony / Praise', 'Encouragement'],
      },
    ],
  },
  {
    key: 'startup_pitch_board',
    name: 'Startup Pitch & Upvote Wall',
    description: 'Founders showcase what they are building, get feedback, and receive upvotes or backing.',
    icon: 'rocket',
    layoutType: 'cards',
    reactionLabel: 'Upvote Pitch',
    enablePayments: true,
    paymentLabel: 'Back / Tip Founder',
    boardColumns: ['Idea', 'Building MVP', 'Launched'],
    fieldsSchema: [
      { key: 'tagline', label: 'One-Line Pitch', type: 'text', required: true },
      { key: 'website_url', label: 'Product / Demo URL', type: 'url' },
      {
        key: 'stage',
        label: 'Stage',
        type: 'select',
        options: ['Idea / Pre-Seed', 'Beta / MVP', 'Live with Users', 'Revenue Generating'],
      },
    ],
  },
  {
    key: 'lost_and_found',
    name: 'Lost, Found & Neighbourhood Alerts',
    description: 'Track lost items, found pets, or local community alerts from report to resolution.',
    icon: 'compass',
    layoutType: 'board',
    reactionLabel: 'Boost Alert',
    enablePayments: true,
    paymentLabel: 'Send Reward',
    boardColumns: ['Lost / Reported', 'Spotted', 'Resolved / Found'],
    fieldsSchema: [
      { key: 'location_seen', label: 'Last Seen Location', type: 'text', required: true },
      { key: 'contact_info', label: 'Contact Phone / Handle', type: 'text' },
    ],
  },
  {
    key: 'feature_requests_roadmap',
    name: 'Feature Requests & Ideas',
    description: 'Let members submit ideas, upvote priorities, and track what gets built next.',
    icon: 'lightbulb',
    layoutType: 'board',
    reactionLabel: 'Upvote Idea',
    enablePayments: false,
    paymentLabel: 'Sponsor',
    boardColumns: ['Proposed', 'Planned', 'In Progress', 'Shipped'],
    fieldsSchema: [
      {
        key: 'impact',
        label: 'Priority / Impact',
        type: 'select',
        options: ['Nice to Have', 'Important', 'Critical'],
      },
    ],
  },
];

export function generateCustomModuleFromPrompt(prompt: string): CustomFeatureTemplatePreset {
  const lower = prompt.toLowerCase();
  if (lower.includes('mentor') || lower.includes('coach') || lower.includes('office hour') || lower.includes('tutor')) {
    return BUILT_IN_CUSTOM_FEATURE_TEMPLATES[0];
  }
  if (lower.includes('pray') || lower.includes('testimon') || lower.includes('church') || lower.includes('gratitude')) {
    return BUILT_IN_CUSTOM_FEATURE_TEMPLATES[1];
  }
  if (lower.includes('pitch') || lower.includes('startup') || lower.includes('founder') || lower.includes('showcase')) {
    return BUILT_IN_CUSTOM_FEATURE_TEMPLATES[2];
  }
  if (lower.includes('lost') || lower.includes('found') || lower.includes('alert') || lower.includes('security')) {
    return BUILT_IN_CUSTOM_FEATURE_TEMPLATES[3];
  }
  if (lower.includes('idea') || lower.includes('roadmap') || lower.includes('request') || lower.includes('feedback')) {
    return BUILT_IN_CUSTOM_FEATURE_TEMPLATES[4];
  }

  const cleanTitle =
    prompt
      .trim()
      .replace(/^(i want|create|build|make|a|an)\s+/gi, '')
      .slice(0, 42) || 'Custom Community Feature';
  const capitalized = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  const mentionsPay =
    lower.includes('pay') ||
    lower.includes('price') ||
    lower.includes('tip') ||
    lower.includes('fee') ||
    lower.includes('buy') ||
    lower.includes('book');

  return {
    key: 'custom_generated',
    name: capitalized,
    description: prompt.trim(),
    icon: 'sparkles',
    layoutType: lower.includes('board') || lower.includes('track') ? 'board' : lower.includes('wall') ? 'wall' : 'cards',
    reactionLabel: 'Upvote',
    enablePayments: mentionsPay,
    paymentLabel: mentionsPay ? 'Support / Pay' : 'Support',
    boardColumns: ['Open', 'In Progress', 'Completed'],
    fieldsSchema: [
      { key: 'category', label: 'Category / Tag', type: 'text', required: false },
      { key: 'link_url', label: 'Reference Link (Optional)', type: 'url', required: false },
    ],
  };
}
