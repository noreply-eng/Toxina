-- ============================================================================
-- Migration: Ensure bucket_list table & RLS policies exist (100% Idempotent)
-- Safe to run directly in Supabase SQL Editor or via `supabase db push`
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bucket_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bucket_list_user_created
  ON public.bucket_list (user_id, created_at DESC);

ALTER TABLE public.bucket_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bucket list" ON public.bucket_list;
CREATE POLICY "Users can view their own bucket list"
  ON public.bucket_list
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bucket list" ON public.bucket_list;
CREATE POLICY "Users can insert their own bucket list"
  ON public.bucket_list
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bucket list" ON public.bucket_list;
CREATE POLICY "Users can update their own bucket list"
  ON public.bucket_list
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bucket list" ON public.bucket_list;
CREATE POLICY "Users can delete their own bucket list"
  ON public.bucket_list
  FOR DELETE
  USING (auth.uid() = user_id);
