-- Insert sample agent profiles for testing
-- First create a sample organization and user (idempotent)
WITH demo_org AS (
  INSERT INTO public.organizations (id, name, slug) 
  VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Organization', 'demo-org')
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name
  RETURNING id
)
-- Insert sample agent profiles (idempotent)
INSERT INTO public.agent_profiles (
  id,
  organization_id,
  name,
  retell_agent_id,
  status,
  is_default,
  first_message_mode,
  first_message,
  system_prompt,
  voice,
  language,
  temperature,
  max_tokens,
  call_recording_enabled,
  warm_transfer_enabled,
  transfer_number,
  settings
) VALUES 
(
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM demo_org),
  'Sales Agent Pro',
  'agent_12345abcde',
  'active',
  true,
  'assistant_speaks',
  'Hello! I''m here to help you with your sales inquiries. How can I assist you today?',
  'You are a professional sales agent. Be friendly, persuasive, and focus on identifying customer needs.',
  'alloy',
  'en',
  0.7,
  150,
  true,
  true,
  '+15550100',
  '{"custom_settings": {"priority": "high"}}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000002',
  (SELECT id FROM demo_org),
  'Lead Qualifier',
  'agent_67890fghij',
  'active',
  false,
  'assistant_waits',
  null,
  'You are a lead qualification specialist. Ask targeted questions to determine if prospects are qualified leads.',
  'echo',
  'en',
  0.5,
  100,
  true,
  false,
  null,
  '{}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000003',
  (SELECT id FROM demo_org),
  'Follow-up Specialist',
  'agent_klmno12345',
  'disabled',
  false,
  'model_generated',
  null,
  'You are a follow-up specialist. Be persistent but polite in following up on previous conversations.',
  'fable',
  'en',
  0.6,
  120,
  false,
  false,
  null,
  '{"follow_up_settings": {"max_attempts": 3}}'::jsonb
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      retell_agent_id = EXCLUDED.retell_agent_id,
      status = EXCLUDED.status,
      is_default = EXCLUDED.is_default,
      first_message_mode = EXCLUDED.first_message_mode,
      first_message = EXCLUDED.first_message,
      system_prompt = EXCLUDED.system_prompt,
      voice = EXCLUDED.voice,
      language = EXCLUDED.language,
      temperature = EXCLUDED.temperature,
      max_tokens = EXCLUDED.max_tokens,
      call_recording_enabled = EXCLUDED.call_recording_enabled,
      warm_transfer_enabled = EXCLUDED.warm_transfer_enabled,
      transfer_number = EXCLUDED.transfer_number,
      settings = EXCLUDED.settings;
