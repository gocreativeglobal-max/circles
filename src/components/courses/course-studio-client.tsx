'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Settings,
  Eye,
  ChevronDown,
  ChevronRight,
  Trash2,
  Copy,
  Edit2,
  Layers,
  Users,
  CreditCard,
  Workflow,
  Clock,
  FolderPlus,
  Play,
  FileText,
  MoveUp,
  MoveDown,
  Compass,
  Upload,
  X,
  Video,
  Calendar,
} from 'lucide-react';
import {
  CourseItem,
  CourseDeliveryFormat,
  CourseModuleItem,
  CourseLessonItem,
  CoursePaywallPlan,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ui/image-uploader';
import { LessonBlockBuilder } from './lesson-block-builder';
import { compressImage } from '@/lib/media/compressor';
import { detectMeetingPlatform } from '@/lib/courses/cohort-helpers';
import { ClassSchedulePicker } from './class-schedule-picker';
import { LearningObjectivesEditor } from './learning-objectives-editor';
import { CourseRequirementsEditor } from './course-requirements-editor';
import {
  BACHS_ACCEPTED_CURRENCIES,
  formatBachsAmount,
} from '@/lib/payments/currencies';

interface CourseStudioClientProps {
  circleId: string;
  circleSlug: string;
  initialCourse: CourseItem;
  isStaff: boolean;
  isFinancesEnabled?: boolean;
}

type StudioTab =
  | 'overview'
  | 'lessons'
  | 'customize'
  | 'paywalls'
  | 'members'
  | 'options'
  | 'workflows';

export function CourseStudioClient({
  circleId,
  circleSlug,
  initialCourse,
  isStaff: _isStaff,
  isFinancesEnabled = true,
}: CourseStudioClientProps) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseItem>(initialCourse);
  const [activeTab, setActiveTab] = useState<StudioTab>('overview');

  // Accordion state for modules in the lessons tab
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    initialCourse.modules?.forEach((m) => {
      init[m.id] = true;
    });
    return init;
  });

  // Section (Module) modal states
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModuleItem | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');

  // Lesson modal states
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLessonItem | null>(null);
  const [targetModuleId, setTargetModuleId] = useState<string>('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSlug, setLessonSlug] = useState('');
  const [isLessonSlugManual, setIsLessonSlugManual] = useState(false);
  const [lessonDescription, setLessonDescription] = useState('');
  const [lessonDuration, setLessonDuration] = useState('15');
  const [lessonThumbnailUrl, setLessonThumbnailUrl] = useState('');
  const [isUploadingLessonImage, setIsUploadingLessonImage] = useState(false);
  const [lessonIsFreePreview, setLessonIsFreePreview] = useState(false);
  const [lessonReplayUrl, setLessonReplayUrl] = useState('');
  const [lessonStatus, setLessonStatus] = useState<'draft' | 'published'>('published');

  // Rich Block Builder state
  const [blockBuilderLesson, setBlockBuilderLesson] = useState<CourseLessonItem | null>(null);

  // Customize Tab form state
  const [custTitle, setCustTitle] = useState(initialCourse.title);
  const [custSlug, setCustSlug] = useState(initialCourse.slug);
  const [custDescription, setCustDescription] = useState(initialCourse.description);
  const [custThumbnail, setCustThumbnail] = useState(initialCourse.thumbnail_url || '');
  const [custDifficulty, setCustDifficulty] = useState<
    'all_levels' | 'beginner' | 'intermediate' | 'advanced'
  >(initialCourse.difficulty_level || 'all_levels');
  const [custDuration, setCustDuration] = useState(String(initialCourse.estimated_duration_hours || 2));
  const [custObjectives, setCustObjectives] = useState<string[]>(
    initialCourse.learning_objectives || []
  );
  const [custRequirements, setCustRequirements] = useState<string[]>(
    initialCourse.requirements || []
  );

  // Options & Pacing Tab state
  const [courseFormat, setCourseFormat] = useState<CourseDeliveryFormat>(
    initialCourse.course_format || 'video_on_demand'
  );
  const [cohortMeetingUrl, setCohortMeetingUrl] = useState(
    initialCourse.cohort_meeting_url || ''
  );
  const detectedPlatform = detectMeetingPlatform(cohortMeetingUrl);
  const [cohortScheduleDescription, setCohortScheduleDescription] = useState(
    initialCourse.cohort_schedule_description || ''
  );
  const [cohortStartDate, setCohortStartDate] = useState(
    initialCourse.cohort_start_date ? initialCourse.cohort_start_date.slice(0, 16) : ''
  );
  const [cohortEndDate, setCohortEndDate] = useState(
    initialCourse.cohort_end_date ? initialCourse.cohort_end_date.slice(0, 16) : ''
  );
  const [maxSeats, setMaxSeats] = useState(
    initialCourse.max_seats ? String(initialCourse.max_seats) : ''
  );
  const [challengeDurationDays] = useState(
    initialCourse.challenge_duration_days ? String(initialCourse.challenge_duration_days) : '30'
  );
  const [pacingFormat, setPacingFormat] = useState<'self_paced' | 'structured' | 'scheduled'>(
    initialCourse.pacing_format || 'self_paced'
  );
  const [requireSequential, setRequireSequential] = useState(
    Boolean(initialCourse.require_sequential_completion)
  );

  // Paywall & Access Tab state
  const [accessRule, setAccessRule] = useState<
    'open' | 'members_only' | 'paywall' | 'min_level' | 'staff_only'
  >(initialCourse.access_rule || 'open');
  const [minLevel, setMinLevel] = useState(initialCourse.min_level_required || 1);
  const [financesEnabled, setFinancesEnabled] = useState(isFinancesEnabled);
  const [isEnablingFinances, setIsEnablingFinances] = useState(false);
  const [paywallPlans, setPaywallPlans] = useState<CoursePaywallPlan[]>(
    initialCourse.paywall_plans || []
  );
  const [allCirclePlans, setAllCirclePlans] = useState<CoursePaywallPlan[]>([]);
  const [_isLoadingCirclePlans, setIsLoadingCirclePlans] = useState(false);
  const [selectedExistingPlanId, setSelectedExistingPlanId] = useState('');
  const [showNewPaywallModal, setShowNewPaywallModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDescription, setNewPlanDescription] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('49');
  const [newPlanCurrency, setNewPlanCurrency] = useState('USD');
  const [extraPaywallPrices, setExtraPaywallPrices] = useState<Array<{ currency: string; amount: string }>>([]);
  const [newPlanBillingType, setNewPlanBillingType] = useState<'one_time' | 'recurring'>('one_time');
  const [newPlanBillingPeriod, setNewPlanBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Status message & loading
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Danger Zone / Delete Course state
  const [showDeleteStudioConfirm, setShowDeleteStudioConfirm] = useState(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [deleteCourseError, setDeleteCourseError] = useState<string | null>(null);

  async function handleDeleteCourseFromStudio() {
    setIsDeletingCourse(true);
    setDeleteCourseError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete course');
      }
      router.push(`/circles/${circleSlug}/courses`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete course';
      setDeleteCourseError(msg);
      setIsDeletingCourse(false);
    }
  }

  // Calculate totals
  const modules = course.modules || [];
  const totalLessonsCount = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);

  function showFeedback(type: 'success' | 'error', text: string) {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  }

  // Reload course data
  async function refreshCourse() {
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`);
      const data = await res.json();
      if (res.ok && data.course) {
        setCourse(data.course);
      }
    } catch {
      // silent fail
    }
  }

  // --- Handlers: Publish/Draft Status ---
  async function handleToggleCourseStatus() {
    const nextStatus = course.status === 'published' ? 'draft' : 'published';
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status.');
      setCourse((prev) => ({ ...prev, status: nextStatus }));
      showFeedback('success', `Course is now ${nextStatus}.`);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Handlers: Modules (Sections) ---
  function openAddSectionModal() {
    setEditingModule(null);
    setSectionTitle('');
    setSectionDescription('');
    setShowSectionModal(true);
  }

  function openEditSectionModal(mod: CourseModuleItem) {
    setEditingModule(mod);
    setSectionTitle(mod.title);
    setSectionDescription(mod.description || '');
    setShowSectionModal(true);
  }

  async function handleSaveSection(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionTitle.trim()) return;
    setIsSaving(true);
    try {
      if (editingModule) {
        // Update
        const res = await fetch(`/api/circles/${circleId}/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_module',
            moduleId: editingModule.id,
            title: sectionTitle.trim(),
            description: sectionDescription.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update section.');
        showFeedback('success', 'Section updated successfully.');
      } else {
        // Create
        const res = await fetch(`/api/circles/${circleId}/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_module',
            courseId: course.id,
            title: sectionTitle.trim(),
            description: sectionDescription.trim(),
            sortOrder: modules.length + 1,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create section.');
        showFeedback('success', 'Section added successfully.');
      }
      setShowSectionModal(false);
      await refreshCourse();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to save section.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSection(moduleId: string) {
    if (!confirm('Are you sure you want to delete this section? All lessons inside it will also be deleted.')) {
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_module',
          moduleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete section.');
      showFeedback('success', 'Section deleted.');
      await refreshCourse();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to delete section.');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Handlers: Lessons ---
  function openAddLessonModal(modId: string) {
    setEditingLesson(null);
    setTargetModuleId(modId);
    setLessonTitle('');
    setLessonSlug('');
    setIsLessonSlugManual(false);
    setLessonDescription('');
    setLessonThumbnailUrl('');
    setLessonDuration('15');
    setLessonIsFreePreview(false);
    setLessonReplayUrl('');
    setLessonStatus('published');
    setShowLessonModal(true);
  }

  function openEditLessonModal(lesson: CourseLessonItem) {
    setEditingLesson(lesson);
    setTargetModuleId(lesson.module_id);
    setLessonTitle(lesson.title);
    setLessonSlug(lesson.slug);
    setIsLessonSlugManual(true);
    setLessonDescription(lesson.description || '');
    setLessonThumbnailUrl(lesson.thumbnail_url || '');
    setLessonDuration(String(lesson.duration_minutes || 15));
    setLessonIsFreePreview(Boolean(lesson.is_free_preview));
    setLessonReplayUrl(lesson.replay_url || '');
    setLessonStatus(lesson.status === 'draft' ? 'draft' : 'published');
    setShowLessonModal(true);
  }

  async function handleLessonImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLessonImage(true);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.82,
      });

      try {
        const res = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            circleId,
            originalFilename: compressed.filename,
            mimeType: compressed.mimeType,
            visibility: 'public',
            contentBase64: compressed.base64,
          }),
        });
        const data = await res.json();
        if (res.ok && data.upload?.signed_download_url) {
          setLessonThumbnailUrl(data.upload.signed_download_url);
        } else {
          setLessonThumbnailUrl(compressed.base64);
        }
      } catch {
        setLessonThumbnailUrl(compressed.base64);
      } finally {
        setIsUploadingLessonImage(false);
      }
    } catch {
      setIsUploadingLessonImage(false);
    }
  }

  function handleLessonTitleChange(val: string) {
    setLessonTitle(val);
    if (!isLessonSlugManual) {
      setLessonSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      );
    }
  }

  async function handleSaveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonTitle.trim()) return;
    setIsSaving(true);
    try {
      if (editingLesson) {
        // Update lesson metadata
        const res = await fetch(`/api/circles/${circleId}/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_lesson',
            lessonId: editingLesson.id,
            title: lessonTitle.trim(),
            slug: lessonSlug.trim() || undefined,
            description: lessonDescription.trim(),
            thumbnailUrl: lessonThumbnailUrl.trim() || null,
            durationMinutes: parseInt(lessonDuration, 10) || 0,
            isFreePreview: lessonIsFreePreview,
            replayUrl: lessonReplayUrl.trim() || null,
            status: lessonStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update lesson.');
        showFeedback('success', 'Lesson updated successfully.');
      } else {
        // Create lesson
        const currentMod = modules.find((m) => m.id === targetModuleId);
        const sortOrder = (currentMod?.lessons?.length || 0) + 1;
        const res = await fetch(`/api/circles/${circleId}/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_lesson',
            circleId,
            courseId: course.id,
            moduleId: targetModuleId,
            title: lessonTitle.trim(),
            slug:
              lessonSlug.trim() ||
              lessonTitle
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, ''),
            description: lessonDescription.trim(),
            thumbnailUrl: lessonThumbnailUrl.trim() || null,
            durationMinutes: parseInt(lessonDuration, 10) || 0,
            isFreePreview: lessonIsFreePreview,
            replayUrl: lessonReplayUrl.trim() || null,
            status: lessonStatus,
            sortOrder,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create lesson.');
        showFeedback('success', 'Lesson created successfully.');
      }
      setShowLessonModal(false);
      await refreshCourse();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to save lesson.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_lesson',
          lessonId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete lesson.');
      showFeedback('success', 'Lesson deleted.');
      await refreshCourse();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to delete lesson.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDuplicateLesson(lessonId: string) {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'duplicate_lesson',
          lessonId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to duplicate lesson.');
      showFeedback('success', 'Lesson duplicated.');
      await refreshCourse();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to duplicate lesson.');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Handlers: Reordering Sections & Lessons ---
  async function handleMoveModule(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const newModuleList = [...modules];
    const [moved] = newModuleList.splice(index, 1);
    newModuleList.splice(targetIndex, 0, moved);

    const moduleOrder = newModuleList.map((m) => m.id);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder_curriculum',
          courseId: course.id,
          moduleOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reorder sections.');
      await refreshCourse();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Reordering failed.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMoveLesson(
    moduleId: string,
    lessonIndex: number,
    direction: 'up' | 'down'
  ) {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod || !mod.lessons) return;
    const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
    if (targetIndex < 0 || targetIndex >= mod.lessons.length) return;

    const newLessons = [...mod.lessons];
    const [moved] = newLessons.splice(lessonIndex, 1);
    newLessons.splice(targetIndex, 0, moved);

    const lessonIds = newLessons.map((l) => l.id);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder_curriculum',
          courseId: course.id,
          lessonOrder: [{ moduleId, lessonIds }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reorder lessons.');
      await refreshCourse();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Reordering failed.');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Handlers: Customize Tab Save ---
  async function handleSaveCustomize(e: React.FormEvent) {
    e.preventDefault();

    const cleanObjectives = custObjectives.map((s) => s.trim()).filter(Boolean);
    if (cleanObjectives.length === 0) {
      showFeedback('error', 'Please add at least one learning outcome ("What You\'ll Learn").');
      return;
    }

    const cleanRequirements = custRequirements.map((s) => s.trim()).filter(Boolean);
    if (cleanRequirements.length === 0) {
      showFeedback('error', 'Please add at least one course requirement or prerequisite.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: custTitle.trim(),
          slug: custSlug.trim(),
          description: custDescription.trim(),
          thumbnailUrl: custThumbnail.trim() || null,
          difficultyLevel: custDifficulty,
          estimatedDurationHours: parseFloat(custDuration) || 0,
          learningObjectives: cleanObjectives,
          requirements: cleanRequirements,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update details.');
      setCourse((prev) => ({
        ...prev,
        title: custTitle.trim(),
        slug: custSlug.trim(),
        description: custDescription.trim(),
        thumbnail_url: custThumbnail.trim() || null,
        difficulty_level: custDifficulty,
        estimated_duration_hours: parseFloat(custDuration) || 0,
        learning_objectives: cleanObjectives,
        requirements: cleanRequirements,
      }));
      showFeedback('success', 'Course details updated.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to update details.');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Handlers: Options & Pacing Save ---
  async function handleSaveOptions(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseFormat,
          cohortMeetingUrl: courseFormat === 'live_cohort' && cohortMeetingUrl.trim() ? cohortMeetingUrl.trim() : null,
          cohortScheduleDescription: courseFormat === 'live_cohort' && cohortScheduleDescription.trim() ? cohortScheduleDescription.trim() : null,
          cohortStartDate: courseFormat === 'live_cohort' && cohortStartDate ? new Date(cohortStartDate).toISOString() : null,
          cohortEndDate: courseFormat === 'live_cohort' && cohortEndDate ? new Date(cohortEndDate).toISOString() : null,
          maxSeats: courseFormat === 'live_cohort' && maxSeats ? parseInt(maxSeats, 10) : null,
          challengeDurationDays: courseFormat === 'action_challenge' ? parseInt(challengeDurationDays, 10) || 30 : null,
          pacingFormat,
          requireSequentialCompletion: requireSequential,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save options.');
      setCourse((prev) => ({
        ...prev,
        course_format: courseFormat,
        cohort_meeting_url: cohortMeetingUrl,
        cohort_schedule_description: cohortScheduleDescription,
        cohort_start_date: cohortStartDate ? new Date(cohortStartDate).toISOString() : null,
        cohort_end_date: cohortEndDate ? new Date(cohortEndDate).toISOString() : null,
        max_seats: maxSeats ? parseInt(maxSeats, 10) : null,
        challenge_duration_days: parseInt(challengeDurationDays, 10) || 30,
        pacing_format: pacingFormat,
        require_sequential_completion: requireSequential,
      }));
      showFeedback('success', 'Course options saved.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to save options.');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Handlers: Paywalls & Access Save ---
  async function handleSavePaywalls(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessRule,
          minLevelRequired: accessRule === 'min_level' ? Number(minLevel) : 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save access rules.');
      setCourse((prev) => ({
        ...prev,
        access_rule: accessRule,
        min_level_required: Number(minLevel),
      }));
      showFeedback('success', 'Access rules updated.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to save access rules.');
    } finally {
      setIsSaving(false);
    }
  }

  async function loadCirclePlans() {
    setIsLoadingCirclePlans(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/finances?mode=plans`);
      if (res.ok) {
        const data = await res.json();
        setAllCirclePlans(data.plans || []);
      }
    } catch {
      // fallback
    } finally {
      setIsLoadingCirclePlans(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'paywalls' && financesEnabled) {
      void loadCirclePlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, financesEnabled]);

  async function handleEnableFinances() {
    setIsEnablingFinances(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/capabilities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityKey: 'payments_finances',
          enabled: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to enable Payments & Finances module.');
      }
      setFinancesEnabled(true);
      showFeedback('success', 'Payments & Finances module enabled! You can now configure course paywalls.');
      void loadCirclePlans();
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to enable finances.');
    } finally {
      setIsEnablingFinances(false);
    }
  }

  async function handleCreatePaywall(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlanName.trim()) return;
    const currencyPrices: Record<string, number> = {};
    for (const p of extraPaywallPrices) {
      const code = p.currency.trim().toUpperCase();
      const val = parseFloat(p.amount);
      if (code && !isNaN(val) && val >= 0) {
        const isZeroDec = ['JPY', 'UGX', 'RWF', 'TZS'].includes(code);
        currencyPrices[code] = isZeroDec ? Math.round(val) : Math.round(val * 100);
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_paywall',
          paywall: {
            name: newPlanName.trim(),
            description: newPlanDescription.trim(),
            amountCents: Math.round((parseFloat(newPlanPrice) || 0) * 100),
            currency: newPlanCurrency,
            currencyPrices: Object.keys(currencyPrices).length > 0 ? currencyPrices : undefined,
            billingType: newPlanBillingType,
            intervalUnit: newPlanBillingType === 'recurring' ? 'month' : null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create paywall plan.');
      if (data.paywall) {
        setPaywallPlans((prev) => [...prev, data.paywall]);
        setShowNewPaywallModal(false);
        setNewPlanName('');
        setNewPlanDescription('');
        setNewPlanPrice('49');
        setExtraPaywallPrices([]);
        setAccessRule('paywall');
        showFeedback('success', 'Paywall created and linked to this course.');
      }
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to create paywall.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLinkExistingPlan() {
    if (!selectedExistingPlanId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_paywall',
          planId: selectedExistingPlanId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link plan.');
      const found = allCirclePlans.find((p) => p.id === selectedExistingPlanId);
      if (found) {
        setPaywallPlans((prev) => [...prev, found]);
      }
      setSelectedExistingPlanId('');
      setAccessRule('paywall');
      showFeedback('success', 'Pricing plan linked as course paywall.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to link plan.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnlinkPaywall(planId: string) {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlink_paywall',
          planId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlink plan.');
      setPaywallPlans((prev) => prev.filter((p) => p.id !== planId));
      showFeedback('success', 'Paywall plan unlinked.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Unable to unlink plan.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 pb-20">
      {/* Top Banner / Studio Header */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top row: Back link + Actions */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/circles/${circleSlug}/courses`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Courses
              </Link>
              <span className="text-stone-300">/</span>
              <span className="text-xs font-semibold text-stone-700">Course Studio</span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Preview Button */}
              <Link
                href={`/circles/${circleSlug}/courses/${course.id}?preview=true`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview as student
              </Link>

              {/* Status Switcher Toggle */}
              <button
                type="button"
                onClick={handleToggleCourseStatus}
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all ${
                  course.status === 'published'
                    ? 'bg-black text-white hover:bg-zinc-800'
                    : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                }`}
                title="Click to toggle Draft / Published"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    course.status === 'published' ? 'bg-white' : 'bg-amber-600'
                  }`}
                />
                {course.status === 'published' ? 'Published' : 'Draft'}
              </button>
            </div>
          </div>

          {/* Course Title & Key Stats Header */}
          <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between border-t border-stone-100">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight text-stone-900">
                  {course.title}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
                    course.status === 'published'
                      ? 'bg-stone-100 text-stone-900 border border-stone-200'
                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                  }`}
                >
                  {course.status === 'published' ? 'Published' : 'Draft'}
                </span>
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-700 border border-stone-200">
                  {course.pacing_format === 'scheduled'
                    ? 'Scheduled'
                    : course.pacing_format === 'structured'
                    ? 'Structured'
                    : 'Self-paced'}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {modules.length} {modules.length === 1 ? 'section' : 'sections'} ·{' '}
                {totalLessonsCount} {totalLessonsCount === 1 ? 'lesson' : 'lessons'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setActiveTab('lessons')}
                className="bg-black text-white hover:bg-stone-800 text-xs px-3.5 py-2 rounded-lg font-semibold inline-flex items-center gap-1.5 shadow-2xs"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Edit lessons
              </Button>
            </div>
          </div>

          {/* Sub Navigation Tabs (Circle.so style) */}
          <div className="flex items-center gap-1 overflow-x-auto border-t border-stone-200 pt-1 scrollbar-none">
            {[
              { id: 'overview', label: 'Overview', icon: Compass },
              { id: 'lessons', label: 'Lessons', icon: BookOpen },
              { id: 'customize', label: 'Customize', icon: Settings },
              { id: 'paywalls', label: 'Paywalls', icon: CreditCard },
              { id: 'members', label: 'Members', icon: Users },
              { id: 'options', label: 'Options', icon: Layers },
              { id: 'workflows', label: 'Workflows', icon: Workflow },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as StudioTab)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold transition-all ${
                    isActive
                      ? 'border-black text-black'
                      : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-900'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-black' : 'text-stone-400'}`} />
                  {tab.label}
                  {tab.id === 'lessons' && (
                    <span className="rounded-full bg-stone-100 px-1.5 py-0.2 text-[10px] text-stone-600 font-mono">
                      {totalLessonsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {feedbackMsg && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
          <div
            className={`flex items-center justify-between rounded-xl px-4 py-3 text-xs font-semibold shadow-2xs border ${
              feedbackMsg.type === 'success'
                ? 'bg-stone-100 text-stone-900 border-stone-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-stone-400 hover:text-stone-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8">
        {/* ==================================================================== */}
        {/* TAB 1: OVERVIEW */}
        {/* ==================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Status & Pacing Row */}
            <div className="flex items-center gap-2">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  course.status === 'published'
                    ? 'bg-stone-100 text-stone-900'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {course.status === 'published' ? 'Published' : 'Draft'}
              </span>
              <span className="rounded-md bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-800">
                {course.pacing_format === 'scheduled'
                  ? 'Scheduled'
                  : course.pacing_format === 'structured'
                  ? 'Structured'
                  : 'Self-paced'}
              </span>
            </div>

            {/* The 4 Circle.so Core Metric Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Metric 1: Students */}
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-medium text-stone-500">Students</p>
                <p className="mt-2 text-3xl font-black text-stone-900">
                  {course.enrolled_students_count ?? 0}
                </p>
              </div>

              {/* Metric 2: In progress */}
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-medium text-stone-500">In progress</p>
                <p className="mt-2 text-3xl font-black text-stone-900">
                  {course.in_progress_students_count ?? 0}
                </p>
              </div>

              {/* Metric 3: Completed */}
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-medium text-stone-500">Completed</p>
                <p className="mt-2 text-3xl font-black text-stone-900">
                  {course.completed_students_count ?? 0}
                </p>
              </div>

              {/* Metric 4: Completion rate */}
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-medium text-stone-500">Completion rate</p>
                <p className="mt-2 text-3xl font-black text-stone-900">
                  {course.completion_rate_percentage ?? 0}%
                </p>
              </div>
            </div>

            {/* Engagement & Curriculum Details Section */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left 2 Cols: Engagement & Lessons Breakdown */}
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-stone-900">Engagement & Lessons</h3>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Overview of course structure and student interaction.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('lessons')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-900 shadow-2xs hover:bg-stone-50 hover:border-stone-300 transition-all"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-stone-600" />
                      <span>View curriculum</span>
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                        <BookOpen className="h-4 w-4 text-stone-500" />
                        <span>Syllabus Size</span>
                      </div>
                      <p className="mt-2 text-lg font-black text-stone-900">
                        {modules.length} {modules.length === 1 ? 'section' : 'sections'} ·{' '}
                        {totalLessonsCount} {totalLessonsCount === 1 ? 'lesson' : 'lessons'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                        <Clock className="h-4 w-4 text-stone-500" />
                        <span>Estimated Duration</span>
                      </div>
                      <p className="mt-2 text-lg font-black text-stone-900">
                        {course.estimated_duration_hours || 0} hours
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Col: Course Type & Info */}
              <div className="space-y-6">
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
                  <h3 className="text-sm font-bold text-stone-900">Course type</h3>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-900 border border-stone-200">
                      {course.pacing_format === 'scheduled'
                        ? 'Scheduled'
                        : course.pacing_format === 'structured'
                        ? 'Structured'
                        : 'Self-paced'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-600">
                    {course.pacing_format === 'structured'
                      ? 'Structured pacing: Lessons unlock sequentially as students complete each required lesson.'
                      : course.pacing_format === 'scheduled'
                      ? 'Scheduled cohort: Lessons unlock on specific drip days or scheduled calendar dates.'
                      : 'Self-paced learning: Students can explore lessons on demand and complete material at their own speed in any order.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('options')}
                    className="mt-4 text-xs font-semibold text-stone-900 hover:underline inline-flex items-center gap-1"
                  >
                    Change pacing in Options →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: LESSONS (CURRICULUM BUILDER) */}
        {/* ==================================================================== */}
        {activeTab === 'lessons' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black tracking-tight text-stone-900">
                  Course Content
                </h2>
                <p className="text-xs text-stone-500">
                  Organize your curriculum into sections and lessons.
                </p>
              </div>

              <Button
                onClick={openAddSectionModal}
                className="bg-black text-white hover:bg-stone-800 text-xs px-3.5 py-2 rounded-lg font-semibold inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add section
              </Button>
            </div>

            {/* EMPTY STATE (Matching Circle.so exact text) */}
            {modules.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-2xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                  <FolderPlus className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-bold text-stone-900">
                  Create your course content
                </h3>
                <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto">
                  Start by adding a course section, and then add lessons.
                </p>
                <Button
                  onClick={openAddSectionModal}
                  className="mt-6 bg-black text-white hover:bg-stone-800 text-xs px-4 py-2 rounded-lg font-semibold inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add section
                </Button>
              </div>
            ) : (
              /* SECTIONS ACCORDION LIST */
              <div className="space-y-4">
                {modules.map((mod, modIdx) => {
                  const isExpanded = expandedModules[mod.id] ?? true;
                  const lessons = mod.lessons || [];

                  return (
                    <div
                      key={mod.id}
                      className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-2xs transition-all"
                    >
                      {/* Section Header */}
                      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/70 px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedModules((prev) => ({
                                ...prev,
                                [mod.id]: !isExpanded,
                              }))
                            }
                            className="text-stone-400 hover:text-stone-700 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-stone-900">
                                {mod.title}
                              </h3>
                              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-mono text-stone-700">
                                {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                              </span>
                            </div>
                            {mod.description && (
                              <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                                {mod.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Section Actions */}
                        <div className="flex items-center gap-1.5">
                          {/* Move Up/Down */}
                          <button
                            type="button"
                            disabled={modIdx === 0}
                            onClick={() => handleMoveModule(modIdx, 'up')}
                            className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-30"
                            title="Move section up"
                          >
                            <MoveUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={modIdx === modules.length - 1}
                            onClick={() => handleMoveModule(modIdx, 'down')}
                            className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-30"
                            title="Move section down"
                          >
                            <MoveDown className="h-3.5 w-3.5" />
                          </button>

                          <Button
                            onClick={() => openAddLessonModal(mod.id)}
                            className="bg-white border border-stone-200 text-stone-800 hover:bg-stone-100 text-xs px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 shadow-2xs ml-2"
                          >
                            <Plus className="h-3 w-3" />
                            Add lesson
                          </Button>

                          <button
                            type="button"
                            onClick={() => openEditSectionModal(mod)}
                            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-800"
                            title="Edit section"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSection(mod.id)}
                            className="rounded-md p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-700"
                            title="Delete section"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Lessons List inside this section */}
                      {isExpanded && (
                        <div className="divide-y divide-stone-100">
                          {lessons.length === 0 ? (
                            <div className="p-6 text-center text-xs text-stone-500">
                              No lessons in this section yet.{' '}
                              <button
                                type="button"
                                onClick={() => openAddLessonModal(mod.id)}
                                className="font-semibold text-black hover:underline"
                              >
                                + Add first lesson
                              </button>
                            </div>
                          ) : (
                            lessons.map((lesson, lessonIdx) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between px-6 py-3 hover:bg-stone-50/50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {lesson.thumbnail_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={lesson.thumbnail_url}
                                      alt={lesson.title}
                                      className="h-9 w-14 shrink-0 rounded-lg object-cover border border-stone-200/90 shadow-2xs"
                                    />
                                  ) : (
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                                      <Play className="h-3 w-3" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold text-stone-900">
                                        {lesson.title}
                                      </p>
                                      <span
                                        className={`rounded-full px-2 py-0.2 text-[9px] font-semibold uppercase ${
                                          lesson.status === 'published'
                                            ? 'bg-stone-100 text-stone-900 border border-stone-200'
                                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                                        }`}
                                      >
                                        {lesson.status}
                                      </span>
                                      {lesson.is_free_preview && (
                                        <span className="rounded-full bg-blue-50 px-2 py-0.2 text-[9px] font-semibold text-blue-800 border border-blue-200">
                                          Preview
                                        </span>
                                      )}
                                      {lesson.replay_url && (
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.2 text-[9px] font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                          <Video className="h-2.5 w-2.5 text-emerald-600" />
                                          <span>Replay</span>
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400">
                                      {lesson.duration_minutes > 0 && (
                                        <span>{lesson.duration_minutes} min</span>
                                      )}
                                      {lesson.content_blocks && (
                                        <span>· {lesson.content_blocks.length} blocks</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Lesson Actions */}
                                <div className="flex items-center gap-2">
                                  {/* Move lesson up/down */}
                                  <button
                                    type="button"
                                    disabled={lessonIdx === 0}
                                    onClick={() => handleMoveLesson(mod.id, lessonIdx, 'up')}
                                    className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-30"
                                    title="Move up"
                                  >
                                    <MoveUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={lessonIdx === lessons.length - 1}
                                    onClick={() => handleMoveLesson(mod.id, lessonIdx, 'down')}
                                    className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-30"
                                    title="Move down"
                                  >
                                    <MoveDown className="h-3 w-3" />
                                  </button>

                                  {/* Edit Rich Blocks */}
                                  <Button
                                    onClick={() => setBlockBuilderLesson(lesson)}
                                    className="bg-black text-white hover:bg-stone-800 text-xs px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 shadow-2xs"
                                  >
                                    <FileText className="h-3 w-3" />
                                    Edit content
                                  </Button>

                                  {/* Edit Metadata */}
                                  <button
                                    type="button"
                                    onClick={() => openEditLessonModal(lesson)}
                                    className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800"
                                    title="Settings"
                                  >
                                    <Settings className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Duplicate */}
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateLesson(lesson.id)}
                                    className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800"
                                    title="Duplicate lesson"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLesson(lesson.id)}
                                    className="rounded-md p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-700"
                                    title="Delete lesson"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Bottom Add Section Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={openAddSectionModal}
                    className="w-full border-2 border-dashed border-stone-300 bg-white hover:border-black hover:bg-stone-50 text-stone-900 text-xs py-3 rounded-xl font-bold inline-flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="h-4 w-4 text-stone-700" />
                    <span>+ Add section</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: CUSTOMIZE */}
        {/* ==================================================================== */}
        {activeTab === 'customize' && (
          <div className="max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">Course Details</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Customize title, description, URL slug, and visuals for your course.
            </p>

            <form onSubmit={handleSaveCustomize} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800">
                  Course Title
                </label>
                <input
                  type="text"
                  required
                  value={custTitle}
                  onChange={(e) => setCustTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800">
                  Course Slug
                </label>
                <input
                  type="text"
                  required
                  value={custSlug}
                  onChange={(e) => setCustSlug(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-mono text-stone-900 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={custDescription}
                  onChange={(e) => setCustDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Course Cover / Thumbnail
                </label>
                <ImageUploader
                  circleId={circleId}
                  value={custThumbnail}
                  onChange={(val) => setCustThumbnail(val as string)}
                  multiple={false}
                  aspectRatio="video"
                  label="Upload Course Cover"
                  helperText="16:9 banner or cover image (JPEG, PNG, WebP up to 10MB)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800">
                    Difficulty Level
                  </label>
                  <select
                    value={custDifficulty}
                    onChange={(e) =>
                      setCustDifficulty(
                        e.target.value as 'all_levels' | 'beginner' | 'intermediate' | 'advanced'
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                  >
                    <option value="all_levels">All Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800">
                    Estimated Duration (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={custDuration}
                    onChange={(e) => setCustDuration(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                  />
                </div>
              </div>

              {/* What You'll Learn (Learning Objectives) */}
              <LearningObjectivesEditor
                value={custObjectives}
                onChange={setCustObjectives}
                courseTitle={custTitle}
                disabled={isSaving}
              />

              {/* Course Requirements & Prerequisites */}
              <CourseRequirementsEditor
                value={custRequirements}
                onChange={setCustRequirements}
                disabled={isSaving}
              />

              <div className="pt-4 border-t border-stone-100 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-black text-white hover:bg-stone-800 text-xs px-4 py-2 rounded-lg font-semibold shadow-2xs"
                >
                  {isSaving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: PAYWALLS & ACCESS */}
        {/* ==================================================================== */}
        {activeTab === 'paywalls' && (
          <div className="space-y-6 max-w-2xl">
            {/* Finances capability check */}
            {!financesEnabled && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-amber-900">
                      Finances & Payments are not enabled
                    </h3>
                    <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                      To gate this course behind paid access passes, one-time fees, or recurring subscriptions, enable the Finances capability for this Circle.
                    </p>
                    <div className="mt-3">
                      <Button
                        type="button"
                        onClick={handleEnableFinances}
                        disabled={isEnablingFinances}
                        className="bg-amber-900 text-white hover:bg-amber-800 text-xs px-3.5 py-1.5 rounded-lg font-semibold shadow-2xs"
                      >
                        {isEnablingFinances ? 'Enabling...' : 'Enable Finances Capability'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
              <h2 className="text-base font-bold text-stone-900">Course Access & Paywall Configuration</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Configure whether this course is free, restricted by community level, or gated behind paid paywalls.
              </p>

              <form onSubmit={handleSavePaywalls} className="mt-6 space-y-5">
                <div className="space-y-3">
                  {[
                    {
                      value: 'open',
                      title: 'Open Access',
                      desc: 'Anyone who can access this Circle can freely enroll and view lessons.',
                    },
                    {
                      value: 'members_only',
                      title: 'Active Members Only',
                      desc: 'Requires an active member subscription or membership in this Circle.',
                    },
                    {
                      value: 'paywall',
                      title: 'Behind a Paywall (Paid Course)',
                      desc: 'Students must purchase a linked pricing plan or pass to access paid lessons.',
                    },
                    {
                      value: 'min_level',
                      title: 'Gamified Level Gated',
                      desc: 'Restricts access to members who reached a minimum Community Level via XP.',
                    },
                    {
                      value: 'staff_only',
                      title: 'Staff Only',
                      desc: 'Restricted exclusively to Circle owners, admins, and moderators.',
                    },
                  ].map((item) => (
                    <label
                      key={item.value}
                      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                        accessRule === item.value
                          ? 'border-black bg-stone-50 ring-1 ring-black/5'
                          : 'border-stone-200 hover:bg-stone-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="accessRule"
                        value={item.value}
                        checked={accessRule === item.value}
                        onChange={() =>
                          setAccessRule(
                            item.value as 'open' | 'members_only' | 'paywall' | 'min_level' | 'staff_only'
                          )
                        }
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-stone-900">{item.title}</p>
                          {item.value === 'paywall' && (
                            <span className="rounded-md bg-stone-900 text-white px-1.5 py-0.5 text-[10px] font-semibold">
                              Monetized
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Level Gated Configuration */}
                {accessRule === 'min_level' && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <label className="block text-xs font-bold text-stone-800">
                      Minimum Community Level Required
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={minLevel}
                      onChange={(e) => setMinLevel(parseInt(e.target.value, 10) || 1)}
                      className="mt-1 w-32 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-black focus:outline-none"
                    />
                    <p className="text-[11px] text-stone-500 mt-1">
                      Members earn XP by watching lessons, submitting assignments, and posting in discussions.
                    </p>
                  </div>
                )}

                {/* Paywall Configuration Section */}
                {accessRule === 'paywall' && (
                  <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/70 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Linked Course Paywalls
                        </h3>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Students can purchase any of these plans to unlock full access to this course.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setShowNewPaywallModal(true)}
                        className="bg-black text-white hover:bg-stone-800 text-xs px-3 py-1.5 rounded-lg font-semibold shadow-2xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create Paywall</span>
                      </Button>
                    </div>

                    {paywallPlans.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center">
                        <CreditCard className="mx-auto h-8 w-8 text-stone-400" />
                        <p className="mt-2 text-xs font-bold text-stone-800">No Paywalls Linked Yet</p>
                        <p className="mt-1 text-[11px] text-stone-500 max-w-sm mx-auto">
                          Create a dedicated one-time fee or link an existing membership plan so students can purchase access.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {paywallPlans.map((plan) => (
                          <div
                            key={plan.id}
                            className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3.5 shadow-2xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
                                <CreditCard className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-stone-900">{plan.name}</h4>
                                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700">
                                    {plan.billing_type === 'recurring' ? `${plan.interval_unit ? plan.interval_unit.toUpperCase() : 'MONTHLY'} Sub` : 'One-time'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-stone-500">
                                  {plan.description || 'Access to course lessons and materials'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-sm font-bold text-stone-900">
                                  {formatBachsAmount(plan.amount_cents, plan.currency)}
                                </span>
                                {plan.currency_prices &&
                                  typeof plan.currency_prices === 'object' &&
                                  Object.keys(plan.currency_prices).length > 0 && (
                                    <div className="mt-1 flex flex-wrap justify-end gap-1">
                                      {Object.entries(plan.currency_prices).map(([code, val]) => (
                                        <span
                                          key={code}
                                          className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700 border border-stone-200"
                                        >
                                          {formatBachsAmount(val, code)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUnlinkPaywall(plan.id)}
                                className="text-stone-400 hover:text-rose-600 p-1.5 transition-colors"
                                title="Unlink paywall"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attach existing plan dropdown */}
                    {allCirclePlans.length > 0 && (
                      <div className="pt-3 border-t border-stone-200/80">
                        <label className="block text-[11px] font-bold text-stone-700">
                          Or attach an existing Circle pricing plan:
                        </label>
                        <div className="mt-1.5 flex items-center gap-2">
                          <select
                            value={selectedExistingPlanId}
                            onChange={(e) => setSelectedExistingPlanId(e.target.value)}
                            className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                          >
                            <option value="">-- Select an existing plan --</option>
                            {allCirclePlans
                              .filter((p) => !paywallPlans.some((linked) => linked.id === p.id))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} — {formatBachsAmount(p.amount_cents, p.currency)} ({p.billing_type})
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleLinkExistingPlan}
                            disabled={!selectedExistingPlanId || isSaving}
                            className="inline-flex items-center rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2 text-xs font-semibold text-stone-900 shadow-2xs hover:bg-stone-200 hover:border-stone-300 disabled:opacity-50 shrink-0 transition-all"
                          >
                            Attach Plan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-stone-100 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-black text-white hover:bg-stone-800 text-xs px-4 py-2 rounded-lg font-semibold shadow-2xs"
                  >
                    {isSaving ? 'Saving...' : 'Save access rules'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create New Course Paywall */}
        {showNewPaywallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-stone-900" />
                  <h3 className="text-sm font-bold text-stone-900">Create Course Paywall</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewPaywallModal(false)}
                  className="rounded-lg border border-stone-200 bg-stone-50 p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePaywall} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800">
                    Paywall / Plan Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lifetime Course Access"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Complete access to all 12 modules, downloadable resources, and certificates."
                    value={newPlanDescription}
                    onChange={(e) => setNewPlanDescription(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-800">Price Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={newPlanPrice}
                      onChange={(e) => setNewPlanPrice(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800">
                      Currency
                    </label>
                    <select
                      value={newPlanCurrency}
                      onChange={(e) => setNewPlanCurrency(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                    >
                      {BACHS_ACCEPTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol}) — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Multi-Currency Pricing (Optional) */}
                <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-900">
                        Additional Currency Prices (Optional)
                      </span>
                      <p className="text-[11px] text-stone-500">
                        Set fixed prices for students paying with other currencies.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExtraPaywallPrices((prev) => [
                          ...prev,
                          {
                            currency:
                              BACHS_ACCEPTED_CURRENCIES.find((c) => c.code !== newPlanCurrency)?.code || 'EUR',
                            amount: '',
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add price</span>
                    </button>
                  </div>

                  {extraPaywallPrices.map((extra, idx) => (
                    <div key={idx} className="flex items-center gap-2 pt-1">
                      <select
                        value={extra.currency}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExtraPaywallPrices((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, currency: val } : item))
                          );
                        }}
                        className="w-36 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none"
                      >
                        {BACHS_ACCEPTED_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} ({c.symbol})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price amount"
                        value={extra.amount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExtraPaywallPrices((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, amount: val } : item))
                          );
                        }}
                        className="flex-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setExtraPaywallPrices((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                        title="Remove currency"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800">Billing Type</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPlanBillingType('one_time')}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold text-center transition-all ${
                        newPlanBillingType === 'one_time'
                          ? 'border-black bg-stone-900 text-white'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      One-Time Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPlanBillingType('recurring')}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold text-center transition-all ${
                        newPlanBillingType === 'recurring'
                          ? 'border-black bg-stone-900 text-white'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      Subscription
                    </button>
                  </div>
                </div>

                {newPlanBillingType === 'recurring' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-800">Billing Frequency</label>
                    <select
                      value={newPlanBillingPeriod}
                      onChange={(e) => setNewPlanBillingPeriod(e.target.value as 'monthly' | 'yearly')}
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                )}

                <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewPaywallModal(false)}
                    className="text-xs px-3.5 py-2 font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-black text-white hover:bg-stone-800 text-xs px-4 py-2 rounded-lg font-semibold shadow-2xs"
                  >
                    {isSaving ? 'Creating...' : 'Create & Attach Paywall'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: MEMBERS */}
        {/* ==================================================================== */}
        {activeTab === 'members' && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">Enrolled Students</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  View and manage student enrollments, completion rates, and individual progress.
                </p>
              </div>
              <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-mono font-semibold text-stone-800 border border-stone-200">
                {course.enrolled_students_count ?? 0} Students
              </div>
            </div>

            <div className="mt-6 divide-y divide-stone-100">
              {course.enrolled_students_count === 0 ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  No students currently enrolled in this course.
                </div>
              ) : (
                <div className="py-4 text-xs text-stone-600">
                  {course.enrolled_students_count} active students tracked with live progress.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 7: DELIVERY FORMAT & PACING */}
        {/* ==================================================================== */}
        {activeTab === 'options' && (
          <div className="max-w-2xl space-y-6">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs space-y-6">
              <div>
                <h2 className="text-base font-bold text-stone-900">Course Delivery Format</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Select the delivery archetype for this curriculum to tailor the student experience.
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCourseFormat('video_on_demand');
                      setPacingFormat('self_paced');
                    }}
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
                    onClick={() => {
                      setCourseFormat('live_cohort');
                      setPacingFormat('scheduled');
                    }}
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

                {courseFormat === 'live_cohort' && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                        <Video className="h-4 w-4 text-blue-700" />
                        <span>Live Cohort Classroom Link & Schedule</span>
                      </div>
                      {detectedPlatform.platform !== 'custom' && (
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${detectedPlatform.badgeBg} ${detectedPlatform.badgeText}`}>
                          {detectedPlatform.name}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-stone-700 block">
                        Live Video Classroom Link (Zoom / Meet / Teams)
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

              <div className="border-t border-stone-100 pt-5">
                <h2 className="text-base font-bold text-stone-900">Lesson Pacing & Progression</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Select how students navigate through lessons in this course.
                </p>

                <form onSubmit={handleSaveOptions} className="mt-4 space-y-4">
                <div className="space-y-3">
                  {/* Format 1: Self-paced */}
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                      pacingFormat === 'self_paced'
                        ? 'border-black bg-stone-50'
                        : 'border-stone-200 hover:bg-stone-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pacingFormat"
                      value="self_paced"
                      checked={pacingFormat === 'self_paced'}
                      onChange={() => setPacingFormat('self_paced')}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-stone-900">Self-Paced</p>
                        <span className="rounded-full bg-stone-100 px-2 py-0.2 text-[9px] font-semibold text-stone-900">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Students can move through lessons at their own speed in any order. Open navigation on demand.
                      </p>
                    </div>
                  </label>

                  {/* Format 2: Structured */}
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                      pacingFormat === 'structured'
                        ? 'border-black bg-stone-50'
                        : 'border-stone-200 hover:bg-stone-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pacingFormat"
                      value="structured"
                      checked={pacingFormat === 'structured'}
                      onChange={() => setPacingFormat('structured')}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-xs font-bold text-stone-900">Structured</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Students must complete each lesson in sequence before unlocking the next one.
                      </p>
                    </div>
                  </label>

                  {/* Format 3: Scheduled */}
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-all ${
                      pacingFormat === 'scheduled'
                        ? 'border-black bg-stone-50'
                        : 'border-stone-200 hover:bg-stone-50/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pacingFormat"
                      value="scheduled"
                      checked={pacingFormat === 'scheduled'}
                      onChange={() => setPacingFormat('scheduled')}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-xs font-bold text-stone-900">Scheduled (Cohort-Based)</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Lessons unlock on set dates or relative drip schedule days after enrollment.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Sequential completion toggle */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireSequential}
                      onChange={(e) => setRequireSequential(e.target.checked)}
                      className="rounded border-stone-300"
                    />
                    <span className="text-xs font-semibold text-stone-800">
                      Require previous lesson completion to proceed
                    </span>
                  </label>
                </div>

                <div className="pt-4 border-t border-stone-100 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-black text-white hover:bg-stone-800 text-xs px-4 py-2 rounded-lg font-semibold shadow-2xs"
                  >
                    {isSaving ? 'Saving...' : 'Save pacing format'}
                  </Button>
                </div>
              </form>
            </div>
          </div>

            {/* Danger Zone: Permanent Course Deletion */}
            <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-red-900 flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span>Danger Zone: Delete Course</span>
                  </h3>
                  <p className="text-xs text-red-700/80 mt-0.5">
                    Permanently delete this course, modules, lessons, completions, assignments, and student enrollments.
                  </p>
                </div>

                {!showDeleteStudioConfirm && (
                  <Button
                    type="button"
                    onClick={() => setShowDeleteStudioConfirm(true)}
                    disabled={isDeletingCourse || isSaving}
                    className="shrink-0 bg-red-600 text-white hover:bg-red-700 text-xs px-3.5 py-1.5 rounded-xl font-bold shadow-xs transition-colors"
                  >
                    Delete Course
                  </Button>
                )}
              </div>

              {deleteCourseError && (
                <div className="rounded-xl border border-red-300 bg-red-100/90 p-2.5 text-xs text-red-800">
                  {deleteCourseError}
                </div>
              )}

              {showDeleteStudioConfirm && (
                <div className="rounded-xl border border-red-200 bg-white p-4 space-y-3 shadow-2xs">
                  <p className="text-xs font-bold text-stone-900">
                    Are you sure you want to permanently delete <span className="underline decoration-red-400 font-extrabold">{course.title}</span>?
                  </p>
                  <p className="text-[11px] text-stone-500">
                    This action is irreversible. All student progress, assignments, and curriculum materials will be permanently erased.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isDeletingCourse}
                      onClick={() => setShowDeleteStudioConfirm(false)}
                      className="text-xs rounded-xl h-8"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={isDeletingCourse}
                      onClick={handleDeleteCourseFromStudio}
                      className="bg-red-600 text-white hover:bg-red-700 text-xs rounded-xl font-bold px-3.5 h-8 transition-colors"
                    >
                      {isDeletingCourse ? 'Deleting Course...' : 'Yes, Permanently Delete'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 8: WORKFLOWS */}
        {/* ==================================================================== */}
        {activeTab === 'workflows' && (
          <div className="max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">Automation Workflows</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Trigger automated notifications, badges, or direct messages based on student milestones.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-stone-200 p-4">
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Welcome on Enrollment</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Send an automated welcoming direct message when a member enrolls.
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="rounded" />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-stone-200 p-4">
                <div>
                  <h4 className="text-xs font-bold text-stone-900">Certificate & Badge on Completion</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Award course completion XP points and notify community chat.
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="rounded" />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT SECTION */}
      {/* ==================================================================== */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">
              {editingModule ? 'Edit Section' : 'Add Course Section'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Sections group related lessons into structured syllabus modules.
            </p>

            <form onSubmit={handleSaveSection} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800">
                  Section Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Getting Started"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief overview of what students will learn in this section..."
                  value={sectionDescription}
                  onChange={(e) => setSectionDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSectionModal(false)}
                  className="text-xs px-3 py-1.5 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !sectionTitle.trim()}
                  className="bg-black text-white hover:bg-stone-800 text-xs px-4 py-1.5 rounded-lg font-semibold shadow-2xs"
                >
                  {isSaving ? 'Saving...' : editingModule ? 'Save changes' : 'Add section'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT LESSON */}
      {/* ==================================================================== */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
            <h3 className="text-base font-bold text-stone-900">
              {editingLesson ? 'Edit Lesson Settings' : 'Add New Lesson'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Add a video lesson, rich content, or interactive exercises.
            </p>

            <form onSubmit={handleSaveLesson} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800">
                  Lesson Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Welcome & Roadmap"
                  value={lessonTitle}
                  onChange={(e) => handleLessonTitleChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800">
                    Status
                  </label>
                  <select
                    value={lessonStatus}
                    onChange={(e) => setLessonStatus(e.target.value as 'draft' | 'published')}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* Lesson Image / Thumbnail */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-800">
                    Lesson Image / Thumbnail
                  </label>
                  <span className="text-[11px] text-stone-400">Optional · 16:9 recommended</span>
                </div>

                {lessonThumbnailUrl ? (
                  <div className="mt-1.5 relative rounded-xl border border-stone-200 overflow-hidden bg-stone-50 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lessonThumbnailUrl}
                      alt="Lesson preview"
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-900 shadow-sm hover:bg-stone-50">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Replace</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLessonImageFileChange}
                          disabled={isUploadingLessonImage}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setLessonThumbnailUrl('')}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/... or paste image URL"
                        value={lessonThumbnailUrl}
                        onChange={(e) => setLessonThumbnailUrl(e.target.value)}
                        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                      />
                    </div>
                    <label className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors shadow-2xs">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isUploadingLessonImage ? 'Uploading...' : 'Upload'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLessonImageFileChange}
                        disabled={isUploadingLessonImage}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800">
                  Description / Subtitle (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Quick summary of this lesson..."
                  value={lessonDescription}
                  onChange={(e) => setLessonDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800">
                  Session Replay / Recording URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="e.g. Zoom recording, YouTube Unlisted, Vimeo, Loom, or MP4 URL"
                  value={lessonReplayUrl}
                  onChange={(e) => setLessonReplayUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-stone-500">
                  Enrolled students who missed the live workshop will be able to watch this session recording.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lessonIsFreePreview}
                    onChange={(e) => setLessonIsFreePreview(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span className="text-xs font-semibold text-stone-800">
                    Free Preview (Allow non-enrolled students to watch this lesson)
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLessonModal(false)}
                  className="text-xs px-3 py-1.5 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !lessonTitle.trim()}
                  className="bg-black text-white hover:bg-stone-800 text-xs px-4 py-1.5 rounded-lg font-semibold shadow-2xs"
                >
                  {isSaving ? 'Saving...' : editingLesson ? 'Save changes' : 'Add lesson'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL / BUILDER: RICH CONTENT BLOCKS (VIDEOS, QUIZZES, MARKDOWN) */}
      {/* ==================================================================== */}
      {blockBuilderLesson && (
        <LessonBlockBuilder
          circleId={circleId}
          courseId={course.id}
          lesson={blockBuilderLesson}
          isOpen={Boolean(blockBuilderLesson)}
          onClose={() => setBlockBuilderLesson(null)}
          onSaveSuccess={(_updatedLesson) => {
            setBlockBuilderLesson(null);
            showFeedback('success', 'Lesson content blocks saved.');
            refreshCourse();
          }}
        />
      )}
    </div>
  );
}
