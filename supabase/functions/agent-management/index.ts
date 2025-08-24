import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'
import { requireOrgActive, createBlockedResponse } from '../_shared/org-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AgentRequest {
  action: 'created' | 'updated' | 'published' | 'deleted';
  organizationId: string;
  agentId: string;
  agentName?: string;
  changes?: any;
}

interface FileRequest {
  action: 'uploaded' | 'deleted';
  organizationId: string;
  fileId: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { type } = body; // 'agent' or 'file'

    // Extract organizationId for guard check
    const organizationId = body.organizationId;
    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check organization status before proceeding
    const guardResult = await requireOrgActive({
      organizationId,
      action: `agent_management.${type}`,
      path: '/agent-management',
      method: req.method,
      actorUserId: user.id,
      supabase
    });

    if (!guardResult.ok) {
      return createBlockedResponse(guardResult, corsHeaders);
    }

    let auditAction;
    let auditTargetType;
    let auditTargetId;
    let auditMetadata = {};

    if (type === 'agent') {
      const { action, organizationId, agentId, agentName, changes }: AgentRequest = body;
      
      auditTargetType = 'agent';
      auditTargetId = agentId;
      
      switch (action) {
        case 'created':
          auditAction = 'agent.created';
          auditMetadata = {
            agent_name: agentName,
            created_at: new Date().toISOString()
          };
          break;

        case 'updated':
          auditAction = 'agent.updated';
          auditMetadata = {
            agent_name: agentName,
            changes: changes || {},
            updated_at: new Date().toISOString()
          };
          break;

        case 'published':
          auditAction = 'agent.published';
          auditMetadata = {
            agent_name: agentName,
            published_at: new Date().toISOString()
          };
          break;

        case 'deleted':
          auditAction = 'agent.deleted';
          auditMetadata = {
            agent_name: agentName,
            deleted_at: new Date().toISOString()
          };
          break;

        default:
          return new Response(
            JSON.stringify({ error: 'Invalid agent action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }

      // Log the audit event
      await supabase.rpc('log_event', {
        p_org_id: organizationId,
        p_action: auditAction,
        p_target_type: auditTargetType,
        p_target_id: auditTargetId,
        p_status: 'success',
        p_metadata: auditMetadata
      });

    } else if (type === 'file') {
      const { action, organizationId, fileId, fileName, fileSize, fileType }: FileRequest = body;
      
      auditTargetType = 'file';
      auditTargetId = fileId;
      
      switch (action) {
        case 'uploaded':
          auditAction = 'file.uploaded';
          auditMetadata = {
            file_name: fileName,
            file_size: fileSize,
            file_type: fileType,
            uploaded_at: new Date().toISOString()
          };
          break;

        case 'deleted':
          auditAction = 'file.deleted';
          auditMetadata = {
            file_name: fileName,
            deleted_at: new Date().toISOString()
          };
          break;

        default:
          return new Response(
            JSON.stringify({ error: 'Invalid file action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }

      // Log the audit event
      await supabase.rpc('log_event', {
        p_org_id: organizationId,
        p_action: auditAction,
        p_target_type: auditTargetType,
        p_target_id: auditTargetId,
        p_status: 'success',
        p_metadata: auditMetadata
      });

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be "agent" or "file"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Agent/file management error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});