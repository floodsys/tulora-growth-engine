-- Create helper function to check if organization is active
CREATE OR REPLACE FUNCTION public.is_org_active(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT suspension_status = 'active'
  FROM public.organizations
  WHERE id = p_org_id;
$function$;

-- Add defense-in-depth RLS policies for organization_invitations
-- These policies ensure invitations can only be managed when org is active
DROP POLICY IF EXISTS "organization_invitations_insert_active_only" ON public.organization_invitations;
CREATE POLICY "organization_invitations_insert_active_only" 
ON public.organization_invitations 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND
  (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = organization_invitations.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = organization_invitations.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  )
);

DROP POLICY IF EXISTS "organization_invitations_update_active_only" ON public.organization_invitations;
CREATE POLICY "organization_invitations_update_active_only" 
ON public.organization_invitations 
FOR UPDATE 
USING (
  is_org_active(organization_id) AND
  (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = organization_invitations.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = organization_invitations.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  )
)
WITH CHECK (
  is_org_active(organization_id) AND
  (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = organization_invitations.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = organization_invitations.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  )
);

DROP POLICY IF EXISTS "organization_invitations_delete_active_only" ON public.organization_invitations;
CREATE POLICY "organization_invitations_delete_active_only" 
ON public.organization_invitations 
FOR DELETE 
USING (
  is_org_active(organization_id) AND
  (
    EXISTS (
      SELECT 1 FROM public.organizations 
      WHERE id = organization_invitations.organization_id 
        AND owner_user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE organization_id = organization_invitations.organization_id 
        AND user_id = auth.uid() 
        AND role = 'admin'::org_role 
        AND seat_active = true
    )
  )
);

-- Add defense-in-depth RLS policies for agent operations
-- Prevent agent creation/updates when org is suspended/canceled
DROP POLICY IF EXISTS "agent_profiles_insert_active_only" ON public.agent_profiles;
CREATE POLICY "agent_profiles_insert_active_only" 
ON public.agent_profiles 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

DROP POLICY IF EXISTS "agent_profiles_update_active_only" ON public.agent_profiles;
CREATE POLICY "agent_profiles_update_active_only" 
ON public.agent_profiles 
FOR UPDATE 
USING (
  is_org_active(organization_id) AND is_org_member(organization_id)
)
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

-- Add defense-in-depth RLS policies for calls (operational activity)
-- Prevent call creation when org is suspended/canceled
DROP POLICY IF EXISTS "calls_insert_active_only" ON public.calls;
CREATE POLICY "calls_insert_active_only" 
ON public.calls 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

DROP POLICY IF EXISTS "calls_update_active_only" ON public.calls;
CREATE POLICY "calls_update_active_only" 
ON public.calls 
FOR UPDATE 
USING (
  is_org_active(organization_id) AND is_org_member(organization_id)
)
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

-- Add defense-in-depth RLS policies for usage events (API usage logging)
-- Prevent usage logging when org is suspended/canceled
DROP POLICY IF EXISTS "usage_events_insert_active_only" ON public.usage_events;
CREATE POLICY "usage_events_insert_active_only" 
ON public.usage_events 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

-- Add defense-in-depth RLS policies for leads (operational data)
-- Prevent lead creation when org is suspended/canceled  
DROP POLICY IF EXISTS "leads_insert_active_only" ON public.leads;
CREATE POLICY "leads_insert_active_only" 
ON public.leads 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

DROP POLICY IF EXISTS "leads_update_active_only" ON public.leads;
CREATE POLICY "leads_update_active_only" 
ON public.leads 
FOR UPDATE 
USING (
  is_org_active(organization_id) AND is_org_member(organization_id)
)
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

-- Add defense-in-depth RLS policies for appointments (operational activity)
-- Prevent appointment creation when org is suspended/canceled
DROP POLICY IF EXISTS "appointments_insert_active_only" ON public.appointments;
CREATE POLICY "appointments_insert_active_only" 
ON public.appointments 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

DROP POLICY IF EXISTS "appointments_update_active_only" ON public.appointments;
CREATE POLICY "appointments_update_active_only" 
ON public.appointments 
FOR UPDATE 
USING (
  is_org_active(organization_id) AND is_org_member(organization_id)
)
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

-- Add defense-in-depth RLS policies for knowledge base operations
-- Prevent KB file operations when org is suspended/canceled
DROP POLICY IF EXISTS "kb_files_insert_active_only" ON public.kb_files;
CREATE POLICY "kb_files_insert_active_only" 
ON public.kb_files 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

DROP POLICY IF EXISTS "kb_files_update_active_only" ON public.kb_files;
CREATE POLICY "kb_files_update_active_only" 
ON public.kb_files 
FOR UPDATE 
USING (
  is_org_active(organization_id) AND is_org_member(organization_id)
)
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

-- Add defense-in-depth RLS policies for embeddings
-- Prevent embedding operations when org is suspended/canceled
DROP POLICY IF EXISTS "embeddings_insert_active_only" ON public.embeddings;
CREATE POLICY "embeddings_insert_active_only" 
ON public.embeddings 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

DROP POLICY IF EXISTS "embeddings_update_active_only" ON public.embeddings;
CREATE POLICY "embeddings_update_active_only" 
ON public.embeddings 
FOR UPDATE 
USING (
  is_org_active(organization_id) AND is_org_member(organization_id)
)
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

-- Add defense-in-depth RLS policies for messages (operational activity)
-- Prevent message creation when org is suspended/canceled
DROP POLICY IF EXISTS "messages_insert_active_only" ON public.messages;
CREATE POLICY "messages_insert_active_only" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);

DROP POLICY IF EXISTS "messages_update_active_only" ON public.messages;
CREATE POLICY "messages_update_active_only" 
ON public.messages 
FOR UPDATE 
USING (
  is_org_active(organization_id) AND is_org_member(organization_id)
)
WITH CHECK (
  is_org_active(organization_id) AND is_org_member(organization_id)
);