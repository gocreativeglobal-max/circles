'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, Circle as CircleIcon, X } from 'lucide-react';
import { Circle, UserProfile } from '@/types/domain';

interface OnboardingStep {
  id: string;
  title: string;
  href?: string;
  isAutoCompleted?: boolean;
}

interface CircleOnboardingChecklistProps {
  circle: Circle;
  currentUser: UserProfile | null;
  hasPosts: boolean;
  enabledCapabilityKeys: string[];
}

export function CircleOnboardingChecklist({
  circle,
  currentUser,
  hasPosts,
  enabledCapabilityKeys,
}: CircleOnboardingChecklistProps) {
  const [mounted, setMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const userId = currentUser?.id ?? null;
  const isOwnerOrAdmin =
    circle.current_user_role === 'owner' || circle.current_user_role === 'admin';
  const isActiveMember = circle.current_user_membership_status === 'active';
  const base = `/circles/${circle.slug}`;

  const storageKey = `circles_onboarding_${circle.id}_${userId ?? 'guest'}`;
  const dismissedKey = `circles_onboarding_dismissed_${circle.id}_${userId ?? 'guest'}`;

  const steps: OnboardingStep[] = isOwnerOrAdmin
    ? [
        { id: 'studio_config', title: 'Set up your features', href: `${base}/studio` },
        { id: 'spaces_setup', title: 'Create spaces', href: `${base}/spaces` },
        { id: 'welcome_post', title: 'Write a welcome post', href: `${base}/discussions`, isAutoCompleted: hasPosts },
        {
          id: 'invite_members',
          title: 'Invite members',
          href: `${base}/members`,
          isAutoCompleted: (circle.member_count ?? 1) > 1,
        },
      ]
    : [
        {
          id: 'profile_setup',
          title: 'Complete your profile',
          href: '/profile',
          isAutoCompleted: Boolean(currentUser?.avatar_url && currentUser?.bio),
        },
        { id: 'introduce_self', title: 'Say hello', href: `${base}/discussions`, isAutoCompleted: hasPosts },
        enabledCapabilityKeys.includes('marketplace')
          ? { id: 'explore_capabilities', title: 'Browse the marketplace', href: `${base}/marketplace` }
          : { id: 'explore_capabilities', title: 'Meet members', href: `${base}/members` },
      ];

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(dismissedKey) === 'true') setIsDismissed(true);
      const saved = localStorage.getItem(storageKey);
      if (saved) setCompletedSteps(JSON.parse(saved));
    } catch {
      // Ignore localStorage read errors
    }
  }, [storageKey, dismissedKey]);

  if (!mounted || isDismissed || !isActiveMember) return null;

  const isStepDone = (step: OnboardingStep) => step.isAutoCompleted || Boolean(completedSteps[step.id]);
  const completedCount = steps.filter(isStepDone).length;
  if (completedCount === steps.length) return null;

  const toggleStep = (stepId: string) => {
    const next = { ...completedSteps, [stepId]: !completedSteps[stepId] };
    setCompletedSteps(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore storage write errors
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(dismissedKey, 'true');
    } catch {
      // Ignore storage write errors
    }
  };

  return (
    <section aria-label="Getting started" className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">
          Getting started{' '}
          <span className="font-normal text-stone-400">
            {completedCount}/{steps.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="mt-2 space-y-0.5">
        {steps.map((step) => {
          const done = isStepDone(step);
          return (
            <li key={step.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-stone-50">
              <button
                type="button"
                onClick={() => toggleStep(step.id)}
                aria-label={`Mark "${step.title}" as ${done ? 'incomplete' : 'complete'}`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-stone-700" />
                ) : (
                  <CircleIcon className="h-4 w-4 text-stone-300" />
                )}
              </button>
              {step.href ? (
                <Link
                  href={step.href}
                  className={`flex flex-1 items-center justify-between text-sm ${
                    done ? 'text-stone-400 line-through' : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  {step.title}
                  <ChevronRight className="h-4 w-4 text-stone-300" />
                </Link>
              ) : (
                <span className="text-sm text-stone-700">{step.title}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
