'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Play,
  Check,
  CheckCircle2,
  Clock,
  BookOpen,
  Users,
  Award,
  Smartphone,
  Share2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Lock,
  Eye,
  FileText,
  Sparkles,
  Star,
  Calendar,
  GraduationCap,
  Layers,
  FolderDown,
  Globe,
  X,
  CreditCard,
  Settings,
  Video,
  Target,
  ExternalLink,
} from 'lucide-react';
import {
  CourseItem,
  CourseLessonItem,
  CoursePaywallPlan,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { formatBachsAmount } from '@/lib/payments/currencies';

export interface CourseLandingViewProps {
  circleId: string;
  circleSlug: string;
  course: CourseItem;
  isMember: boolean;
  isStaff: boolean;
  onStartLearning: (initialLessonId?: string) => void;
  onOpenCheckout?: (plan?: CoursePaywallPlan) => void;
  onOpenSettings?: () => void;
  onCourseUpdated?: (course: CourseItem) => void;
}

function getDifficultyLabel(level?: string | null): string {
  switch (level) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
    case 'all_levels':
    default:
      return 'All Levels';
  }
}

export function CourseLandingView({
  circleId: _circleId,
  circleSlug,
  course,
  isMember,
  isStaff,
  onStartLearning,
  onOpenCheckout,
  onOpenSettings,
  onCourseUpdated,
}: CourseLandingViewProps) {
  // Curriculum Accordion State: all section IDs expanded by default
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    course.modules?.forEach((m, idx) => {
      // Expand first 3 sections by default
      init[m.id] = idx < 3;
    });
    return init;
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Review submission state
  const [selectedRating, setSelectedRating] = useState<number>(course.user_review?.rating || 5);
  const [reviewText, setReviewText] = useState<string>(course.user_review?.review_text || '');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  // Flatten all lessons
  const allLessons = useMemo(() => {
    const list: CourseLessonItem[] = [];
    course.modules?.forEach((m) => {
      m.lessons?.forEach((l) => list.push(l));
    });
    return list;
  }, [course.modules]);

  const totalLessons = allLessons.length;
  const totalDurationMinutes = useMemo(() => {
    return allLessons.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
  }, [allLessons]);

  const totalDurationHours =
    course.estimated_duration_hours ||
    Math.max(1, Math.round(totalDurationMinutes / 60));

  const totalSections = course.modules?.length || 0;
  const completedLessons = course.completed_lessons_count || 0;
  const progressPercent = course.progress_percentage || (totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0);
  const isEnrolled = Boolean(course.is_enrolled || completedLessons > 0);

  // First playable lesson
  const firstPlayableLesson = useMemo(() => {
    const uncompleted = allLessons.find((l) => !l.is_completed);
    return uncompleted || allLessons[0] || null;
  }, [allLessons]);

  // Teaser preview video lesson
  const previewLesson = useMemo(() => {
    return allLessons.find((l) => Boolean(l.is_free_preview && l.video_url)) ||
      allLessons.find((l) => Boolean(l.video_url)) || null;
  }, [allLessons]);

  // Pricing & Access details
  const isPaywalled = course.access_rule === 'paywall';
  const isLevelGated = course.viewer_can_access === false && course.access_rule !== 'paywall' && !isStaff;
  const hasAccess = isStaff || Boolean(course.has_paywall_access) || isEnrolled;
  const primaryPlan = course.paywall_plans?.[0] || null;

  // Learning Objectives (synthesize if not explicitly set)
  const learningObjectives = useMemo(() => {
    if (course.learning_objectives && course.learning_objectives.length > 0) {
      return course.learning_objectives;
    }
    // Synthesize structured objectives from course title & module topics
    const defaultList = [
      `Master end-to-end concepts and best practices in ${course.title}.`,
      'Build hands-on practical milestones through real-world projects and exercises.',
      'Understand core architectures, design patterns, and deployment strategies.',
      'Validate your understanding with comprehensive milestone assessments and quizzes.',
      'Gain production-ready confidence to apply these skills in professional workflows.',
      'Earn an official Certificate of Completion upon finishing all modules.',
    ];
    return defaultList;
  }, [course.learning_objectives, course.title]);

  const allSectionsExpanded = useMemo(() => {
    if (!course.modules || course.modules.length === 0) return false;
    return course.modules.every((m) => Boolean(expandedSections[m.id]));
  }, [course.modules, expandedSections]);

  function toggleAllSections() {
    if (!course.modules) return;
    const nextState = !allSectionsExpanded;
    const updated: Record<string, boolean> = {};
    course.modules.forEach((m) => {
      updated[m.id] = nextState;
    });
    setExpandedSections(updated);
  }

  function toggleSection(id: string) {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleShare() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  async function handleSubmitReview() {
    setIsSubmittingReview(true);
    setReviewMsg(null);
    try {
      const res = await fetch(`/api/circles/${_circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_review',
          courseId: course.id,
          rating: selectedRating,
          reviewText: reviewText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit review.');
      setReviewMsg('Thank you! Your review has been saved.');
      if (onCourseUpdated && data.review) {
        const existing = (course.reviews || []).filter((r) => r.user_id !== data.review.user_id);
        const updated = [data.review, ...existing];
        const avg = Math.round((updated.reduce((s, r) => s + r.rating, 0) / updated.length) * 10) / 10;
        onCourseUpdated({
          ...course,
          average_rating: avg,
          ratings_count: updated.length,
          reviews: updated,
          user_review: data.review,
        });
      }
    } catch (err) {
      setReviewMsg(err instanceof Error ? err.message : 'Error submitting review');
    } finally {
      setIsSubmittingReview(false);
    }
  }

  function handleOpenPreview(videoUrl?: string | null) {
    const url = videoUrl || previewLesson?.video_url;
    if (url) {
      setPreviewVideoUrl(url);
      setShowPreviewModal(true);
    } else {
      onStartLearning();
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFCF9]">
      {/* ==================================================================== */}
      {/* 1. DARK HERO SECTION (Udemy / Coursera Signature Elevated Hero)     */}
      {/* ==================================================================== */}
      <section className="bg-stone-950 text-white border-b border-stone-800">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            {/* Left 8 Columns: Course Info */}
            <div className="lg:col-span-8 space-y-4">
              {/* Breadcrumb Navigation */}
              <nav className="flex items-center gap-2 text-xs text-stone-400 font-medium">
                <Link
                  href={`/circles/${circleSlug}/courses`}
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Courses
                </Link>
                <span>/</span>
                <span>{getDifficultyLabel(course.difficulty_level)}</span>
                <span>/</span>
                <span className="text-stone-300 font-bold truncate max-w-xs">{course.title}</span>
              </nav>

              {/* Title & Subtitle */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  {course.title}
                </h1>
                {course.description && (
                  <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-3xl">
                    {course.description.length > 220
                      ? `${course.description.slice(0, 220)}...`
                      : course.description}
                  </p>
                )}
              </div>

              {/* Badges, Rating & Meta Row */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs">
                {/* Delivery Format Badge */}
                {course.course_format === 'live_cohort' ? (
                  <div className="flex items-center gap-1.5 rounded-md bg-blue-500/20 border border-blue-400/40 px-2.5 py-1 text-blue-300 font-bold">
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    <span>LIVE COHORT</span>
                    {course.cohort_start_date && (
                      <span className="text-blue-300/80 font-normal">
                        · Starts {new Date(course.cohort_start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                ) : course.course_format === 'text_and_labs' ? (
                  <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-1 text-emerald-300 font-bold">
                    <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                    <span>TEXT & LABS</span>
                  </div>
                ) : course.course_format === 'action_challenge' ? (
                  <div className="flex items-center gap-1.5 rounded-md bg-purple-500/20 border border-purple-400/40 px-2.5 py-1 text-purple-300 font-bold">
                    <Target className="h-3.5 w-3.5 text-purple-400" />
                    <span>{course.challenge_duration_days || 30}-DAY ACTION SPRINT</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-400/30 px-2.5 py-1 text-amber-300 font-bold">
                    <Play className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span>ON-DEMAND VIDEO</span>
                  </div>
                )}

                {/* Real Rating Badge */}
                {course.ratings_count && course.ratings_count > 0 ? (
                  <div className="flex items-center gap-1.5 rounded-md bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 text-amber-300 font-bold">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span>{course.average_rating?.toFixed(1) || '0.0'}</span>
                    <span className="text-amber-400/70 font-normal">
                      ({course.ratings_count} {course.ratings_count === 1 ? 'rating' : 'ratings'})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-md bg-stone-900 border border-stone-800 px-2.5 py-1 text-stone-300 font-medium">
                    <Star className="h-3.5 w-3.5 text-stone-500" />
                    <span>Not yet rated</span>
                  </div>
                )}

                {/* Real Enrolled Students */}
                <div className="flex items-center gap-1 text-stone-300">
                  <Users className="h-3.5 w-3.5 text-stone-400" />
                  <span>
                    {(course.enrolled_students_count || 0).toLocaleString()}{' '}
                    {(course.enrolled_students_count || 0) === 1 ? 'student' : 'students'} enrolled
                  </span>
                </div>

                {/* Difficulty */}
                <div className="flex items-center gap-1 text-stone-300">
                  <GraduationCap className="h-3.5 w-3.5 text-stone-400" />
                  <span>{getDifficultyLabel(course.difficulty_level)}</span>
                </div>
              </div>

              {/* Instructor & Update Meta */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400 pt-1">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-stone-700 flex items-center justify-center font-bold text-white text-[10px] overflow-hidden">
                    {course.instructor?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.instructor.avatar_url}
                        alt={course.instructor.display_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      course.instructor?.display_name?.slice(0, 1).toUpperCase() || 'I'
                    )}
                  </div>
                  <span>
                    Created by{' '}
                    <span className="text-white font-semibold underline underline-offset-2">
                      {course.instructor?.display_name || 'Circle Instructor'}
                    </span>
                  </span>
                </div>

                {course.cohort_schedule_description && (
                  <div className="flex items-center gap-1 text-blue-300 font-medium">
                    <Clock className="h-3.5 w-3.5 text-blue-400" />
                    <span>{course.cohort_schedule_description}</span>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-stone-500" />
                  <span>
                    Last updated{' '}
                    {new Date(course.updated_at || course.created_at).toLocaleDateString([], {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-stone-500" />
                  <span>English [Auto]</span>
                </div>

                {isStaff && (
                  <div className="flex items-center gap-2 ml-auto">
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs text-stone-300 hover:text-white hover:border-stone-500 transition-colors"
                      >
                        <Settings className="h-3 w-3" />
                        <span>Settings</span>
                      </button>
                    )}
                    <Link
                      href={`/circles/${circleSlug}/courses/${course.id}/studio`}
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-stone-700 transition-colors"
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>Studio</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Right 4 Columns on Large Screens: Sticky Desktop Placeholder */}
            <div className="hidden lg:block lg:col-span-4" />
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. MAIN BODY CONTENT + STICKY SIDEBAR WRAPPER                        */}
      {/* ==================================================================== */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* ================================================================ */}
          {/* LEFT COLUMN: Objectives, Curriculum Accordion, Description       */}
          {/* ================================================================ */}
          <div className="lg:col-span-8 space-y-8">
            {/* -------------------------------------------------------------- */}
            {/* A. "WHAT YOU'LL LEARN" HIGHLIGHT BOX                           */}
            {/* -------------------------------------------------------------- */}
            <section className="rounded-2xl border border-stone-200/90 bg-stone-50/70 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-stone-900" />
                <h2 className="text-lg font-bold text-stone-900">What you&apos;ll learn</h2>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {learningObjectives.map((obj, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-700">
                    <Check className="h-4 w-4 shrink-0 text-black font-bold mt-0.5" />
                    <span className="leading-relaxed">{obj}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* -------------------------------------------------------------- */}
            {/* B. COURSE CONTENT / SYLLABUS ACCORDION                          */}
            {/* -------------------------------------------------------------- */}
            <section className="space-y-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Course content</h2>
                  <p className="text-xs text-stone-500 mt-0.5 font-medium">
                    {totalSections} {totalSections === 1 ? 'section' : 'sections'} • {totalLessons}{' '}
                    {totalLessons === 1 ? 'lecture' : 'lectures'} • {totalDurationHours}h total length
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleAllSections}
                  className="text-xs font-bold text-black hover:underline self-start sm:self-auto"
                >
                  {allSectionsExpanded ? 'Collapse all sections' : 'Expand all sections'}
                </button>
              </div>

              {/* Module Accordions */}
              <div className="rounded-2xl border border-stone-200/90 bg-white overflow-hidden shadow-xs divide-y divide-stone-200/70">
                {!course.modules || course.modules.length === 0 ? (
                  <div className="p-8 text-center text-xs text-stone-500">
                    <BookOpen className="mx-auto h-8 w-8 text-stone-300 mb-2" />
                    <span>Curriculum modules are being drafted for this course.</span>
                  </div>
                ) : (
                  course.modules.map((mod, idx) => {
                    const isExpanded = Boolean(expandedSections[mod.id]);
                    const modLessons = mod.lessons || [];
                    const modDuration = modLessons.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
                    const completedCount = modLessons.filter((l) => l.is_completed).length;

                    return (
                      <div key={mod.id} className="transition-colors">
                        {/* Section Header */}
                        <button
                          type="button"
                          onClick={() => toggleSection(mod.id)}
                          className="w-full flex items-center justify-between p-4 bg-stone-50/50 hover:bg-stone-100/60 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-stone-500 shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-stone-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-stone-900 truncate">
                                Section {idx + 1}: {mod.title}
                              </h3>
                              {mod.description && (
                                <p className="text-xs text-stone-500 truncate max-w-xl">
                                  {mod.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-stone-500 shrink-0 font-medium">
                            {hasAccess && completedCount > 0 && (
                              <span className="text-[11px] font-mono text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                                {completedCount}/{modLessons.length}
                              </span>
                            )}
                            <span>{modLessons.length} {modLessons.length === 1 ? 'lecture' : 'lectures'}</span>
                            {modDuration > 0 && <span>• {modDuration}m</span>}
                          </div>
                        </button>

                        {/* Section Lessons List */}
                        {isExpanded && (
                          <div className="divide-y divide-stone-100 bg-white">
                            {modLessons.length === 0 ? (
                              <div className="py-3 px-6 text-xs text-stone-400 italic">
                                No lectures published in this section yet.
                              </div>
                            ) : (
                              modLessons.map((lesson) => {
                                const isVideo = Boolean(lesson.video_url);
                                const isLocked = isPaywalled && !hasAccess && !lesson.is_free_preview;

                                return (
                                  <div
                                    key={lesson.id}
                                    className="flex items-center justify-between py-3 px-5 hover:bg-stone-50 transition-colors text-xs"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {lesson.is_completed ? (
                                        <CheckCircle2 className="h-4 w-4 text-stone-900 shrink-0" />
                                      ) : isLocked ? (
                                        <Lock className="h-4 w-4 text-stone-400 shrink-0" />
                                      ) : isVideo ? (
                                        <Play className="h-4 w-4 text-stone-700 shrink-0" />
                                      ) : (
                                        <FileText className="h-4 w-4 text-stone-700 shrink-0" />
                                      )}

                                      <span
                                        onClick={() => {
                                          if (!isLocked) onStartLearning(lesson.id);
                                        }}
                                        className={`font-medium truncate ${
                                          isLocked
                                            ? 'text-stone-400 cursor-not-allowed'
                                            : 'text-stone-900 hover:underline cursor-pointer'
                                        }`}
                                      >
                                        {lesson.title}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      {lesson.is_free_preview && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenPreview(lesson.video_url)}
                                          className="text-[11px] font-bold text-black underline hover:text-stone-700 flex items-center gap-1"
                                        >
                                          <Eye className="h-3 w-3" />
                                          <span>Preview</span>
                                        </button>
                                      )}

                                      {lesson.duration_minutes ? (
                                        <span className="text-stone-500 font-mono text-[11px]">
                                          {lesson.duration_minutes}:00
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* -------------------------------------------------------------- */}
            {/* C. REQUIREMENTS / PREREQUISITES                                */}
            {/* -------------------------------------------------------------- */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">Requirements</h2>
              <ul className="space-y-2 text-xs sm:text-sm text-stone-700">
                {course.prerequisites && course.prerequisites.length > 0 ? (
                  course.prerequisites.map((prereq, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-bold text-stone-400">•</span>
                      <span>{prereq.prerequisite_course_id ? 'Completed prerequisite foundational module' : 'Basic understanding of topic concepts'}</span>
                    </li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-stone-400">•</span>
                      <span>No prior programming or specialized knowledge required — suitable for all learners.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-stone-400">•</span>
                      <span>A web browser, desktop or mobile device to access lessons and interactive sandbox exercises.</span>
                    </li>
                  </>
                )}
              </ul>
            </section>

            {/* -------------------------------------------------------------- */}
            {/* D. COURSE DESCRIPTION                                          */}
            {/* -------------------------------------------------------------- */}
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-stone-900">Description</h2>
              <div className="relative">
                <div
                  className={`text-xs sm:text-sm text-stone-700 leading-relaxed space-y-3 ${
                    !descriptionExpanded && (course.description?.length || 0) > 400
                      ? 'max-h-48 overflow-hidden'
                      : ''
                  }`}
                >
                  <p>{course.description || 'Welcome to this comprehensive course in Circles. Follow along through each module step-by-step.'}</p>
                  <p>
                    Each lecture includes structured walkthroughs, practical code snippets, downloadable asset files, and interactive milestone quizzes to ensure mastery of real-world workflows.
                  </p>
                </div>

                {!descriptionExpanded && (course.description?.length || 0) > 400 && (
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#FDFCF9] to-transparent pointer-events-none" />
                )}
              </div>

              {(course.description?.length || 0) > 400 && (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                  className="text-xs font-bold text-black hover:underline flex items-center gap-1"
                >
                  <span>{descriptionExpanded ? 'Show less' : 'Show more'}</span>
                  {descriptionExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              )}
            </section>

            {/* -------------------------------------------------------------- */}
            {/* E. INSTRUCTOR BIO CARD                                          */}
            {/* -------------------------------------------------------------- */}
            <section className="space-y-3 border-t border-stone-200/80 pt-6">
              <h2 className="text-lg font-bold text-stone-900">Instructor</h2>
              <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-full bg-stone-900 flex items-center justify-center text-white font-extrabold text-xl overflow-hidden shrink-0 border border-stone-200 shadow-2xs">
                    {course.instructor?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.instructor.avatar_url}
                        alt={course.instructor.display_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      course.instructor?.display_name?.slice(0, 1).toUpperCase() || 'I'
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-base font-bold text-stone-900">
                      {course.instructor?.display_name || 'Circle Instructor'}
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">
                      Instructor & Curriculum Author · @{course.instructor?.username || 'instructor'}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 pt-1">
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>
                          {course.instructor_ratings_count && course.instructor_ratings_count > 0
                            ? `${course.instructor_average_rating?.toFixed(1)} Instructor Rating`
                            : 'Course Instructor'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="h-3.5 w-3.5 text-stone-500" />
                        <span>Certified Circles Author</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                  Passionate educator and practitioner creating structured learning experiences. Dedicated to providing clear explanations, production patterns, and continuous curriculum updates.
                </p>
              </div>
            </section>

            {/* -------------------------------------------------------------- */}
            {/* F. STUDENT FEEDBACK & REVIEWS                                  */}
            {/* -------------------------------------------------------------- */}
            <section className="space-y-6 border-t border-stone-200/80 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">Student Feedback & Reviews</h2>
                  <p className="text-xs text-stone-500">
                    Real reviews and ratings from verified enrolled learners.
                  </p>
                </div>
                {course.ratings_count && course.ratings_count > 0 ? (
                  <div className="flex items-center gap-2 bg-stone-100 rounded-xl px-3 py-1.5 border border-stone-200">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-base font-extrabold text-stone-900">
                      {course.average_rating?.toFixed(1)}
                    </span>
                    <span className="text-xs text-stone-500">
                      ({course.ratings_count} {course.ratings_count === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Review Submission Form for Enrolled or Active Members */}
              {(isEnrolled || isMember || isStaff) && (
                <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-stone-900">
                    {course.user_review ? 'Update your rating & review' : 'Leave a review for this course'}
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelectedRating(star)}
                          className="p-1 text-stone-300 hover:text-amber-400 transition-colors focus:outline-hidden"
                          title={`${star} star${star > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={`h-6 w-6 transition-transform hover:scale-110 ${
                              star <= selectedRating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-semibold text-stone-600 ml-2">
                        {selectedRating} out of 5 stars
                      </span>
                    </div>

                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Share what you liked about this course or how it helped you..."
                      rows={3}
                      className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-hidden resize-none bg-stone-50/50"
                    />

                    {reviewMsg && (
                      <p className="text-xs font-medium text-emerald-600">{reviewMsg}</p>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSubmittingReview}
                        onClick={handleSubmitReview}
                        className="bg-black hover:bg-stone-800 text-white text-xs font-bold px-4 py-2 rounded-xl"
                      >
                        {isSubmittingReview ? 'Submitting...' : course.user_review ? 'Update Review' : 'Submit Review'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reviews List */}
              {course.reviews && course.reviews.length > 0 ? (
                <div className="space-y-3">
                  {course.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-stone-900 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                            {rev.user?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={rev.user.avatar_url}
                                alt={rev.user.display_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              rev.user?.display_name?.slice(0, 1).toUpperCase() || 'U'
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-stone-900">
                              {rev.user?.display_name || 'Anonymous Student'}
                            </p>
                            <p className="text-[10px] text-stone-400">
                              {new Date(rev.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${
                                s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {rev.review_text && (
                        <p className="text-xs text-stone-700 leading-relaxed pl-10">
                          {rev.review_text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-center space-y-1">
                  <p className="text-xs font-semibold text-stone-600">No student reviews yet</p>
                  <p className="text-[11px] text-stone-400">
                    Be the first learner to leave a rating and review for this course!
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* ================================================================ */}
          {/* RIGHT COLUMN: SIGNATURE STICKY FLOATING CARD (UDEMY / COURSERA)  */}
          {/* ================================================================ */}
          <div className="lg:col-span-4 lg:-mt-56 lg:sticky lg:top-8 z-30">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl transition-all">
              {/* Top Media / Thumbnail with Play Teaser */}
              <div
                onClick={() => handleOpenPreview()}
                className="relative aspect-video w-full cursor-pointer bg-stone-900 group overflow-hidden"
              >
                {course.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-stone-900 to-black flex items-center justify-center p-6 text-center text-white">
                    <GraduationCap className="h-12 w-12 text-stone-600" />
                  </div>
                )}

                {/* Dark Hover Overlay & Play/Interactive Button */}
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 group-hover:bg-black/50 transition-colors">
                  <div className="h-14 w-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                    {course.course_format === 'live_cohort' ? (
                      <Video className="h-6 w-6 text-blue-700 ml-0.5" />
                    ) : course.course_format === 'text_and_labs' ? (
                      <BookOpen className="h-6 w-6 text-emerald-700 ml-0.5" />
                    ) : course.course_format === 'action_challenge' ? (
                      <Target className="h-6 w-6 text-purple-700 ml-0.5" />
                    ) : (
                      <Play className="h-6 w-6 text-black fill-black ml-1" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-white tracking-wide shadow-sm">
                    {course.course_format === 'live_cohort'
                      ? 'Live Cohort Classroom'
                      : course.course_format === 'text_and_labs'
                      ? 'Interactive Reading & Labs'
                      : course.course_format === 'action_challenge'
                      ? 'Action Sprint Prompts'
                      : 'Preview this course'}
                  </span>
                </div>
              </div>

              {/* Card Body & CTA Action */}
              <div className="p-6 space-y-5">
                {/* Pricing / Enrollment Display */}
                <div>
                  {isPaywalled && !hasAccess ? (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-stone-900">
                          {primaryPlan ? formatBachsAmount(primaryPlan.amount_cents, primaryPlan.currency) : '$49.99'}
                        </span>
                        <span className="text-xs text-stone-400 line-through">
                          {primaryPlan ? formatBachsAmount(primaryPlan.amount_cents * 2, primaryPlan.currency) : '$99.99'}
                        </span>
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-900">
                          50% OFF
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {course.course_format === 'live_cohort'
                          ? 'Includes all live workshops & cohort recordings'
                          : 'One-time purchase · Lifetime access'}
                      </p>
                    </div>
                  ) : isEnrolled ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-stone-600 font-bold">Your Progress</span>
                        <span className="font-mono text-stone-900 font-bold">{progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100 border border-stone-200">
                        <div
                          className="h-full bg-black transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {completedLessons} of {totalLessons} modules completed
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-stone-900">FREE</span>
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-800 border border-stone-200">
                          Included in Circle
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {course.course_format === 'live_cohort'
                          ? 'Open to all community members'
                          : 'Full access to all lectures and exercises'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Primary CTA Button */}
                <div className="space-y-2.5">
                  {isPaywalled && !hasAccess ? (
                    <Button
                      onClick={() => onOpenCheckout?.(primaryPlan || undefined)}
                      className="w-full rounded-xl bg-black py-3 text-sm font-bold text-white shadow-xs hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>
                        {course.course_format === 'live_cohort' ? 'Enroll in Live Cohort' : 'Enroll Now'}
                      </span>
                    </Button>
                  ) : isLevelGated ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-center space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-900">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Community Level {course.min_level_required} Required</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-tight">
                        Your current level is Level {course.viewer_level ?? 1}. Earn XP by engaging in the community to unlock this course!
                      </p>
                    </div>
                  ) : course.course_format === 'live_cohort' ? (
                    <div className="space-y-2">
                      {isEnrolled && course.cohort_meeting_url && (
                        <a
                          href={course.cohort_meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full rounded-xl bg-blue-700 py-3 text-sm font-bold text-white shadow-xs hover:bg-blue-800 transition-all flex items-center justify-center gap-2"
                        >
                          <Video className="h-4 w-4" />
                          <span>Join Live Video Room</span>
                          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                        </a>
                      )}
                      <Button
                        onClick={() => onStartLearning(firstPlayableLesson?.id)}
                        className={`w-full rounded-xl py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                          isEnrolled && course.cohort_meeting_url
                            ? 'bg-stone-100 text-stone-900 hover:bg-stone-200 border border-stone-200'
                            : 'bg-black text-white hover:bg-stone-800'
                        }`}
                      >
                        <BookOpen className="h-4 w-4" />
                        <span>{isEnrolled ? 'View Curriculum & Replays' : 'Join This Live Cohort'}</span>
                      </Button>
                    </div>
                  ) : course.course_format === 'text_and_labs' ? (
                    <Button
                      onClick={() => onStartLearning(firstPlayableLesson?.id)}
                      className="w-full rounded-xl bg-black py-3 text-sm font-bold text-white shadow-xs hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>{isEnrolled ? 'Continue Reading & Labs' : 'Start Reading Course'}</span>
                    </Button>
                  ) : course.course_format === 'action_challenge' ? (
                    <Button
                      onClick={() => onStartLearning(firstPlayableLesson?.id)}
                      className="w-full rounded-xl bg-purple-700 py-3 text-sm font-bold text-white shadow-xs hover:bg-purple-800 transition-all flex items-center justify-center gap-2"
                    >
                      <Target className="h-4 w-4" />
                      <span>{isEnrolled ? "Continue Today's Sprint" : 'Join the Sprint'}</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onStartLearning(firstPlayableLesson?.id)}
                      className="w-full rounded-xl bg-black py-3 text-sm font-bold text-white shadow-xs hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>{isEnrolled ? 'Continue Learning' : 'Start Course'}</span>
                    </Button>
                  )}

                  <p className="text-center text-[11px] text-stone-400">
                    30-Day Guarantee · Full Community Access
                  </p>
                </div>

                {/* "This course includes" Value Checklist */}
                <div className="border-t border-stone-100 pt-5 space-y-3">
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    This course includes:
                  </h4>
                  <ul className="space-y-2.5 text-xs text-stone-700">
                    {course.course_format === 'live_cohort' ? (
                      <>
                        <li className="flex items-center gap-2.5 text-blue-900 font-semibold">
                          <Video className="h-4 w-4 text-blue-700 shrink-0" />
                          <span>Live interactive video workshops via Zoom/Meet</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Users className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Dedicated cohort community & peer group</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Clock className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Session recordings archive with lifetime access</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>{totalLessons} modules, syllabus notes & exercises</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Award className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Official Cohort Certificate of Completion</span>
                        </li>
                      </>
                    ) : course.course_format === 'text_and_labs' ? (
                      <>
                        <li className="flex items-center gap-2.5 text-emerald-900 font-semibold">
                          <BookOpen className="h-4 w-4 text-emerald-700 shrink-0" />
                          <span>In-depth reading guides & architecture breakdowns</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Zero video required — read and learn at your pace</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Interactive code sandboxes & lab exercises</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Layers className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Self-assessment milestone quizzes</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <FolderDown className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Downloadable cheatsheets & starter templates</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Award className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Certificate of Completion</span>
                        </li>
                      </>
                    ) : course.course_format === 'action_challenge' ? (
                      <>
                        <li className="flex items-center gap-2.5 text-purple-900 font-semibold">
                          <Target className="h-4 w-4 text-purple-700 shrink-0" />
                          <span>{course.challenge_duration_days || 30} daily action prompts & challenges</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Users className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Community proof-of-work feed for accountability</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Sparkles className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Gamification XP points & daily streak tracking</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Award className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Sprint Finisher Badge & Certificate</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-center gap-2.5">
                          <Clock className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>{totalDurationHours} hours on-demand video</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>{totalLessons} lessons & interactive exercises</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <FolderDown className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Downloadable resources & code files</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Smartphone className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Access on mobile, tablet, and desktop</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Layers className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Milestone assignments & student Q&A</span>
                        </li>
                        <li className="flex items-center gap-2.5">
                          <Award className="h-4 w-4 text-stone-500 shrink-0" />
                          <span>Certificate of Completion</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Share Link Button */}
                <div className="border-t border-stone-100 pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>{copiedLink ? 'Link copied!' : 'Share course'}</span>
                  </button>

                  <span className="text-[10px] font-mono text-stone-400">
                    ID: {course.slug || course.id.slice(0, 8)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. MODAL: FREE TEASER PREVIEW VIDEO                                  */}
      {/* ==================================================================== */}
      {showPreviewModal && previewVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-stone-950 p-6 shadow-2xl border border-stone-800 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                  Course Preview
                </span>
                <h3 className="text-base font-bold text-white truncate max-w-md">
                  {previewLesson?.title || course.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
              {previewVideoUrl.includes('youtube.com') || previewVideoUrl.includes('youtu.be') ? (
                <iframe
                  src={previewVideoUrl.replace('watch?v=', 'embed/')}
                  title="Course Preview"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={previewVideoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-stone-400">
                Ready to explore the full curriculum?
              </p>
              <Button
                onClick={() => {
                  setShowPreviewModal(false);
                  onStartLearning(previewLesson?.id);
                }}
                className="rounded-xl bg-white text-black hover:bg-stone-200 font-bold text-xs"
              >
                Go to Classroom
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
