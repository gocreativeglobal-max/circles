-- Migration 0026: Link Polls directly to Discussion Posts (WhatsApp/Telegram style inline polls)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES public.circle_polls(id) ON DELETE SET NULL;

ALTER TABLE public.circle_polls
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_posts_poll ON public.posts(poll_id) WHERE poll_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circle_polls_post ON public.circle_polls(post_id) WHERE post_id IS NOT NULL;

COMMENT ON COLUMN public.posts.poll_id IS 'Optional poll attached directly to this discussion post (WhatsApp/Telegram style).';
COMMENT ON COLUMN public.circle_polls.post_id IS 'Optional discussion post this poll was published into.';
