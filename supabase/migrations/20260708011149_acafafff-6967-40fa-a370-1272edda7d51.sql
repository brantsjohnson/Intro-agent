
-- Wipe data
TRUNCATE public.tasks, public.source_notes, public.project_memory, public.open_loops,
  public.contacts, public.content_drafts, public.content_channels, public.daily_checklists,
  public.projects RESTART IDENTITY CASCADE;

-- Drop signup trigger/function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Helper: drop all policies + user_id + disable RLS on a table
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'projects','tasks','source_notes','project_memory','open_loops','contacts',
    'content_channels','content_drafts','daily_checklists'
  ]) LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS user_id', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- daily_checklists: unique on date only (was user_id + date)
ALTER TABLE public.daily_checklists DROP CONSTRAINT IF EXISTS daily_checklists_user_id_date_key;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_checklists_date_key') THEN
    ALTER TABLE public.daily_checklists ADD CONSTRAINT daily_checklists_date_key UNIQUE (date);
  END IF;
END $$;

-- Seed defaults so the app has projects and channels out of the box
INSERT INTO public.projects (name, slug, description, color) VALUES
  ('Intro', 'intro', 'Networking analytics layer for events', '#6366f1'),
  ('Bridger', 'bridger', 'Consumer social app, anti-doomscrolling', '#10b981'),
  ('Filibusters', 'filibusters', 'Podcast / political content', '#f59e0b'),
  ('Other Ideas', 'other', 'Catch-all for new thinking', '#64748b');

INSERT INTO public.content_channels (name, kind, voice, tone) VALUES
  ('Brant Personal LinkedIn', 'linkedin_personal',
    'Brant''s voice', 'thoughtful, plainspoken, slightly vulnerable, founder energy'),
  ('Intro Company LinkedIn', 'linkedin_company',
    'polished, direct, credible', 'B2B, sponsor/event/university focused'),
  ('Bridger Posts', 'other',
    'consumer, nostalgic, anti-doomscrolling', 'warm, plain, anti-corporate'),
  ('Filibusters Posts', 'other',
    'sharp, curious, debunking', 'punchy, researched');
