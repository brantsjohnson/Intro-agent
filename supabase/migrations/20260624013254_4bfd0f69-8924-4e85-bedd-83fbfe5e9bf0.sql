
-- Updated-at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  -- instruction fields
  voice TEXT,
  tone TEXT,
  audience TEXT,
  goals TEXT,
  phrases_use TEXT,
  phrases_avoid TEXT,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER projects_upd BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONTENT CHANNELS
CREATE TABLE public.content_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'linkedin_personal', -- linkedin_personal | linkedin_company | other
  voice TEXT,
  tone TEXT,
  phrases_use TEXT,
  phrases_avoid TEXT,
  project_id UUID REFERENCES public.projects ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.content_channels TO authenticated;
GRANT ALL ON public.content_channels TO service_role;
ALTER TABLE public.content_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own channels" ON public.content_channels FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER channels_upd BEFORE UPDATE ON public.content_channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SOURCE NOTES (raw dump inbox)
CREATE TABLE public.source_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  source TEXT, -- apple_notes, chatgpt, claude, voice, meeting, other
  project_id UUID REFERENCES public.projects ON DELETE SET NULL,
  classification TEXT, -- task | memory | crm | content_idea | decision | open_question | follow_up | archive
  summary TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  ai_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.source_notes TO authenticated;
GRANT ALL ON public.source_notes TO service_role;
ALTER TABLE public.source_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.source_notes FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER notes_upd BEFORE UPDATE ON public.source_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PROJECT MEMORY
CREATE TABLE public.project_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects ON DELETE CASCADE,
  source_note_id UUID REFERENCES public.source_notes ON DELETE SET NULL,
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_memory TO authenticated;
GRANT ALL ON public.project_memory TO service_role;
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memory" ON public.project_memory FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER memory_upd BEFORE UPDATE ON public.project_memory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects ON DELETE SET NULL,
  source_note_id UUID REFERENCES public.source_notes ON DELETE SET NULL,
  title TEXT NOT NULL,
  detail TEXT,
  type TEXT DEFAULT 'general', -- content | crm | product | research | admin | decision | follow_up | general
  priority TEXT DEFAULT 'medium', -- low | medium | high
  status TEXT DEFAULT 'open', -- open | doing | done | dropped
  due_date DATE,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.tasks FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER tasks_upd BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONTACTS (CRM)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  email TEXT,
  linkedin_url TEXT,
  project_id UUID REFERENCES public.projects ON DELETE SET NULL,
  relationship_type TEXT, -- investor, customer, university, sponsor, advisor, friend, contributor
  status TEXT DEFAULT 'warm', -- warm | active | waiting | cold | closed
  last_interaction_at DATE,
  last_topic TEXT,
  they_care_about TEXT,
  i_promised TEXT,
  next_followup_date DATE,
  suggested_followup TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts" ON public.contacts FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER contacts_upd BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONTENT DRAFTS
CREATE TABLE public.content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  channel_id UUID REFERENCES public.content_channels ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects ON DELETE SET NULL,
  source_note_id UUID REFERENCES public.source_notes ON DELETE SET NULL,
  title TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'idea', -- idea | drafted | approved | posted
  scheduled_at TIMESTAMPTZ,
  posted_url TEXT,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.content_drafts TO authenticated;
GRANT ALL ON public.content_drafts TO service_role;
ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drafts" ON public.content_drafts FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER drafts_upd BEFORE UPDATE ON public.content_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- OPEN LOOPS
CREATE TABLE public.open_loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects ON DELETE SET NULL,
  source_note_id UUID REFERENCES public.source_notes ON DELETE SET NULL,
  question TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open | decided | dropped
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.open_loops TO authenticated;
GRANT ALL ON public.open_loops TO service_role;
ALTER TABLE public.open_loops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loops" ON public.open_loops FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER loops_upd BEFORE UPDATE ON public.open_loops FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DAILY CHECKLISTS
CREATE TABLE public.daily_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payload JSONB NOT NULL, -- structured: tasks[], posts[], followups[], openLoops[], thoughts[]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.daily_checklists TO authenticated;
GRANT ALL ON public.daily_checklists TO service_role;
ALTER TABLE public.daily_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklists" ON public.daily_checklists FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- Auto-seed default projects + channels on new user
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.projects (user_id, name, slug, description, color) VALUES
    (NEW.id, 'Intro', 'intro', 'Networking analytics layer for events', '#6366f1'),
    (NEW.id, 'Bridger', 'bridger', 'Consumer social app, anti-doomscrolling', '#10b981'),
    (NEW.id, 'Filibusters', 'filibusters', 'Podcast / political content', '#f59e0b'),
    (NEW.id, 'Other Ideas', 'other', 'Catch-all for new thinking', '#64748b');

  INSERT INTO public.content_channels (user_id, name, kind, voice, tone) VALUES
    (NEW.id, 'Brant Personal LinkedIn', 'linkedin_personal',
      'Brant''s voice', 'thoughtful, plainspoken, slightly vulnerable, founder energy'),
    (NEW.id, 'Intro Company LinkedIn', 'linkedin_company',
      'polished, direct, credible', 'B2B, sponsor/event/university focused'),
    (NEW.id, 'Bridger Posts', 'other',
      'consumer, nostalgic, anti-doomscrolling', 'warm, plain, anti-corporate'),
    (NEW.id, 'Filibusters Posts', 'other',
      'sharp, curious, debunking', 'punchy, researched');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
