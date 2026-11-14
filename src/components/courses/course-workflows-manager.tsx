'use client';

import React, { useState, useEffect } from 'react';
import {
  Workflow,
  Calendar,
  Clock,
  Video,
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  Send,
  Save,
  RotateCcw,
  Sparkles,
  Award,
  Mail,
  Shield,
  Layers,
  RefreshCw,
} from 'lucide-react';
import {
  CourseItem,
  CourseWorkflowSettings,
  CourseWorkflowLogItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';

interface CourseWorkflowsManagerProps {
  circleId: string;
  circleSlug: string;
  course: CourseItem;
  isStaff: boolean;
}

export function CourseWorkflowsManager({
  circleId,
  circleSlug: _circleSlug,
  course,
  isStaff: _isStaff,
}: CourseWorkflowsManagerProps) {
  const [settings, setSettings] = useState<CourseWorkflowSettings>(() => course.workflow_settings || {
    liveSessionReminders: { enabled24h: true, enabled15m: true },
    replayAlerts: { enabled: true },
    assignmentDeadlines: { enabled24h: true, enabled3h: true, enabledGracePeriod: true },
    assignmentFeedback: { enabled: true },
    weeklyRhythm: {
      enabledMondayKickoff: true,
      mondayKickoffTime: '09:00',
      enabledFridayScorecard: true,
      fridayScorecardTime: '16:00',
    },
  });

  const [logs, setLogs] = useState<CourseWorkflowLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Fetch current settings & logs from API
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/circles/${circleId}/courses/${course.id}/workflows`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          if (data.settings) setSettings(data.settings);
          if (data.logs) setLogs(data.logs);
        }
      } catch {
        // Fallback to initial course.workflow_settings
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [circleId, course.id]);

  function showMessage(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  }

  async function handleSaveSettings() {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}/workflows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save workflow settings.');
      if (data.settings) setSettings(data.settings);
      showMessage('success', 'Workflow settings saved successfully.');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRunDispatcher() {
    setIsDispatching(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispatch' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch workflow reminders.');

      const stats = data.stats;
      const totalSent =
        (stats.liveSession24hSent || 0) +
        (stats.liveSession15mSent || 0) +
        (stats.assignment24hSent || 0) +
        (stats.assignment3hSent || 0) +
        (stats.assignmentGracePeriodSent || 0) +
        (stats.mondayKickoffSent || 0) +
        (stats.fridayScorecardSent || 0);

      showMessage(
        'success',
        totalSent > 0
          ? `Dispatched ${totalSent} reminders (${stats.liveSession24hSent} live 24h, ${stats.liveSession15mSent} live 15m, ${stats.assignment24hSent} assignment 24h, ${stats.assignment3hSent} assignment 3h, ${stats.mondayKickoffSent} Monday digests).`
          : 'Workflow check complete. All enrolled students are currently up to date with zero pending reminders.'
      );

      // Refresh logs
      const logsRes = await fetch(`/api/circles/${circleId}/courses/${course.id}/workflows`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.logs) setLogs(logsData.logs);
      }
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Error running dispatcher.');
    } finally {
      setIsDispatching(false);
    }
  }

  async function handleSendTest(workflowType: string) {
    setTestingType(workflowType);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses/${course.id}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', workflowType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test preview.');
      showMessage(
        'success',
        `Test preview sent! Check your notification drawer and email inbox for "${data.test?.previewTitle}".`
      );

      // Refresh logs
      const logsRes = await fetch(`/api/circles/${circleId}/courses/${course.id}/workflows`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.logs) setLogs(logsData.logs);
      }
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Unable to send test preview.');
    } finally {
      setTestingType(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Banner & Action Controls */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-xs">
              <Workflow className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Course Automations & Workflows
              </h2>
              <p className="text-xs text-stone-500">
                Multi-channel email and in-app notifications for live cohort sessions, assignment deadlines, and weekly student digests.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={isDispatching}
              onClick={handleRunDispatcher}
              className="rounded-xl text-xs h-9 font-semibold text-stone-700 hover:text-stone-900 border-stone-200 shadow-2xs"
            >
              <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${isDispatching ? 'animate-spin' : ''}`} />
              <span>{isDispatching ? 'Dispatching...' : 'Run Reminder Check Now'}</span>
            </Button>

            <Button
              type="button"
              disabled={isSaving}
              onClick={handleSaveSettings}
              className="rounded-xl text-xs h-9 font-semibold bg-stone-900 hover:bg-black text-white px-4 shadow-2xs"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Workflow Settings'}</span>
            </Button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 rounded-xl border p-3 text-xs font-medium flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Grid of Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ================================================================= */}
        {/* 1. LIVE COHORT SESSION REMINDERS */}
        {/* ================================================================= */}
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <Video className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Live Cohort Sessions
                </h3>
                <p className="text-[11px] text-stone-500">
                  Luma-style workshop notices & 1-click meeting join
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {/* 24h Reminder */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-stone-600" />
                    24h Workshop Prep & Calendar Sync
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.liveSessionReminders?.enabled24h)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        liveSessionReminders: {
                          ...prev.liveSessionReminders!,
                          enabled24h: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Sends prep requirements, schedule overview, and Google Calendar / Outlook sync link 24 hours before each workshop.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testingType === 'live_session_24h'}
                    onClick={() => handleSendTest('live_session_24h')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingType === 'live_session_24h' ? 'Sending...' : 'Test Preview'}</span>
                  </button>
                </div>
              </div>

              {/* 15m Urgent Reminder */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    15-Minute &quot;Starting Soon&quot; Urgent Alert
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.liveSessionReminders?.enabled15m)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        liveSessionReminders: {
                          ...prev.liveSessionReminders!,
                          enabled15m: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Sends high-priority email &amp; in-app alert with a prominent 1-click button to jump directly into the live Google Meet or Zoom room.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testingType === 'live_session_15m'}
                    onClick={() => handleSendTest('live_session_15m')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingType === 'live_session_15m' ? 'Sending...' : 'Test Preview'}</span>
                  </button>
                </div>
              </div>

              {/* Post-Session Replay Alert */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5 text-emerald-600" />
                    Session Replay &amp; Notes Published
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.replayAlerts?.enabled)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        replayAlerts: { enabled: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Automatically alerts enrolled cohort students the moment a recording replay link is added to any live workshop lesson.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testingType === 'session_replay'}
                    onClick={() => handleSendTest('session_replay')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingType === 'session_replay' ? 'Sending...' : 'Test Preview'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. ASSIGNMENT & PROJECT DEADLINES */}
        {/* ================================================================= */}
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Assignment Deadlines
                </h3>
                <p className="text-[11px] text-stone-500">
                  Smart non-submitter targeting &amp; feedback alerts
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {/* 24h Deadline Reminder */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                    24-Hour Due Date Reminder
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.assignmentDeadlines?.enabled24h)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        assignmentDeadlines: {
                          ...prev.assignmentDeadlines!,
                          enabled24h: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Friendly prompt sent <strong>only to enrolled students who have NOT submitted yet</strong> 24 hours before the homework due date.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testingType === 'assignment_deadline_24h'}
                    onClick={() => handleSendTest('assignment_deadline_24h')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingType === 'assignment_deadline_24h' ? 'Sending...' : 'Test Preview'}</span>
                  </button>
                </div>
              </div>

              {/* 3h Final Countdown */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    3-Hour Final Countdown
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.assignmentDeadlines?.enabled3h)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        assignmentDeadlines: {
                          ...prev.assignmentDeadlines!,
                          enabled3h: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Final countdown with 1-click submit button sent 3 hours before the deadline to non-submitters.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testingType === 'assignment_deadline_3h'}
                    onClick={() => handleSendTest('assignment_deadline_3h')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingType === 'assignment_deadline_3h' ? 'Sending...' : 'Test Preview'}</span>
                  </button>
                </div>
              </div>

              {/* Grace Period & Feedback Alert */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-emerald-600" />
                    Grading &amp; Instructor Feedback Alert
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.assignmentFeedback?.enabled)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        assignmentFeedback: { enabled: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Instantly delivers an email &amp; in-app notification to the student the moment staff reviews and grades their assignment.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testingType === 'assignment_feedback'}
                    onClick={() => handleSendTest('assignment_feedback')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingType === 'assignment_feedback' ? 'Sending...' : 'Test Preview'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. COHORT RHYTHM & WEEKLY DIGESTS */}
        {/* ================================================================= */}
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Cohort Weekly Rhythm
                </h3>
                <p className="text-[11px] text-stone-500">
                  Monday roadmap kickoffs &amp; Friday scorecards
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {/* Monday Kickoff */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                    Monday Weekly Roadmap Kickoff
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.weeklyRhythm?.enabledMondayKickoff)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        weeklyRhythm: {
                          ...prev.weeklyRhythm!,
                          enabledMondayKickoff: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Sends students an overview of this week&apos;s upcoming live sessions, syllabus topics, and assignments due by Friday.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testingType === 'monday_kickoff'}
                    onClick={() => handleSendTest('monday_kickoff')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingType === 'monday_kickoff' ? 'Sending...' : 'Test Preview'}</span>
                  </button>
                </div>
              </div>

              {/* Friday Progress Scorecard */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-amber-600" />
                    Friday Progress Scorecard &amp; XP Digest
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.weeklyRhythm?.enabledFridayScorecard)}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        weeklyRhythm: {
                          ...prev.weeklyRhythm!,
                          enabledFridayScorecard: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded-md border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Sends personalized student scorecards with completion percentage, lesson tally, and weekend study prompts.
                </p>
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    disabled={testingType === 'friday_scorecard'}
                    onClick={() => handleSendTest('friday_scorecard')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                  >
                    <Send className="h-3 w-3" />
                    <span>{testingType === 'friday_scorecard' ? 'Sending...' : 'Test Preview'}</span>
                  </button>
                </div>
              </div>

              {/* Multi-Channel Status Indicator */}
              <div className="rounded-2xl border border-stone-200 bg-white p-3.5 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-stone-500" />
                  Delivery Channels Active
                </span>
                <p className="text-[11px] text-stone-500">
                  All active reminders are synchronized across <strong>In-App Notifications</strong> and <strong>Transactional Email (Resend)</strong> with safe idempotency tracking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. WORKFLOW EXECUTION & DELIVERY AUDIT LOGS */}
      {/* ===================================================================== */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-800">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Recent Automation Delivery Logs
              </h3>
              <p className="text-xs text-stone-500">
                Idempotent execution records tracking delivered emails and in-app alerts.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-700">
            {logs.length} logged events
          </span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-stone-500">
            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-stone-400 mb-2" />
            Loading workflow logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
              <Mail className="h-5 w-5" />
            </span>
            <p className="text-xs font-semibold text-stone-700">
              No automated reminders delivered yet.
            </p>
            <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
              Click &quot;Run Reminder Check Now&quot; above or click &quot;Test Preview&quot; on any workflow card to dispatch test notifications.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200/60 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Workflow Event</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Delivered At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-800">
                {logs.map((log) => {
                  const labelMap: Record<string, string> = {
                    live_session_24h: '📅 Live Workshop 24h Prep',
                    live_session_15m: '🚨 Live Workshop 15m Join',
                    session_replay: '📹 Session Replay Alert',
                    assignment_deadline_24h: '📝 Assignment 24h Due Date',
                    assignment_deadline_3h: '⏳ Assignment 3h Countdown',
                    assignment_grace_period: '⚠️ Assignment Grace Period',
                    assignment_feedback: '🎉 Assignment Graded Feedback',
                    monday_kickoff: '🚀 Monday Weekly Roadmap',
                    friday_scorecard: '📊 Friday Scorecard Digest',
                  };

                  const cleanType = labelMap[log.workflow_type] || log.workflow_type;

                  return (
                    <tr key={log.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-800">
                            {log.recipient?.display_name?.slice(0, 1).toUpperCase() || 'M'}
                          </span>
                          <span className="font-semibold text-stone-900">
                            {log.recipient?.display_name || 'Member'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-stone-900">
                        {cleanType}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-stone-600">
                        <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                          <Mail className="h-3 w-3" />
                          <span>Email &amp; In-App</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Delivered</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-[11px] text-stone-500 whitespace-nowrap">
                        {new Date(log.delivered_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
