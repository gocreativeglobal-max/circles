'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Check,
  Edit2,
  Globe,
  RotateCcw,
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  parseDaysFromSchedule,
  formatWeeklySchedule,
  formatTime12h,
} from '@/lib/courses/cohort-helpers';

export interface ClassSchedulePickerProps {
  value: string;
  onChange: (formattedSchedule: string) => void;
  className?: string;
  label?: string;
  helperText?: string;
}

const COMMON_TIME_PRESETS = [
  { label: '10:00 AM', time24: '10:00' },
  { label: '2:00 PM', time24: '14:00' },
  { label: '6:00 PM', time24: '18:00' },
  { label: '7:00 PM', time24: '19:00' },
  { label: '8:00 PM', time24: '20:00' },
];

export function ClassSchedulePicker({
  value,
  onChange,
  className = '',
  label = 'Class Days & Weekly Schedule',
  helperText = 'Select the days of the week when live workshops will take place.',
}: ClassSchedulePickerProps) {
  // Detected local timezone or UTC
  const detectedTz = typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    : 'UTC';

  const [selectedDays, setSelectedDays] = useState<string[]>(() => {
    const parsed = parseDaysFromSchedule(value);
    return parsed.length > 0 ? parsed : ['tue', 'thu'];
  });

  const [time, setTime] = useState<string>(() => {
    // Attempt to extract 24h or 12h time from value
    const match = value.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const meridiem = match[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    return '18:00';
  });

  const [timezone, setTimezone] = useState<string>(() => {
    if (value.toLowerCase().includes('utc')) return 'UTC';
    if (value.toLowerCase().includes('est')) return 'EST';
    if (value.toLowerCase().includes('pst')) return 'PST';
    return 'UTC';
  });

  const [isManualEdit, setIsManualEdit] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>(value);

  // Sync internal state when parent value updates
  useEffect(() => {
    setManualText(value);
  }, [value]);

  function handleToggleDay(dayKey: string) {
    let nextDays: string[];
    if (selectedDays.includes(dayKey)) {
      nextDays = selectedDays.filter((d) => d !== dayKey);
    } else {
      nextDays = [...selectedDays, dayKey];
    }
    setSelectedDays(nextDays);

    const formatted = formatWeeklySchedule({
      selectedDays: nextDays,
      time,
      timezone,
    });
    setManualText(formatted);
    onChange(formatted);
  }

  function handleQuickPreset(preset: 'weekdays' | 'tue_thu' | 'mon_wed_fri' | 'weekends' | 'all' | 'clear') {
    let nextDays: string[] = [];
    if (preset === 'weekdays') nextDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
    else if (preset === 'tue_thu') nextDays = ['tue', 'thu'];
    else if (preset === 'mon_wed_fri') nextDays = ['mon', 'wed', 'fri'];
    else if (preset === 'weekends') nextDays = ['sat', 'sun'];
    else if (preset === 'all') nextDays = DAYS_OF_WEEK.map((d) => d.key);
    else if (preset === 'clear') nextDays = [];

    setSelectedDays(nextDays);
    const formatted = formatWeeklySchedule({
      selectedDays: nextDays,
      time,
      timezone,
    });
    setManualText(formatted);
    onChange(formatted);
  }

  function handleTimeChange(newTime: string) {
    setTime(newTime);
    const formatted = formatWeeklySchedule({
      selectedDays,
      time: newTime,
      timezone,
    });
    setManualText(formatted);
    onChange(formatted);
  }

  function handleTimezoneChange(newTz: string) {
    setTimezone(newTz);
    const formatted = formatWeeklySchedule({
      selectedDays,
      time,
      timezone: newTz,
    });
    setManualText(formatted);
    onChange(formatted);
  }

  function handleManualChange(text: string) {
    setManualText(text);
    onChange(text);
    const parsed = parseDaysFromSchedule(text);
    if (parsed.length > 0) {
      setSelectedDays(parsed);
    }
  }

  return (
    <div className={`space-y-3.5 rounded-xl border border-stone-200/90 bg-stone-50/70 p-4 ${className}`}>
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-stone-200/60 pb-2.5">
        <div>
          <label className="block text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <span>{label}</span>
          </label>
          {helperText && (
            <p className="text-[11px] text-stone-500 mt-0.5">{helperText}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsManualEdit(!isManualEdit)}
          className="self-start sm:self-auto inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 transition-colors"
        >
          <Edit2 className="h-3 w-3" />
          <span>{isManualEdit ? 'Use Visual Day Selector' : 'Edit as Custom Text'}</span>
        </button>
      </div>

      {!isManualEdit ? (
        <div className="space-y-3.5">
          {/* Day of the Week Box Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-stone-700">
                Select Class Days:
              </span>
              <span className="text-[10px] font-mono text-stone-500">
                {selectedDays.length} {selectedDays.length === 1 ? 'day' : 'days'} selected
              </span>
            </div>

            {/* 7 Interactive Day Boxes */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => handleToggleDay(day.key)}
                    className={`group relative flex flex-col items-center justify-center rounded-xl py-2.5 px-1 text-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/30 font-bold border-transparent'
                        : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400 hover:bg-stone-50 font-medium'
                    }`}
                    title={day.label}
                    aria-label={`Toggle ${day.label}`}
                    aria-pressed={isSelected}
                  >
                    <span className="text-xs sm:text-sm font-black tracking-tight">
                      {day.letter}
                    </span>
                    <span className={`text-[10px] font-semibold mt-0.5 uppercase tracking-wider ${
                      isSelected ? 'text-blue-100' : 'text-stone-400 group-hover:text-stone-600'
                    }`}>
                      {day.short}
                    </span>

                    {isSelected && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-blue-700 shadow-2xs">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Preset Chips */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium text-stone-400">Quick presets:</span>
              <button
                type="button"
                onClick={() => handleQuickPreset('tue_thu')}
                className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
              >
                Tue & Thu
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('mon_wed_fri')}
                className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
              >
                Mon, Wed, Fri
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('weekdays')}
                className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
              >
                Mon–Fri (Weekdays)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('weekends')}
                className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50 transition-colors"
              >
                Weekends
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('clear')}
                className="rounded-md border border-dashed border-stone-300 px-2 py-0.5 text-[10px] text-stone-500 hover:text-stone-800 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Time & Timezone Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Session Time */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3 text-stone-500" />
                <span>Session Time</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 font-mono focus:border-stone-900 focus:outline-hidden"
                />
              </div>

              {/* Time Chips */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {COMMON_TIME_PRESETS.map((p) => (
                  <button
                    key={p.time24}
                    type="button"
                    onClick={() => handleTimeChange(p.time24)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      time === p.time24
                        ? 'bg-blue-100 text-blue-800 font-bold'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Globe className="h-3 w-3 text-stone-500" />
                <span>Timezone</span>
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={timezone}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 font-medium focus:border-stone-900 focus:outline-hidden"
                >
                  <option value="UTC">UTC (Universal Time)</option>
                  <option value="EST">EST (Eastern Standard Time)</option>
                  <option value="CST">CST (Central Standard Time)</option>
                  <option value="PST">PST (Pacific Standard Time)</option>
                  <option value="GMT">GMT (Greenwich Mean Time)</option>
                  <option value="BST">BST (British Summer Time)</option>
                  <option value="CET">CET (Central European Time)</option>
                  <option value="WAT">WAT (West Africa Time)</option>
                  <option value="EAT">EAT (East Africa Time)</option>
                  <option value="IST">IST (India Standard Time)</option>
                  <option value="JST">JST (Japan Standard Time)</option>
                  {detectedTz && !['UTC', 'EST', 'CST', 'PST', 'GMT', 'BST', 'CET', 'WAT', 'EAT', 'IST', 'JST'].includes(detectedTz) && (
                    <option value={detectedTz}>{detectedTz} (Local)</option>
                  )}
                </select>
              </div>
              <p className="mt-1 text-[10px] text-stone-400">
                Local detected: {detectedTz}
              </p>
            </div>
          </div>

          {/* Generated Schedule Preview Box */}
          <div className="rounded-lg bg-blue-50/70 border border-blue-200/80 px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
              <div className="truncate text-xs">
                <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider block">
                  Generated Schedule
                </span>
                <span className="font-bold text-stone-900 truncate">
                  {manualText || 'Please select at least 1 day of the week'}
                </span>
              </div>
            </div>
            {time && (
              <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[10px] font-mono font-bold text-blue-900 border border-blue-200">
                {formatTime12h(time)}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Manual Custom Text Input */
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-stone-700">
            Custom Schedule Description
          </label>
          <input
            type="text"
            value={manualText}
            onChange={(e) => handleManualChange(e.target.value)}
            placeholder="e.g. Tuesdays & Thursdays at 6:00 PM UTC"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
          />
          <p className="text-[10px] text-stone-500 leading-relaxed">
            Write any specific schedule nuances, e.g. &ldquo;Every Tuesday at 6:00 PM UTC + Saturday Q&A Session&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Visual 7-day pill strip for display in course landing pages and classroom hubs
 */
export function ClassScheduleDaysStrip({
  scheduleDescription,
  className = '',
}: {
  scheduleDescription?: string | null;
  className?: string;
}) {
  const activeDays = parseDaysFromSchedule(scheduleDescription);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {DAYS_OF_WEEK.map((d) => {
        const isActive = activeDays.includes(d.key);
        return (
          <span
            key={d.key}
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-400 border border-stone-200/60'
            }`}
            title={`${d.label} ${isActive ? '(Class Day)' : ''}`}
          >
            {d.letter}
          </span>
        );
      })}
    </div>
  );
}
