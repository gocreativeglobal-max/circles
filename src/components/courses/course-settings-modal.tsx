'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Image as ImageIcon,
  Clock,
  Lock,
  Shield,
  Layers,
  AlertCircle,
  Video,
  Play,
  Trash2,
  Calendar,
  Users,
} from 'lucide-react';
import { CourseItem, CourseDeliveryFormat } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ui/image-uploader';
import { detectMeetingPlatform } from '@/lib/courses/cohort-helpers';
import { ClassSchedulePicker } from './class-schedule-picker';
import { LearningObjectivesEditor } from './learning-objectives-editor';
import { CourseRequirementsEditor } from './course-requirements-editor';

interface CourseSettingsModalProps {
  circleId: string;
  course: CourseItem;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedCourse: CourseItem) => void;
  onDeleted?: () => void;
}

export function CourseSettingsModal({
  circleId,
  course,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
}: CourseSettingsModalProps) {
  const [title, setTitle] = useState(course.title);
  const [slug, setSlug] = useState(course.slug);
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [description, setDescription] = useState(course.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url || '');
  const [courseFormat, setCourseFormat] = useState<CourseDeliveryFormat>(
    course.course_format || 'video_on_demand'
  );
  const [cohortMeetingUrl, setCohortMeetingUrl] = useState(
    course.cohort_meeting_url || ''
  );
  const [cohortScheduleDescription, setCohortScheduleDescription] = useState(
    course.cohort_schedule_description || ''
  );
  const [cohortStartDate, setCohortStartDate] = useState(
    course.cohort_start_date ? course.cohort_start_date.slice(0, 16) : ''
  );
  const [cohortEndDate, setCohortEndDate] = useState(
    course.cohort_end_date ? course.cohort_end_date.slice(0, 16) : ''
  );
  const [maxSeats, setMaxSeats] = useState(
    course.max_seats ? String(course.max_seats) : ''
  );
  const [challengeDurationDays, setChallengeDurationDays] = useState(
    course.challenge_duration_days ? String(course.challenge_duration_days) : '30'
  );
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'all_levels'
  >(course.difficulty_level || 'all_levels');
  const [durationHours, setDurationHours] = useState(
    course.estimated_duration_hours ? String(course.estimated_duration_hours) : '2.5'
  );
  const [accessRule, setAccessRule] = useState<
    'open' | 'members_only' | 'paywall' | 'min_level' | 'staff_only'
  >(course.access_rule || 'open');
  const [minLevelRequired, setMinLevelRequired] = useState(
    course.min_level_required ?? 2
  );
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    course.status || 'published'
  );
  const [learningObjectives, setLearningObjectives] = useState<string[]>(
    course.learning_objectives || []
  );
  const [requirements, setRequirements] = useState<string[]>(
    course.requirements || []
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteCourse() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete course.');
      onDeleted?.();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete course.');
      setIsDeleting(false);
    }
  }

  const detectedPlatform = detectMeetingPlatform(cohortMeetingUrl);

  // Sync state when course prop updates
  useEffect(() => {
    setTitle(course.title);
    setSlug(course.slug);
    setIsSlugManual(false);
    setDescription(course.description || '');
    setThumbnailUrl(course.thumbnail_url || '');
    setCourseFormat(course.course_format || 'video_on_demand');
    setCohortMeetingUrl(course.cohort_meeting_url || '');
    setCohortScheduleDescription(course.cohort_schedule_description || '');
    setCohortStartDate(course.cohort_start_date ? course.cohort_start_date.slice(0, 16) : '');
    setCohortEndDate(course.cohort_end_date ? course.cohort_end_date.slice(0, 16) : '');
    setMaxSeats(course.max_seats ? String(course.max_seats) : '');
    setChallengeDurationDays(
      course.challenge_duration_days ? String(course.challenge_duration_days) : '30'
    );
    setDifficulty(course.difficulty_level || 'all_levels');
    setDurationHours(
      course.estimated_duration_hours ? String(course.estimated_duration_hours) : '2.5'
    );
    setAccessRule(course.access_rule || 'open');
    setMinLevelRequired(course.min_level_required ?? 2);
    setStatus(course.status || 'published');
    setLearningObjectives(course.learning_objectives || []);
    setRequirements(course.requirements || []);
    setError(null);
  }, [course]);

  if (!isOpen) return null;

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isSlugManual) {
      const autoSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/g, '');
      setSlug(autoSlug);
    }
  };

  const handleSlugChange = (newSlug: string) => {
    setIsSlugManual(true);
    setSlug(
      newSlug
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+/g, '')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    const cleanSlug = slug.trim().replace(/-+$/g, '');

    if (!cleanTitle || cleanTitle.length < 3) {
      setError('Course title must be at least 3 characters long.');
      return;
    }

    if (!cleanSlug || cleanSlug.length < 2) {
      setError('Course slug must be at least 2 characters long.');
      return;
    }

    const parsedDuration = parseFloat(durationHours);
    if (isNaN(parsedDuration) || parsedDuration < 0) {
      setError('Please provide a valid estimated duration in hours.');
      return;
    }

    const cleanObjectives = learningObjectives.map((s) => s.trim()).filter(Boolean);
    if (cleanObjectives.length === 0) {
      setError('Please provide at least one learning outcome ("What You\'ll Learn").');
      return;
    }

    const cleanRequirements = requirements.map((s) => s.trim()).filter(Boolean);
    if (cleanRequirements.length === 0) {
      setError('Please provide at least one course requirement or prerequisite.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: cleanTitle,
        slug: cleanSlug,
        description: description.trim(),
        thumbnailUrl: thumbnailUrl.trim() || null,
        difficultyLevel: difficulty,
        estimatedDurationHours: parsedDuration,
        courseFormat,
        cohortMeetingUrl: courseFormat === 'live_cohort' && cohortMeetingUrl.trim() ? cohortMeetingUrl.trim() : null,
        cohortScheduleDescription: courseFormat === 'live_cohort' && cohortScheduleDescription.trim() ? cohortScheduleDescription.trim() : null,
        cohortStartDate: courseFormat === 'live_cohort' && cohortStartDate ? new Date(cohortStartDate).toISOString() : null,
        cohortEndDate: courseFormat === 'live_cohort' && cohortEndDate ? new Date(cohortEndDate).toISOString() : null,
        maxSeats: courseFormat === 'live_cohort' && maxSeats ? parseInt(maxSeats, 10) : null,
        challengeDurationDays: courseFormat === 'action_challenge' ? parseInt(challengeDurationDays, 10) || 30 : null,
        accessRule,
        minLevelRequired: accessRule === 'min_level' ? Number(minLevelRequired) : 1,
        status,
        learningObjectives: cleanObjectives,
        requirements: cleanRequirements,
      };

      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update course settings.');
      }

      onSaved(data.course);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-settings-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-800">
              <Layers className="h-5 w-5" />
            </span>
            <div>
              <h3 id="course-settings-title" className="text-base font-bold text-stone-900">
                Edit Course Settings
              </h3>
              <p className="text-xs text-stone-500">
                Configure curriculum title, slug, thumbnail, access rules, and status.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-200 bg-stone-50 p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-stone-800">
                Course Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Fullstack Web Architecture"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-800">
                URL Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="fullstack-web-architecture"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs font-mono text-stone-900 focus:border-stone-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-stone-800">Overview Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will learners achieve in this curriculum? Include syllabus goals, target audience, and outcomes..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 p-3 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden resize-y"
            />
          </div>

          {/* Thumbnail Image */}
          <div>
            <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5 mb-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-stone-500" />
              <span>Cover Image / Thumbnail</span>
            </label>
            <ImageUploader
              circleId={circleId}
              value={thumbnailUrl}
              onChange={(val) => setThumbnailUrl(val as string)}
              multiple={false}
              aspectRatio="video"
              label="Upload Course Cover"
              helperText="16:9 banner or cover image (JPEG, PNG, WebP up to 10MB)"
            />
          </div>

          {/* Delivery Format */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-stone-900 block">Course Delivery Format</label>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Defines the learning style and landing page presentation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCourseFormat('video_on_demand')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  courseFormat === 'video_on_demand'
                    ? 'border-black bg-white ring-2 ring-black/10 font-bold shadow-xs'
                    : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Play className="h-4 w-4 text-stone-900" />
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-700">
                    Self-Paced
                  </span>
                </div>
                <div className="mt-2 text-xs text-stone-900 font-bold">Video on Demand</div>
                <div className="text-[11px] text-stone-500 mt-0.5">Pre-recorded lessons at learner pace</div>
              </button>

              <button
                type="button"
                onClick={() => setCourseFormat('live_cohort')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  courseFormat === 'live_cohort'
                    ? 'border-blue-700 bg-blue-50/50 ring-2 ring-blue-500/20 font-bold shadow-xs'
                    : 'border-stone-200 bg-white hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Video className="h-4 w-4 text-blue-700" />
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                    🔴 Live Workshops
                  </span>
                </div>
                <div className="mt-2 text-xs text-stone-900 font-bold">Live Cohort</div>
                <div className="text-[11px] text-stone-500 mt-0.5">Live video room, schedule & replays</div>
              </button>
            </div>

            {/* Live Cohort meeting details */}
            {courseFormat === 'live_cohort' && (
              <div className="rounded-xl border border-blue-200 bg-white p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-blue-700" />
                    <span>Live Classroom Link & Schedule</span>
                  </span>
                  {detectedPlatform.platform !== 'custom' && (
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${detectedPlatform.badgeBg} ${detectedPlatform.badgeText}`}>
                      {detectedPlatform.name}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-700 block">
                    Live Classroom URL (Zoom / Meet / Teams)
                  </label>
                  <input
                    type="url"
                    value={cohortMeetingUrl}
                    onChange={(e) => setCohortMeetingUrl(e.target.value)}
                    placeholder={detectedPlatform.defaultPlaceholder}
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>

                <ClassSchedulePicker
                  value={cohortScheduleDescription}
                  onChange={setCohortScheduleDescription}
                  label="Class Schedule & Weekly Days"
                  helperText="Select the days of the week when live workshops take place."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-stone-500" />
                      <span>Cohort Start Date & Time</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={cohortStartDate}
                      onChange={(e) => setCohortStartDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-stone-500" />
                      <span>Cohort End Date & Time</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={cohortEndDate}
                      onChange={(e) => setCohortEndDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-stone-500" />
                    <span>Maximum Seat Capacity (Cohort Size Limit)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    placeholder="e.g. 25 (leave empty for unlimited)"
                    value={maxSeats}
                    onChange={(e) => setMaxSeats(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-stone-500">
                    Once all spots are filled, the enrollment card will show &quot;Sold Out&quot; and close further signups.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Difficulty & Estimated Hours & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-stone-800">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(
                    e.target.value as 'beginner' | 'intermediate' | 'advanced' | 'all_levels'
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
              >
                <option value="all_levels">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1">
                <Clock className="h-3 w-3 text-stone-500" />
                <span>Est. Hours</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="1000"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-800">Publication Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'draft' | 'published' | 'archived')
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
              >
                <option value="published">Published (Visible)</option>
                <option value="draft">Draft (Staff Only)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Access Rule & Gating */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 space-y-3">
            <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-stone-600" />
              <span>Enrollment & Access Rules</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={accessRule}
                  onChange={(e) =>
                    setAccessRule(
                      e.target.value as 'open' | 'members_only' | 'paywall' | 'min_level' | 'staff_only'
                    )
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                >
                  <option value="open">Open (Anyone in circle can view)</option>
                  <option value="members_only">Members Only (Requires circle membership)</option>
                  <option value="paywall">Behind a Paywall (Paid course access pass)</option>
                  <option value="min_level">Level Gated (Requires minimum community XP level)</option>
                  <option value="staff_only">Staff Only (Private testing & review)</option>
                </select>
              </div>

              {accessRule === 'min_level' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-700 whitespace-nowrap">
                    Min Level:
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={minLevelRequired}
                    onChange={(e) => setMinLevelRequired(parseInt(e.target.value, 10) || 1)}
                    className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-stone-500 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    XP Gated
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* What You'll Learn (Learning Objectives) */}
          <LearningObjectivesEditor
            value={learningObjectives}
            onChange={setLearningObjectives}
            courseTitle={title}
            disabled={saving || isDeleting}
          />

          {/* Course Requirements & Prerequisites */}
          <CourseRequirementsEditor
            value={requirements}
            onChange={setRequirements}
            disabled={saving || isDeleting}
          />

          {/* Danger Zone: Delete Course */}
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-900 flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  <span>Danger Zone</span>
                </h4>
                <p className="text-[11px] text-red-700 mt-0.5">
                  Permanently delete this course, including all modules, lessons, student enrollments, quizzes, and reviews.
                </p>
              </div>

              {!showDeleteConfirm && (
                <Button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || isDeleting}
                  className="shrink-0 bg-red-600 text-white hover:bg-red-700 text-xs px-3.5 py-1.5 rounded-xl font-bold shadow-xs transition-colors"
                >
                  Delete Course
                </Button>
              )}
            </div>

            {deleteError && (
              <div className="rounded-xl border border-red-300 bg-red-100/90 p-2.5 text-xs text-red-800">
                {deleteError}
              </div>
            )}

            {showDeleteConfirm && (
              <div className="rounded-xl border border-red-200 bg-white p-3.5 space-y-2.5 shadow-2xs">
                <p className="text-xs font-bold text-stone-900">
                  Are you sure you want to permanently delete <span className="underline decoration-red-400 font-extrabold">{course.title}</span>?
                </p>
                <p className="text-[11px] text-stone-500">
                  This action is irreversible. All student progress and learning materials will be immediately removed.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeleting}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-xs rounded-xl h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteCourse}
                    className="bg-red-600 text-white hover:bg-red-700 text-xs rounded-xl font-bold px-3.5 h-8 transition-colors"
                  >
                    {isDeleting ? 'Deleting Course...' : 'Yes, Permanently Delete'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-stone-900 px-5 text-xs font-semibold text-white hover:bg-black transition-colors shadow-xs"
            >
              {saving ? (
                <span>Saving...</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  Save Course Changes
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
