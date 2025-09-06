-- Upsert three AI Lead Generation plans
-- leadgen_starter plan
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
  'leadgen_starter',
  'AI Lead Gen – Starter (single-location growth)',
  'leadgen',
  true,
  250000, -- $2,500 in cents
  null,
  null, -- To be filled later
  null,
  null, -- Setup fee to be filled later ($10,000)
  ARRAY[
    '5-video-concepts-x3-variants',
    'landing-pages',
    '1-phone-agent-emergency-mode-faqs',
    'calendar-crm-job-wiring',
    'basic-analytics',
    'monthly-performance-review'
  ],
  jsonb_build_object(
    'included_minutes', 500,
    'included_messages', 10000,
    'model_mix_default', 'non_realtime',
    'realtime_opt_in', true,
    'overage', jsonb_build_object(
      'minutes_default', 0.20,
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

-- leadgen_business plan  
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
  'leadgen_business',
  'AI Lead Gen – Business (multi-location or higher volume)',
  'leadgen',
  true,
  350000, -- $3,500 in cents
  null,
  null, -- To be filled later
  null,
  null, -- Setup fee to be filled later ($10,000)
  ARRAY[
    '15-video-concepts',
    'multi-channel-kit-meta-google-tiktok',
    'advanced-flows-multi-service-bilingual-reengagement',
    '2-3-agents-brands-regions',
    'advanced-analytics',
    'weekly-optimization'
  ],
  jsonb_build_object(
    'included_minutes', 2000,
    'included_messages', 50000,
    'model_mix_default', 'non_realtime',
    'realtime_opt_in', true,
    'overage', jsonb_build_object(
      'minutes_default', 0.20,
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

-- leadgen_enterprise_performance plan
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
  'leadgen_enterprise_performance',
  'AI Lead Gen – Enterprise Performance (pay mostly for outcomes)',
  'leadgen',
  true,
  null, -- Contact sales - no fixed monthly price
  null,
  null, -- Contact sales only
  null,
  null, -- Custom setup fee
  ARRAY[
    'outcome-pricing',
    'sow-governed-qualification',
    'verification-and-caps'
  ],
  jsonb_build_object(
    'billing_models', jsonb_build_object(
      'qualified_lead_range_usd', jsonb_build_array(75, 300),
      'booked_appointment_range_usd', jsonb_build_array(200, 500),
      'revenue_share_percent_range', jsonb_build_array(3, 10),
      'sow_defines', 'qualification/verification/caps',
      'monthly_floor_recommended', true
    ),
    'model_mix_default', 'non_realtime',
    'realtime_opt_in', true,
    'overage', jsonb_build_object(
      'minutes_default', 0.20,
      'minutes_realtime', 0.60,
      'messages', 0.009,
      'passthrough_margin_percent', 20
    ),
    'rollover', false,
    'caps_and_alerts_enabled', true,
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