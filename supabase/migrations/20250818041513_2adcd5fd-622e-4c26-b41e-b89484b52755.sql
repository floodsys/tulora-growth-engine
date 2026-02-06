-- Insert sample agent profiles for testing
-- First create a sample organization and user (idempotent)
INSERT INTO public.organizations (id, name, slug) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Organization', 'demo-org')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample agent profiles
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
  '00000000-0000-0000-0000-000000000001',
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
  '00000000-0000-0000-0000-000000000001',
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
  '00000000-0000-0000-0000-000000000001',
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
ON CONFLICT (id) DO NOTHING;
