-- 0042_course_workflows_and_reminders.sql
-- Add workflow settings to courses and create course_workflow_logs for idempotent delivery of reminders and digests

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS workflow_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Course Workflow Delivery Logs (Guarantees Idempotency across reminders)
CREATE TABLE IF NOT EXISTS public.course_workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL,
  entity_id TEXT,
  channel TEXT NOT NULL DEFAULT 'both',
  status TEXT NOT NULL DEFAULT 'delivered',
  metadata JSONB DEFAULT '{}'::jsonb,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_workflow_log UNIQUE(course_id, recipient_id, workflow_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_course_workflow_logs_course ON public.course_workflow_logs(course_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_workflow_logs_recipient ON public.course_workflow_logs(recipient_id, delivered_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_workflow_logs TO anon, authenticated, service_role;

ALTER TABLE public.course_workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_workflow_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY course_workflow_logs_service_all ON public.course_workflow_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY course_workflow_logs_select ON public.course_workflow_logs
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.circle_memberships cm
      WHERE cm.circle_id = course_workflow_logs.circle_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'moderator')
    )
  );

CREATE POLICY course_workflow_logs_insert ON public.course_workflow_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.circle_memberships cm
      WHERE cm.circle_id = course_workflow_logs.circle_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'moderator')
    )
  );

-- Expand notifications event_type check constraint if present
DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', con_name);
  END LOOP;
END
$$;
