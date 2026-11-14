'use client';

import React from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ListChecks,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface LearningObjectivesEditorProps {
  value: string[];
  onChange: (objectives: string[]) => void;
  courseTitle?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export function LearningObjectivesEditor({
  value = [],
  onChange,
  disabled = false,
  className = '',
  required = true,
}: LearningObjectivesEditorProps) {
  const items = Array.isArray(value) ? value : [];
  const validItems = items.filter((s) => s.trim().length > 0);
  const isValid = validItems.length > 0;

  const handleItemChange = (index: number, text: string) => {
    const next = [...items];
    next[index] = text;
    onChange(next);
  };

  const handleAddItem = () => {
    onChange([...items, '']);
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const next = [...items];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  };

  return (
    <div
      className={`rounded-2xl border ${
        !isValid && required ? 'border-amber-300 bg-amber-50/20' : 'border-stone-200 bg-stone-50/70'
      } p-4 sm:p-5 space-y-4 ${className}`}
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
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                isValid
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {isValid
                ? `${validItems.length} ${validItems.length === 1 ? 'Outcome' : 'Outcomes'}`
                : 'Required — Must be filled'}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-stone-500 leading-relaxed">
            Specify the practical skills and outcomes students will acquire. This is user-filled and required on the course page.
          </p>
        </div>

        {/* Action: Add Item */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            disabled={disabled}
            className="h-7 text-[11px] font-semibold gap-1.5 border-stone-300 bg-white hover:bg-stone-100 text-stone-900 shadow-2xs"
          >
            <Plus className="h-3 w-3" />
            <span>Add Outcome</span>
          </Button>
        </div>
      </div>

      {/* Validation alert if empty */}
      {items.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3.5 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-bold">What will students learn in this course?</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Default placeholders are disabled. You must explicitly enter at least one learning outcome (e.g. &ldquo;Build a production-ready application&rdquo;).
            </p>
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-800 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-amber-900 transition-colors shadow-2xs"
            >
              <Plus className="h-3 w-3" />
              <span>Add First Outcome</span>
            </button>
          </div>
        </div>
      )}

      {/* Objective Input Rows */}
      {items.length > 0 && (
        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-xl border border-stone-200/90 bg-white p-2 shadow-2xs transition-all hover:border-stone-300 focus-within:border-stone-900"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-[11px] font-mono font-bold text-stone-600">
                {idx + 1}
              </span>

              <input
                type="text"
                value={item}
                onChange={(e) => handleItemChange(idx, e.target.value)}
                placeholder={`e.g. Master core architectural principles and state management`}
                disabled={disabled}
                className="flex-1 bg-transparent text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden"
              />

              {/* Row controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveUp(idx)}
                  disabled={disabled || idx === 0}
                  className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30 transition-colors"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(idx)}
                  disabled={disabled || idx === items.length - 1}
                  className="rounded p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30 transition-colors"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  disabled={disabled}
                  className="rounded p-1 text-stone-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Add more button */}
          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddItem}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-black transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-stone-500" />
              <span>Add another outcome</span>
            </button>
            {!isValid && (
              <span className="text-[11px] font-medium text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Please fill in at least one outcome.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
