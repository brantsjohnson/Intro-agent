-- Agent activity feed + run queue (laptop CLI agent <-> HQ UI)

CREATE TABLE public.agent_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- run_started | draft | send | run_finished | error | info
  title TEXT NOT NULL,
  body TEXT,
  meta JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agent_updates_created_at_idx ON public.agent_updates (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_updates TO anon, authenticated;
GRANT ALL ON public.agent_updates TO service_role;

CREATE TABLE public.agent_run_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'draft', -- draft | send
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | error
  event_url TEXT, -- optional single-event override
  note TEXT,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX agent_run_requests_status_idx ON public.agent_run_requests (status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_run_requests TO anon, authenticated;
GRANT ALL ON public.agent_run_requests TO service_role;
