'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Plus,
  Play,
  Clock,
  BookOpen,
  Search,
  Trophy,
  Lock,
  Shield,
  X,
  Compass,
  Settings,
  CheckCircle2,
  ArrowRight,
  Video,
} from 'lucide-react';
import { CourseItem, CourseDeliveryFormat, LeaderboardEntry, MemberXpSummary } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ui/image-uploader';
import { LearningPathsView } from './learning-paths-view';
import { CourseSettingsModal } from './course-settings-modal';
import { detectMeetingPlatform } from '@/lib/courses/cohort-helpers';
import { ClassSchedulePicker, ClassScheduleDaysStrip } from './class-schedule-picker';

export function CoursesCatalog({
  circleId,
  circleSlug,
  initialCourses,
  isMember,
  isStaff,
}: {
  circleId: string;
  circleSlug: string;
  initialCourses: CourseItem[];
  isMember: boolean;
  isStaff: boolean;
}) {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [mainTab, setMainTab] = useState<'courses' | 'paths'>('courses');
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);

  // Gamification state
  const [xpSummary, setXpSummary] = useState<MemberXpSummary | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Form states
  const [courseFormat, setCourseFormat] = useState<CourseDeliveryFormat>('video_on_demand');
  const [cohortMeetingUrl, setCohortMeetingUrl] = useState('');
  const [cohortScheduleDescription, setCohortScheduleDescription] = useState('');
  const [challengeDurationDays, setChallengeDurationDays] = useState('30');
  const [pacingFormat, setPacingFormat] = useState<'self_paced' | 'structured' | 'scheduled'>('self_paced');
  const [scheduleType, setScheduleType] = useState<'relative_drip' | 'calendar_date'>('relative_drip');
  const [cohortStartDate, setCohortStartDate] = useState('');
  const [cohortEndDate, setCohortEndDate] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'all_levels'
  >('all_levels');
  const [durationHours, setDurationHours] = useState('2.5');
  const [accessRule, setAccessRule] = useState<
    'open' | 'members_only' | 'min_level' | 'staff_only'
  >('open');
  const [minLevelRequired, setMinLevelRequired] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedPlatform = detectMeetingPlatform(cohortMeetingUrl);

  useEffect(() => {
    if (!isMember) return;
    async function loadXp() {
      try {
        const res = await fetch(`/api/circles/${circleId}/courses?mode=xp_summary`);
        const data = await res.json();
        if (res.ok && data.summary) {
          setXpSummary(data.summary);
        }
      } catch {
        // silent fail
      }
    }
    loadXp();
  }, [circleId, isMember]);

  async function fetchLeaderboard() {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses?mode=leaderboard`);
      const data = await res.json();
      if (res.ok && data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    } catch {
      // silent fail
    } finally {
      setLoadingLeaderboard(false);
    }
  }

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!isSlugManual) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      );
    }
  }

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cleanSlug = (slug.trim() || title.trim())
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || `course-${Date.now().toString(36)}`;

      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: cleanSlug,
          description,
          thumbnailUrl: thumbnailUrl.trim() || null,
          difficultyLevel: difficulty,
          estimatedDurationHours: parseFloat(durationHours) || 0,
          courseFormat,
          cohortMeetingUrl: courseFormat === 'live_cohort' && cohortMeetingUrl.trim() ? cohortMeetingUrl.trim() : null,
          cohortScheduleDescription: courseFormat === 'live_cohort' && cohortScheduleDescription.trim() ? cohortScheduleDescription.trim() : null,
          challengeDurationDays: courseFormat === 'action_challenge' ? parseInt(challengeDurationDays, 10) || 30 : null,
          pacingFormat,
          scheduleType: pacingFormat === 'scheduled' ? scheduleType : 'relative_drip',
          cohortStartDate:
            pacingFormat === 'scheduled' && scheduleType === 'calendar_date' && cohortStartDate
              ? new Date(cohortStartDate).toISOString()
              : null,
          cohortEndDate:
            pacingFormat === 'scheduled' && scheduleType === 'calendar_date' && cohortEndDate
              ? new Date(cohortEndDate).toISOString()
              : null,
          requireSequentialCompletion: pacingFormat === 'structured',
          accessRule,
          minLevelRequired: accessRule === 'min_level' ? Number(minLevelRequired) : 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create course.');

      setCourses((prev) => [data.course, ...prev]);
      setTitle('');
      setSlug('');
      setIsSlugManual(false);
      setDescription('');
      setThumbnailUrl('');
      setCourseFormat('video_on_demand');
      setCohortMeetingUrl('');
      setCohortScheduleDescription('');
      setChallengeDurationDays('30');
      setPacingFormat('self_paced');
      setScheduleType('relative_drip');
      setCohortStartDate('');
      setCohortEndDate('');
      setAccessRule('open');
      setMinLevelRequired(2);
      setShowCreate(false);

      // Immediately navigate instructor into the Circle Course Studio
      router.push(`/circles/${circleSlug}/courses/${data.course.id}/studio`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create course.');
    } finally {
      setLoading(false);
    }
  }

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchesDiff =
      difficultyFilter === 'all' || c.difficulty_level === difficultyFilter;
    return matchesSearch && matchesDiff;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">Courses & Curriculum</h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-900 border border-stone-200">
              {courses.length} {courses.length === 1 ? 'COURSE' : 'COURSES'}
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Step-by-step video courses, curriculum modules, and verified student progress tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {xpSummary && (
            <div className="flex items-center gap-3 rounded-xl border border-stone-200/90 bg-stone-50/80 px-3 py-1.5 shadow-2xs">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white font-bold text-xs">
                L{xpSummary.current_level}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900">
                  <span>Level {xpSummary.current_level}</span>
                  <span className="text-[10px] text-stone-500 font-mono">({xpSummary.total_xp} XP)</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className="h-full bg-black transition-all duration-300"
                      style={{ width: `${xpSummary.level_progress_percentage}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-stone-400">
                    {xpSummary.level_progress_percentage}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLeaderboard(true);
                  fetchLeaderboard();
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 transition-colors"
                title="View Community Leaderboard"
              >
                <Trophy className="h-3 w-3 text-stone-500" />
                <span>Ranks</span>
              </button>
            </div>
          )}

          <Link
            href={`/circles/${circleSlug}/resources`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5 text-stone-500" />
            Guides & Docs
          </Link>

          {(isStaff || isMember) && (
            <Button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Course
            </Button>
          )}
        </div>
      </div>

      {/* Main LMS Tab Navigation: Courses vs Learning Paths */}
      <div className="flex items-center gap-6 border-b border-stone-200 pb-1">
        <button
          type="button"
          onClick={() => setMainTab('courses')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-colors ${
            mainTab === 'courses'
              ? 'border-black text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          <span>Individual Courses ({courses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('paths')}
          className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-colors ${
            mainTab === 'paths'
              ? 'border-black text-stone-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>Learning Paths & Programmes</span>
        </button>
      </div>

      {mainTab === 'paths' ? (
        <LearningPathsView
          circleId={circleId}
          circleSlug={circleSlug}
          isMember={isMember}
          isStaff={isStaff}
          availableCourses={courses}
        />
      ) : (
        <>
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-stone-200/90 bg-white pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficultyFilter(level)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    difficultyFilter === level
                      ? 'bg-black text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                  }`}
                >
                  {level === 'all' ? 'All Levels' : level}
                </button>
              ))}
            </div>
          </div>

          {/* Course Cards Grid */}
          {filteredCourses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-12 text-center">
              <GraduationCap className="mx-auto h-9 w-9 text-stone-400" />
              <h3 className="mt-3 text-sm font-semibold text-stone-900">No courses found</h3>
              <p className="mt-1 text-xs text-stone-500">
                {search
                  ? 'Try modifying your search or filter criteria.'
                  : 'Start your academy by publishing your first structured course.'}
              </p>
              {(isStaff || isMember) && (
                <Button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 inline-flex items-center gap-1.5 bg-black text-white text-xs px-3 py-1.5 rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create First Course
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course) => {
                const hasStarted = (course.completed_lessons_count ?? 0) > 0;
                const progress = course.progress_percentage ?? 0;
                const totalLessons = course.total_lessons_count ?? 0;
                const isLevelLocked =
                  course.access_rule === 'min_level' &&
                  !isStaff &&
                  Boolean(
                    xpSummary &&
                      xpSummary.current_level < (course.min_level_required || 1)
                  );

                return (
                  <div
                    key={course.id}
                    className="group flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs hover:border-stone-400/80 hover:shadow-sm transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-stone-700 border border-stone-200/60">
                            {course.difficulty_level?.replace('_', ' ') || 'All Levels'}
                          </span>
                          {course.course_format === 'live_cohort' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-mono font-bold text-blue-700 border border-blue-200 shadow-2xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                              Live Cohort
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-800 border border-stone-200">
                              <Play className="h-2.5 w-2.5 fill-current" />
                              On-Demand
                            </span>
                          )}
                          <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600 border border-stone-200/60">
                            v{course.published_version || 1}
                          </span>
                          {course.access_rule === 'min_level' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-700 border border-stone-200/60">
                              <Lock className="h-2.5 w-2.5" />
                              Lvl {course.min_level_required}+
                            </span>
                          )}
                          {course.access_rule === 'staff_only' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-800 border border-amber-200">
                              <Shield className="h-2.5 w-2.5" />
                              Staff
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {course.estimated_duration_hours > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-stone-500">
                              <Clock className="h-3 w-3 text-stone-400" />
                              {course.estimated_duration_hours}h
                            </span>
                          )}
                          {isStaff && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingCourse(course);
                              }}
                              className="rounded-lg border border-stone-200 bg-white p-1 text-stone-400 hover:text-stone-900 hover:border-stone-400 transition-colors shadow-2xs"
                              title="Edit Course Settings"
                              aria-label={`Edit settings for ${course.title}`}
                            >
                              <Settings className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {course.thumbnail_url && (
                        <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-xl bg-stone-100 border border-stone-200/70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={course.thumbnail_url}
                            alt={course.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <h3 className="mt-3 text-base font-bold text-stone-900 group-hover:text-black line-clamp-1">
                        {course.title}
                      </h3>

                      <p className="mt-1.5 text-xs text-stone-500 line-clamp-2 leading-relaxed">
                        {course.description || 'No description provided.'}
                      </p>

                      {course.course_format === 'live_cohort' && course.cohort_schedule_description && (
                        <div className="mt-2.5 space-y-1.5 rounded-xl bg-blue-50/80 border border-blue-100 p-2 text-[11px] font-medium text-blue-900">
                          <div className="flex items-center gap-1.5">
                            <Video className="h-3 w-3 text-blue-600 shrink-0" />
                            <span className="truncate">{course.cohort_schedule_description}</span>
                          </div>
                          <ClassScheduleDaysStrip scheduleDescription={course.cohort_schedule_description} />
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t border-stone-100 pt-4">
                      {/* Progress bar if student has progress */}
                      {hasStarted ? (
                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-center justify-between text-[11px] font-medium">
                            <span className="text-stone-500">
                              {course.completed_lessons_count} of {totalLessons} lessons completed
                            </span>
                            <span className="font-mono text-stone-900 font-bold">{progress}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                            <div
                              className="h-full bg-black transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-3">
                          <BookOpen className="h-3.5 w-3.5 text-stone-400" />
                          <span>{totalLessons} lessons in curriculum</span>
                        </div>
                      )}

                      {isLevelLocked ? (
                        <Link
                          href={`/circles/${circleSlug}/courses/${course.id}`}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors"
                        >
                          <Lock className="h-3.5 w-3.5 text-stone-400" />
                          <span>Locked (Requires Level {course.min_level_required})</span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/circles/${circleSlug}/courses/${course.id}`}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-black transition-colors"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            {hasStarted ? 'Continue Learning' : 'Start Course'}
                          </Link>
                          {isStaff && (
                            <Link
                              href={`/circles/${circleSlug}/courses/${course.id}/studio`}
                              className="inline-flex items-center justify-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:border-black transition-colors shadow-2xs"
                              title="Open Circle Course Studio"
                            >
                              Studio
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Course Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="absolute top-5 right-5 rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-8">
              <h3 className="text-lg font-bold text-stone-900">Create New Course</h3>
              <p className="mt-1 text-xs text-stone-500">
                First, select your course pacing format, then configure its details. You can build out lessons, quizzes, and paywalls inside the Studio.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="mt-5 space-y-5">
              {/* Step 1: Course Delivery Format */}
              <div className="rounded-xl border border-stone-200/90 bg-stone-50/50 p-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-900">
                    Step 1: Choose Course Format <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] font-medium text-stone-500">Tailors student experience</span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  Select how this course will be delivered to your community:
                </p>

                <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {/* Format 1: Video on Demand */}
                  <button
                    type="button"
                    onClick={() => {
                      setCourseFormat('video_on_demand');
                      setPacingFormat('self_paced');
                    }}
                    className={`relative flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                      courseFormat === 'video_on_demand'
                        ? 'border-black bg-white shadow-xs ring-2 ring-black/10'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/60'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          courseFormat === 'video_on_demand'
                            ? 'bg-black text-white'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        <Play className="h-4 w-4" />
                      </div>
                      {courseFormat === 'video_on_demand' ? (
                        <CheckCircle2 className="h-4 w-4 text-stone-900" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-stone-300" />
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-stone-900">Video on Demand</h4>
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700">
                          Self-Paced
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                        Pre-recorded video lectures and modular lessons. Learners watch and progress on their own schedule.
                      </p>
                    </div>
                  </button>

                  {/* Format 2: Live Cohort */}
                  <button
                    type="button"
                    onClick={() => {
                      setCourseFormat('live_cohort');
                      setPacingFormat('scheduled');
                      setScheduleType('calendar_date');
                    }}
                    className={`relative flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                      courseFormat === 'live_cohort'
                        ? 'border-blue-700 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/20'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/60'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          courseFormat === 'live_cohort'
                            ? 'bg-blue-700 text-white'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        <Video className="h-4 w-4" />
                      </div>
                      {courseFormat === 'live_cohort' ? (
                        <CheckCircle2 className="h-4 w-4 text-blue-700" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-stone-300" />
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-stone-900">Live Cohort</h4>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                          🔴 Live Workshops
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                        Scheduled live video sessions (Zoom, Google Meet, Teams), cohort calendar dates, and live classroom access.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Live Cohort Configuration */}
                {courseFormat === 'live_cohort' && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                          <Video className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900">Live Cohort Classroom & Schedule</h4>
                          <p className="text-[11px] text-stone-500">Configure meeting link, schedule, and cohort calendar.</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {detectedPlatform.platform !== 'custom' && (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${detectedPlatform.badgeBg} ${detectedPlatform.badgeText}`}>
                            {detectedPlatform.name}
                          </span>
                        )}
                        <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          Auto-Recorded Replays
                        </span>
                      </div>
                    </div>

                    {/* Platform Selector Buttons */}
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1.5">
                        Choose Live Video Platform:
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { id: 'zoom', label: 'Zoom', prefix: 'https://zoom.us/j/' },
                          { id: 'meet', label: 'Google Meet', prefix: 'https://meet.google.com/' },
                          { id: 'teams', label: 'MS Teams', prefix: 'https://teams.microsoft.com/l/meetup-join/' },
                          { id: 'custom', label: 'Custom Video Link', prefix: '' },
                        ].map((plat) => {
                          const isSelected =
                            plat.id === 'custom'
                              ? !cohortMeetingUrl.includes('zoom.us') && !cohortMeetingUrl.includes('meet.google.com') && !cohortMeetingUrl.includes('teams.microsoft.com')
                              : cohortMeetingUrl.toLowerCase().includes(plat.id === 'meet' ? 'meet.google' : plat.id);
                          return (
                            <button
                              key={plat.id}
                              type="button"
                              onClick={() => {
                                if (plat.prefix && (!cohortMeetingUrl || !cohortMeetingUrl.startsWith('http'))) {
                                  setCohortMeetingUrl(plat.prefix);
                                }
                              }}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                                  : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                              }`}
                            >
                              {plat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Meeting Link URL */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-semibold text-stone-700">
                          Live Video Classroom URL <span className="text-red-500">*</span>
                        </label>
                        {cohortMeetingUrl && (
                          <span className="text-[10px] text-stone-400 font-mono">
                            {detectedPlatform.name}
                          </span>
                        )}
                      </div>
                      <input
                        type="url"
                        placeholder={detectedPlatform.defaultPlaceholder}
                        value={cohortMeetingUrl}
                        onChange={(e) => setCohortMeetingUrl(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                      />
                      <p className="mt-1 text-[10px] text-stone-500">
                        Enrolled students will see a direct &ldquo;Join Live Video Room&rdquo; button.
                      </p>
                    </div>

                    {/* Interactive Days of the Week & Schedule Picker */}
                    <ClassSchedulePicker
                      value={cohortScheduleDescription}
                      onChange={setCohortScheduleDescription}
                      label="Class Days & Weekly Schedule"
                      helperText="Click the day boxes to select when the live class meets each week."
                    />

                    {/* Cohort Dates & Timezone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-stone-100 pt-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700">
                          Cohort Start Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={cohortStartDate}
                          onChange={(e) => setCohortStartDate(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700">
                          Cohort End Date & Graduation
                        </label>
                        <input
                          type="datetime-local"
                          value={cohortEndDate}
                          onChange={(e) => setCohortEndDate(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Course Details */}
              <div className="space-y-3.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-900">
                  Step 2: Course Details
                </label>

                {/* Course Thumbnail Upload */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Course Thumbnail / Cover Image
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

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Course Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Full-Stack Web Development Masterclass"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-stone-700">URL Slug *</label>
                    <span className="text-[10px] text-stone-500 font-mono">lowercase & dashes</span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. web-dev-masterclass"
                    value={slug}
                    onChange={(e) => {
                      const sanitized = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '-')
                        .replace(/-+/g, '-');
                      setSlug(sanitized);
                      setIsSlugManual(Boolean(sanitized.trim()));
                      setError(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 font-mono focus:border-stone-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] text-stone-500">
                    Accessible at /circles/{circleSlug}/courses/{slug || '...'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) =>
                        setDifficulty(
                          e.target.value as
                            | 'all_levels'
                            | 'beginner'
                            | 'intermediate'
                            | 'advanced'
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                    >
                      <option value="all_levels">All Levels</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Est. Duration (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">Access Gating</label>
                    <select
                      value={accessRule}
                      onChange={(e) =>
                        setAccessRule(
                          e.target.value as 'open' | 'members_only' | 'min_level' | 'staff_only'
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                    >
                      <option value="open">Open (All Visitors)</option>
                      <option value="members_only">Members Only</option>
                      <option value="min_level">Minimum Community Level</option>
                      <option value="staff_only">Staff Only</option>
                    </select>
                  </div>

                  {accessRule === 'min_level' ? (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700">
                        Required Level
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={minLevelRequired}
                        onChange={(e) => setMinLevelRequired(parseInt(e.target.value, 10) || 1)}
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center text-[11px] text-stone-400 pt-5">
                      No level requirement
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700">Overview / Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what students will learn in this course..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-stone-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {loading ? (
                    'Creating Course...'
                  ) : (
                    <>
                      <span>Create Course & Open Studio</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-stone-900">Student Leaderboard</h3>
              </div>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-stone-500">
              Top students ranked by earned XP through lesson completions, assignments, and contributions.
            </p>

            <div className="mt-4 max-h-80 overflow-y-auto divide-y divide-stone-100">
              {loadingLeaderboard ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Loading rankings...
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  No students on the leaderboard yet. Complete a lesson to earn XP!
                </div>
              ) : (
                leaderboard.map((entry) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center justify-between py-2.5 px-1"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-xs font-bold font-mono text-stone-500">
                        {entry.rank === 1
                          ? '🥇'
                          : entry.rank === 2
                          ? '🥈'
                          : entry.rank === 3
                          ? '🥉'
                          : `#${entry.rank}`}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-stone-900">
                            {entry.display_name}
                          </span>
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.2 text-[9px] font-mono font-bold text-stone-700 border border-stone-200">
                            Lvl {entry.current_level}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-mono">
                          @{entry.username}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold font-mono text-stone-900">
                        {entry.total_xp}
                      </span>
                      <span className="ml-1 text-[10px] text-stone-400">XP</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-stone-100 pt-3 text-right">
              <Button
                variant="outline"
                onClick={() => setShowLeaderboard(false)}
                className="rounded-lg text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Course Settings Modal */}
      {editingCourse && (
        <CourseSettingsModal
          circleId={circleId}
          course={editingCourse}
          isOpen={Boolean(editingCourse)}
          onClose={() => setEditingCourse(null)}
          onSaved={(updated) => {
            setCourses((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            );
          }}
        />
      )}
    </div>
  );
}
