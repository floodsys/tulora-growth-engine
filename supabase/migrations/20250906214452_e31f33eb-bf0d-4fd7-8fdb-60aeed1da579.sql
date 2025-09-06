-- Upsert three AI Customer Service plans
-- support_starter plan
INSERT INTO public.plan_configs (
  plan_key,
  display_name,
  product_line,
  is_active,
  price_monthly,
  price_yearly,
  stripe_price_id_monthly,
  stripe_price_id_yearly,
  stripe_setup_price_id,
  features,
  limits
) VALUES (
  'support_starter',
  'AI Customer Service – Starter (single-location / business hours)',
  'support',
  true,
  150000, -- $1,500 in cents
  null,
  null, -- To be filled later
  null,
  null, -- Setup fee to be filled later ($8,000)
  ARRAY[
    '1-voice-agent-1-brand-line',
    'emergency-triage-faqs',
    '1-helpdesk-crm-integration',
    'basic-analytics-containment-fcr-aht',
    'monthly-report'
  ],
  jsonb_build_object(
    'included_minutes', 1000,
    'included_messages', 10000,
    'model_mix_default', 'non_realtime',
    'realtime_opt_in', true,
    'overage', jsonb_build_object(
      'minutes_default', 0.25,
      'minutes_realtime', 0.60,
      'messages', 0.009,
      'passthrough_margin_percent', 20
    ),
    'rollover', false,
    'caps_and_alerts_enabled', true,
    'setup_fee_usd', 8000
  )
) ON CONFLICT (plan_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  product_line = EXCLUDED.product_line,
  is_active = EXCLUDED.is_active,
  price_monthly = EXCLUDED.price_monthly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = now();

-- support_business plan  
INSERT INTO public.plan_configs (
  plan_key,
  display_name,
  product_line,
  is_active,
  price_monthly,
  price_yearly,
  stripe_price_id_monthly,
  stripe_price_id_yearly,
  stripe_setup_price_id,
  features,
  limits
) VALUES (
  'support_business',
  'AI Customer Service– Business (multi-location or 24/7)',
  'support',
  true,
  350000, -- $3,500 in cents
  null,
  null, -- To be filled later
  null,
  null, -- Setup fee to be filled later ($10,000)
  ARRAY[
    '2-3-agents-brands-queues',
    'bilingual-up-to-2-langs',
    'advanced-workflows-returns-billing-scheduling-callback',
    '2plus-integrations',
    'qa-dashboards',
    'weekly-optimization'
  ],
  jsonb_build_object(
    'included_minutes', 4000,
    'included_messages', 50000,
    'model_mix_default', 'non_realtime',
    'realtime_opt_in', true,
    'overage', jsonb_build_object(
      'minutes_default', 0.25,
      'minutes_realtime', 0.60,
      'messages', 0.009,
      'passthrough_margin_percent', 20
    ),
    'rollover', false,
    'caps_and_alerts_enabled', true,
    'setup_fee_usd', 10000
  )
) ON CONFLICT (plan_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  product_line = EXCLUDED.product_line,
  is_active = EXCLUDED.is_active,
  price_monthly = EXCLUDED.price_monthly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = now();

-- support_enterprise plan
INSERT INTO public.plan_configs (
  plan_key,
  display_name,
  product_line,
  is_active,
  price_monthly,
  price_yearly,
  stripe_price_id_monthly,
  stripe_price_id_yearly,
  stripe_setup_price_id,
  features,
  limits
) VALUES (
  'support_enterprise',
  'AI Customer Service – Enterprise (regulated / high scale)',
  'support',
  true,
  null, -- Sales-led pricing starting at $10,000+/mo
  null,
  null, -- Contact sales only
  null,
  null, -- Custom setup fee
  ARRAY[
    'hipaa-pci-options',
    'custom-voice-tuning',
    'ivr-trees-by-dept',
    'data-residency',
    'dedicated-account-manager'
  ],
  jsonb_build_object(
    'platform_retainer_min_usd', 10000,
    'model_mix_default', 'non_realtime',
    'realtime_opt_in_per_queue', true,
    'overage', jsonb_build_object(
      'minutes_default', 0.25,
      'minutes_realtime', 0.60,
      'messages', 0.009,
      'passthrough_margin_percent', 20
    ),
    'rollover', false,
    'caps_and_alerts_enabled', true,
    'alternatives', jsonb_build_object(
      'per_call_pricing', jsonb_build_object(
        'enabled', false,
        'price_per_call_usd', 4,
        'includes_time_cap', true
      ),
      'seat_based_pricing', jsonb_build_object(
        'enabled', false,
        'price_per_virtual_agent_monthly_usd', 400
      ),
      'outcome_addons', jsonb_build_object(
        'enabled', false,
        'csat_bonus', true,
        'fcr_gains', true
      )
    ),
    'contact_sales_only', true
  )
) ON CONFLICT (plan_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  product_line = EXCLUDED.product_line,
  is_active = EXCLUDED.is_active,
  price_monthly = EXCLUDED.price_monthly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = now();