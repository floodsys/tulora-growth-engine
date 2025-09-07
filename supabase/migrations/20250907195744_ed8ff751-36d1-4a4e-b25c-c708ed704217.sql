-- Seed plan_configs with the six specified plans
-- Four purchasable plans + two enterprise (Contact Sales) plans

INSERT INTO public.plan_configs (
  plan_key,
  display_name,
  product_line,
  price_monthly,
  price_yearly,
  stripe_setup_price_id,
  stripe_price_id_monthly,
  stripe_price_id_yearly,
  limits,
  features,
  is_active
) VALUES 
-- Lead Gen Starter
(
  'leadgen_starter',
  'Lead Gen Starter',
  'leadgen',
  250000, -- $2,500 in cents
  NULL, -- No yearly pricing specified
  NULL, -- Setup price ID to be filled later ($10,000)
  NULL, -- Monthly price ID to be filled later
  NULL, -- No yearly price ID
  jsonb_build_object(
    'minutes_included', 500,
    'minutes_overage_rate', 0.20,
    'messages_included', 10000,
    'messages_overage_rate', 0.009,
    'realtime_overage_rate', 0.60,
    'passthrough_markup', 0.20,
    'agents', 10,
    'seats', 5
  ),
  ARRAY['voice_calls', 'messaging', 'lead_capture', 'analytics']::TEXT[],
  true
),
-- Lead Gen Business  
(
  'leadgen_business',
  'Lead Gen Business',
  'leadgen', 
  350000, -- $3,500 in cents
  NULL, -- No yearly pricing specified
  NULL, -- Setup price ID to be filled later ($10,000)
  NULL, -- Monthly price ID to be filled later
  NULL, -- No yearly price ID
  jsonb_build_object(
    'minutes_included', 2000,
    'minutes_overage_rate', 0.20,
    'messages_included', 50000,
    'messages_overage_rate', 0.009,
    'realtime_overage_rate', 0.60,
    'passthrough_markup', 0.20,
    'agents', 50,
    'seats', 15
  ),
  ARRAY['voice_calls', 'messaging', 'lead_capture', 'analytics', 'advanced_routing', 'priority_support']::TEXT[],
  true
),
-- Support Starter
(
  'support_starter',
  'Support Starter', 
  'support',
  150000, -- $1,500 in cents
  NULL, -- No yearly pricing specified
  NULL, -- Setup price ID to be filled later ($8,000)
  NULL, -- Monthly price ID to be filled later
  NULL, -- No yearly price ID
  jsonb_build_object(
    'minutes_included', 1000,
    'minutes_overage_rate', 0.25,
    'messages_included', 10000,
    'messages_overage_rate', 0.009,
    'realtime_overage_rate', 0.60,
    'passthrough_markup', 0.20,
    'agents', 10,
    'seats', 5
  ),
  ARRAY['voice_calls', 'messaging', 'ticket_routing', 'knowledge_base', 'analytics']::TEXT[],
  true
),
-- Support Business
(
  'support_business',
  'Support Business',
  'support',
  350000, -- $3,500 in cents  
  NULL, -- No yearly pricing specified
  NULL, -- Setup price ID to be filled later ($10,000)
  NULL, -- Monthly price ID to be filled later
  NULL, -- No yearly price ID
  jsonb_build_object(
    'minutes_included', 4000,
    'minutes_overage_rate', 0.25,
    'messages_included', 50000,
    'messages_overage_rate', 0.009,
    'realtime_overage_rate', 0.60,
    'passthrough_markup', 0.20,
    'agents', 50,
    'seats', 15
  ),
  ARRAY['voice_calls', 'messaging', 'ticket_routing', 'knowledge_base', 'analytics', 'advanced_routing', 'priority_support', 'sla_management']::TEXT[],
  true
),
-- Lead Gen Enterprise (Contact Sales)
(
  'leadgen_enterprise',
  'Lead Gen Enterprise',
  'leadgen',
  NULL, -- Contact Sales - no price
  NULL, -- Contact Sales - no yearly price
  NULL, -- No setup price ID - contact sales
  NULL, -- No monthly price ID - contact sales
  NULL, -- No yearly price ID - contact sales
  jsonb_build_object(
    'minutes_included', -1, -- Unlimited
    'minutes_overage_rate', 0.20,
    'messages_included', -1, -- Unlimited
    'messages_overage_rate', 0.009,
    'realtime_overage_rate', 0.60,
    'passthrough_markup', 0.15, -- Better rate for enterprise
    'agents', -1, -- Unlimited
    'seats', -1 -- Unlimited
  ),
  ARRAY['voice_calls', 'messaging', 'lead_capture', 'analytics', 'advanced_routing', 'priority_support', 'custom_integrations', 'dedicated_support', 'sla_guarantee']::TEXT[],
  true
),
-- Support Enterprise (Contact Sales)
(
  'support_enterprise', 
  'Support Enterprise',
  'support',
  NULL, -- Contact Sales - no price
  NULL, -- Contact Sales - no yearly price
  NULL, -- No setup price ID - contact sales
  NULL, -- No monthly price ID - contact sales  
  NULL, -- No yearly price ID - contact sales
  jsonb_build_object(
    'minutes_included', -1, -- Unlimited
    'minutes_overage_rate', 0.25,
    'messages_included', -1, -- Unlimited
    'messages_overage_rate', 0.009,
    'realtime_overage_rate', 0.60,
    'passthrough_markup', 0.15, -- Better rate for enterprise
    'agents', -1, -- Unlimited
    'seats', -1 -- Unlimited
  ),
  ARRAY['voice_calls', 'messaging', 'ticket_routing', 'knowledge_base', 'analytics', 'advanced_routing', 'priority_support', 'sla_management', 'custom_integrations', 'dedicated_support', 'white_label']::TEXT[],
  true
)
ON CONFLICT (plan_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  product_line = EXCLUDED.product_line,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  updated_at = now();