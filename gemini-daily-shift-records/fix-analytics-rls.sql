-- FIX ANALYTICS AND ALERTS ACCESS FOR MANAGERS
-- Run this in Supabase SQL Editor

-- 1. Fix shifts table RLS (ensure managers can see all shifts)
DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;

CREATE POLICY "shifts_select_policy" ON shifts
  FOR SELECT USING (
    attendant_id = auth.uid() OR
    supervisor_id = auth.uid() OR
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'manager'
    )
  );

-- 2. Fix performance_metrics table RLS (if it exists)
DROP POLICY IF EXISTS "performance_metrics_select_policy" ON performance_metrics;

CREATE POLICY "performance_metrics_select_policy" ON performance_metrics
  FOR SELECT USING (
    attendant_id = auth.uid() OR
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('manager', 'supervisor')
    )
  );

-- 3. Fix alerts table RLS (if it exists)
DROP POLICY IF EXISTS "alerts_select_policy" ON alerts;

CREATE POLICY "alerts_select_policy" ON alerts
  FOR SELECT USING (
    user_id = auth.uid() OR
    user_id IS NULL OR
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('manager', 'supervisor')
    )
  );

-- 4. Verify all tables are accessible
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('shifts', 'users', 'performance_metrics', 'alerts')
ORDER BY tablename;
