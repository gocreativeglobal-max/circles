'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  RotateCcw,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface LearningObjectivesEditorProps {
  value: string[];
  onChange: (objectives: string[]) => void;
  courseTitle?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Returns dynamic synthesized learning objectives tailored to a course title.
 * Used as both a smart fallback in the UI and a 1-click starter template.
 */
export function generateDefaultObjectives(courseTitle?: string): string[] {
  const cleanTitle = (courseTitle || '').trim() || 'this subject';
  return [
    `Master end-to-end concepts and best practices in ${cleanTitle}.`,
    'Build hands-on practical milestones through real-world projects and exercises.',
    'Understand core architectures, design patterns, and deployment strategies.',
    'Validate your understanding with comprehensive milestone assessments and quizzes.',
    'Gain production-ready confidence to apply these skills in professional workflows.',
    'Earn an official Certificate of Completion upon finishing all modules.',
  ];
}

export function LearningObjectivesEditor({
  value,
  onChange,
  courseTitle,
  disabled = false,
  className = '',
}: LearningObjectivesEditorProps) {
  const [showFallbackPreview, setShowFallbackPreview] = useState(false);
  const defaults = generateDefaultObjectives(courseTitle);
  const isUsingFallback = !value || value.length === 0;

  const handleItemChange = (index: number, text: string) => {
    const next = [...value];
    next[index] = text;
    onChange(next);
  };

  const handleAddItem = () => {
    onChange([...(value || []), '']);
  };

  const handleRemoveItem = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...value];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= value.length - 1) return;
    const next = [...value];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleLoadDefaults = () => {
    onChange([...defaults]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-stone-50/70 p-4 sm:p-5 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200/80 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-stone-900" />
            <h4 className="text-xs sm:text-sm font-bold text-stone-900">
              What You&apos;ll Learn (Outcomes)
            </h4>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isUsingFallback
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isUsingFallback
                ? 'Smart Fallback Active'
                : `${value.length} Custom ${value.length === 1 ? 'Outcome' : 'Outcomes'}`}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-stone-500 leading-relaxed">
            Highlighted learning goals displayed on the course landing page. If left blank,
            the system automatically shows tailored default outcomes.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadDefaults}
            disabled={disabled}
            className="h-7 text-[11px] font-semibold gap-1.5 border-stone-300 bg-white hover:bg-stone-100 text-stone-800 shadow-2xs"
            title="Load suggested defaults based on course title"
          >
            <Sparkles className="h-3 w-3 text-amber-600" />
            <span>Load Suggested</span>
          </Button>

          {!isUsingFallback && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={disabled}
              className="h-7 text-[11px] font-semibold gap-1 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60"
              title="Clear custom outcomes and revert to dynamic defaults"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Use Fallback</span>
            </Button>
          )}
        </div>
      </div>

      {/* Fallback Active State */}
      {isUsingFallback ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white/80 p-4 space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 shrink-0 mt-0.5">
              <Info className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-xs font-bold text-stone-900">
                Default smart outcomes will be displayed to learners
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                You haven&apos;t specified custom outcomes yet. The course landing page will
                automatically generate and display 6 tailored learning objectives based on{' '}
                <span className="font-semibold text-stone-800">
                  &ldquo;{courseTitle || 'this course'}&rdquo;
                </span>
                .
              </p>
            </div>
          </div>

          {/* Collapsible preview of what learners see */}
          <div className="border-t border-stone-100 pt-2.5">
            <button
              type="button"
              onClick={() => setShowFallbackPreview((prev) => !prev)}
              className="flex items-center justify-between w-full text-[11px] font-semibold text-stone-600 hover:text-stone-900 transition-colors py-1"
            >
              <span className="flex items-center gap-1.5">
                <span>Preview the 6 default outcomes learners will see</span>
                <span className="rounded bg-stone-100 px-1.5 py-0.2 text-[10px] text-stone-500">
                  Auto-Generated
                </span>
              </span>
              {showFallbackPreview ? (
                <ChevronUp className="h-3.5 w-3.5 text-stone-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
              )}
            </button>

            {showFallbackPreview && (
              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200/80 animate-in fade-in duration-150">
                {defaults.map((def, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-stone-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{def}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action to customize */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadDefaults}
              disabled={disabled}
              className="text-xs font-semibold gap-1.5 bg-stone-900 text-white hover:bg-black hover:text-white border-black h-8 px-3 rounded-lg"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Customize These Defaults</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={disabled}
              className="text-xs font-semibold gap-1.5 border-stone-300 bg-white hover:bg-stone-100 text-stone-800 h-8 px-3 rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Custom Objective from Scratch</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Custom Objectives List */
        <div className="space-y-2.5">
          <div className="space-y-2">
            {value.map((item, index) => (
              <div
                key={index}
                className="group flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2 shadow-2xs transition-colors focus-within:border-stone-900 focus-within:ring-1 focus-within:ring-stone-900"
              >
                {/* Index badge */}
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-[11px] font-bold text-stone-600">
                  {index + 1}
                </div>

                {/* Input field */}
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  placeholder={`e.g. Master end-to-end concepts in ${courseTitle || 'this course'}...`}
                  disabled={disabled}
                  className="flex-1 bg-transparent px-2 py-1 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden"
                />

                {/* Action buttons (Move Up, Move Down, Delete) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={disabled || index === 0}
                    className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-20 disabled:hover:bg-transparent"
                    title="Move up"
                    aria-label="Move objective up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={disabled || index >= value.length - 1}
                    className="p-1 rounded text-stone-400 hover:text-stone-800 hover:bg-stone-100 disabled:opacity-20 disabled:hover:bg-transparent"
                    title="Move down"
                    aria-label="Move objective down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled}
                    className="p-1 rounded text-stone-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete objective"
                    aria-label="Delete objective"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Add & Info Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={disabled}
              className="text-xs font-semibold gap-1.5 border-dashed border-stone-300 bg-white hover:bg-stone-100 text-stone-800 h-8 rounded-lg px-3"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Another Objective</span>
            </Button>

            <span className="text-[11px] text-stone-500">
              Tip: Aim for 4 to 8 clear, measurable student outcomes.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
