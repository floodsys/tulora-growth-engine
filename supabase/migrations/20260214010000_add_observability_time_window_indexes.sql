-- Indexes to support global time-window queries in admin-observability-metrics
-- webhook_events: created_at for global time-window scans
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at
  ON public.webhook_events USING btree (created_at DESC);

-- processed_webhook_events: processed_at for time-window scans
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_processed_at
  ON public.processed_webhook_events USING btree (processed_at DESC);

-- activity_logs: status + created_at for error counting
CREATE INDEX IF NOT EXISTS idx_activity_logs_status_created
  ON public.activity_logs USING btree (status, created_at DESC);

-- retell_calls: status + created_at for time-window counts
CREATE INDEX IF NOT EXISTS idx_retell_calls_status_created
  ON public.retell_calls USING btree (status, created_at DESC);
