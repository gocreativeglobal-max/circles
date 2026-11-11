'use client';

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Circle } from '@/types/domain';
import { InviteModal } from './invite-modal';

interface InviteMembersButtonProps {
  circle: Circle;
  isStaff: boolean;
}

export function InviteMembersButton({ circle, isStaff }: InviteMembersButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-stone-300 transition-colors"
      >
        <UserPlus className="h-3.5 w-3.5 text-stone-500" />
        <span>Invite Members</span>
      </button>

      <InviteModal
        circle={circle}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        isStaff={isStaff}
      />
    </>
  );
}
