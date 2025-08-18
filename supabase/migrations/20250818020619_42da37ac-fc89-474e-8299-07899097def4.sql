-- 1) memberships.status (required by our policies/functions)
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_memberships_user_status
  ON public.memberships(user_id, status);

-- 2) Enable RLS on all org-scoped tables (policies only work if RLS is ON)
ALTER TABLE public.organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_files       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings     ENABLE ROW LEVEL SECURITY;