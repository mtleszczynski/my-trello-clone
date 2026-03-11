-- Notification log table to track which launch notifications have been sent
-- Run this in your Supabase SQL Editor

CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  launch_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_notification_log_unique ON notification_log(user_id, launch_id);
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Allow the service role to manage notification logs (cron job uses service role key)
CREATE POLICY "Service role full access on notification_log" ON notification_log
  FOR ALL USING (true) WITH CHECK (true);
