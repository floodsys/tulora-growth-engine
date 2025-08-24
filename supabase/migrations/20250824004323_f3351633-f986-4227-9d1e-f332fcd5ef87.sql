-- Create internal test logs table for test outcomes (separate from customer analytics)
CREATE TABLE public.test_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id),
  test_type TEXT NOT NULL CHECK (test_type IN ('smoke', 'full')),
  test_suite TEXT NOT NULL,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'error')),
  message TEXT,
  details JSONB DEFAULT '{}',
  duration_ms INTEGER,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  environment TEXT DEFAULT 'unknown',
  git_commit TEXT,
  test_runner TEXT DEFAULT 'web'
);

-- Enable RLS
ALTER TABLE public.test_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for test logs (admin only access)
CREATE POLICY "Test logs are viewable by org admins" 
ON public.test_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.organizations 
    WHERE id = test_logs.organization_id 
      AND owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = test_logs.organization_id 
      AND user_id = auth.uid() 
      AND role::text = 'admin'
      AND seat_active = true
  )
);

CREATE POLICY "Test logs can be created by authenticated users" 
ON public.test_logs 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for performance
CREATE INDEX idx_test_logs_session ON public.test_logs(test_session_id);
CREATE INDEX idx_test_logs_org_created ON public.test_logs(organization_id, created_at DESC);
CREATE INDEX idx_test_logs_type_status ON public.test_logs(test_type, status);

-- Create function to log test outcome
CREATE OR REPLACE FUNCTION public.log_test_outcome(
  p_session_id UUID,
  p_org_id UUID,
  p_test_type TEXT,
  p_test_suite TEXT,
  p_test_name TEXT,
  p_status TEXT,
  p_message TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_duration_ms INTEGER DEFAULT NULL,
  p_environment TEXT DEFAULT 'web',
  p_git_commit TEXT DEFAULT NULL,
  p_test_runner TEXT DEFAULT 'web'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.test_logs (
    test_session_id,
    organization_id,
    test_type,
    test_suite,
    test_name,
    status,
    message,
    details,
    duration_ms,
    user_id,
    environment,
    git_commit,
    test_runner
  ) VALUES (
    p_session_id,
    p_org_id,
    p_test_type,
    p_test_suite,
    p_test_name,
    p_status,
    p_message,
    p_details,
    p_duration_ms,
    auth.uid(),
    p_environment,
    p_git_commit,
    p_test_runner
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;