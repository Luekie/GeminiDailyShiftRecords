-- Enhanced Manager Dashboard Database Migrations
-- Run these SQL commands in your Supabase SQL Editor

-- 1. Add approval system columns to shifts table
ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Update existing records to have default approval status
UPDATE shifts 
SET approval_status = CASE 
  WHEN is_approved = true THEN 'approved'
  WHEN is_approved = false THEN 'rejected'
  ELSE 'pending'
END
WHERE approval_status IS NULL;

-- 3. Create work_plans table for scheduling
CREATE TABLE IF NOT EXISTS work_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift VARCHAR(10) NOT NULL CHECK (shift IN ('day', 'night', 'off')),
  pump_assignment VARCHAR(50),
  supervisor_id UUID REFERENCES users(id),
  special_duty TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- 4. Create performance_metrics table for tracking
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendant_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shifts_completed INTEGER DEFAULT 0,
  total_volume DECIMAL(10,2) DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  variance_amount DECIMAL(10,2) DEFAULT 0,
  variance_percentage DECIMAL(5,2) DEFAULT 0,
  accuracy_score DECIMAL(5,2) DEFAULT 100,
  approved_shifts INTEGER DEFAULT 0,
  rejected_shifts INTEGER DEFAULT 0,
  late_submissions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(attendant_id, date)
);

-- 5. Create alerts table for notifications
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  user_id UUID REFERENCES users(id),
  shift_id UUID REFERENCES shifts(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- 6. Create audit_logs table for tracking manager actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shifts_approval_status ON shifts(approval_status);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_date ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_attendant_date ON shifts(attendant_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_work_plans_date ON work_plans(date);
CREATE INDEX IF NOT EXISTS idx_work_plans_employee_date ON work_plans(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_attendant_date ON performance_metrics(attendant_id, date);
CREATE INDEX IF NOT EXISTS idx_alerts_user_created ON alerts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at);

-- 8. Create function to automatically update performance metrics
CREATE OR REPLACE FUNCTION update_performance_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert performance metrics when shift is approved/rejected
  INSERT INTO performance_metrics (
    attendant_id, 
    date, 
    shifts_completed,
    total_volume,
    total_revenue,
    variance_amount,
    approved_shifts,
    rejected_shifts
  )
  VALUES (
    NEW.attendant_id,
    NEW.shift_date,
    1,
    NEW.closing_reading - NEW.opening_reading,
    NEW.cash_received + NEW.prepayment_received + NEW.credit_received + 
    NEW.fuel_card_received + NEW.fdh_card_received + NEW.national_bank_card_received + NEW.mo_payment_received,
    (NEW.cash_received + NEW.prepayment_received + NEW.credit_received + 
     NEW.fuel_card_received + NEW.fdh_card_received + NEW.national_bank_card_received + NEW.mo_payment_received) - 
    ((NEW.closing_reading - NEW.opening_reading) * NEW.fuel_price),
    CASE WHEN NEW.approval_status = 'approved' THEN 1 ELSE 0 END,
    CASE WHEN NEW.approval_status = 'rejected' THEN 1 ELSE 0 END
  )
  ON CONFLICT (attendant_id, date) 
  DO UPDATE SET
    shifts_completed = performance_metrics.shifts_completed + 1,
    total_volume = performance_metrics.total_volume + (NEW.closing_reading - NEW.opening_reading),
    total_revenue = performance_metrics.total_revenue + (NEW.cash_received + NEW.prepayment_received + NEW.credit_received + 
                   NEW.fuel_card_received + NEW.fdh_card_received + NEW.national_bank_card_received + NEW.mo_payment_received),
    variance_amount = performance_metrics.variance_amount + ((NEW.cash_received + NEW.prepayment_received + NEW.credit_received + 
                     NEW.fuel_card_received + NEW.fdh_card_received + NEW.national_bank_card_received + NEW.mo_payment_received) - 
                     ((NEW.closing_reading - NEW.opening_reading) * NEW.fuel_price)),
    approved_shifts = performance_metrics.approved_shifts + CASE WHEN NEW.approval_status = 'approved' THEN 1 ELSE 0 END,
    rejected_shifts = performance_metrics.rejected_shifts + CASE WHEN NEW.approval_status = 'rejected' THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger for performance metrics
DROP TRIGGER IF EXISTS trigger_update_performance_metrics ON shifts;
CREATE TRIGGER trigger_update_performance_metrics
  AFTER INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_metrics();

-- 10. Create function to generate alerts for critical variances
CREATE OR REPLACE FUNCTION check_critical_variance()
RETURNS TRIGGER AS $$
DECLARE
  expected_revenue DECIMAL(10,2);
  actual_revenue DECIMAL(10,2);
  variance_percentage DECIMAL(5,2);
BEGIN
  expected_revenue := (NEW.closing_reading - NEW.opening_reading) * NEW.fuel_price;
  actual_revenue := NEW.cash_received + NEW.prepayment_received + NEW.credit_received + 
                   NEW.fuel_card_received + NEW.fdh_card_received + NEW.national_bank_card_received + NEW.mo_payment_received;
  
  IF expected_revenue > 0 THEN
    variance_percentage := ABS((actual_revenue - expected_revenue) / expected_revenue * 100);
    
    -- Create alert if variance is greater than 5%
    IF variance_percentage > 5 THEN
      INSERT INTO alerts (type, title, message, severity, shift_id, user_id)
      VALUES (
        'high_variance',
        'High Variance Detected',
        FORMAT('Shift by %s has %.1f%% variance (Expected: %s, Actual: %s)', 
               (SELECT username FROM users WHERE id = NEW.attendant_id),
               variance_percentage,
               expected_revenue,
               actual_revenue),
        CASE 
          WHEN variance_percentage > 15 THEN 'critical'
          WHEN variance_percentage > 10 THEN 'error'
          ELSE 'warning'
        END,
        NEW.id,
        (SELECT id FROM users WHERE role = 'manager' LIMIT 1)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger for variance alerts
DROP TRIGGER IF EXISTS trigger_check_critical_variance ON shifts;
CREATE TRIGGER trigger_check_critical_variance
  AFTER INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION check_critical_variance();

-- 12. Create RLS (Row Level Security) policies
ALTER TABLE work_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Managers can see all data
CREATE POLICY "Managers can view all work plans" ON work_plans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "Managers can modify all work plans" ON work_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager')
  );

-- Attendants can only see their own performance metrics
CREATE POLICY "Users can view own performance metrics" ON performance_metrics
  FOR SELECT USING (
    attendant_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager', 'supervisor'))
  );

-- Managers and supervisors can see all alerts
CREATE POLICY "Managers and supervisors can view alerts" ON alerts
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('manager', 'supervisor'))
  );

-- Only managers can view audit logs
CREATE POLICY "Only managers can view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'manager')
  );

-- 13. Insert sample work plan data (optional)
-- This creates a basic schedule for the current week
INSERT INTO work_plans (employee_id, date, shift, pump_assignment)
SELECT 
  u.id,
  CURRENT_DATE + (i % 7),
  CASE 
    WHEN (u.id::text || i)::int % 3 = 0 THEN 'day'
    WHEN (u.id::text || i)::int % 3 = 1 THEN 'night'
    ELSE 'off'
  END,
  CASE 
    WHEN (u.id::text || i)::int % 3 != 2 THEN 'Pump ' || ((u.id::text || i)::int % 5 + 1)
    ELSE NULL
  END
FROM users u
CROSS JOIN generate_series(0, 6) i
WHERE u.role = 'attendant'
ON CONFLICT (employee_id, date) DO NOTHING;

-- 14. Create view for manager dashboard summary
CREATE OR REPLACE VIEW manager_dashboard_summary AS
SELECT 
  s.shift_date,
  s.shift_type,
  COUNT(*) as total_shifts,
  COUNT(*) FILTER (WHERE s.approval_status = 'pending') as pending_approvals,
  COUNT(*) FILTER (WHERE s.approval_status = 'approved') as approved_shifts,
  COUNT(*) FILTER (WHERE s.approval_status = 'rejected') as rejected_shifts,
  SUM(s.closing_reading - s.opening_reading) as total_volume,
  SUM(s.cash_received + s.prepayment_received + s.credit_received + 
      s.fuel_card_received + s.fdh_card_received + s.national_bank_card_received + s.mo_payment_received) as total_revenue,
  SUM((s.cash_received + s.prepayment_received + s.credit_received + 
       s.fuel_card_received + s.fdh_card_received + s.national_bank_card_received + s.mo_payment_received) - 
      ((s.closing_reading - s.opening_reading) * s.fuel_price)) as total_variance,
  COUNT(*) FILTER (WHERE ABS(((s.cash_received + s.prepayment_received + s.credit_received + 
                              s.fuel_card_received + s.fdh_card_received + s.national_bank_card_received + s.mo_payment_received) - 
                             ((s.closing_reading - s.opening_reading) * s.fuel_price)) / 
                            NULLIF((s.closing_reading - s.opening_reading) * s.fuel_price, 0) * 100) > 5) as high_variance_count
FROM shifts s
GROUP BY s.shift_date, s.shift_type
ORDER BY s.shift_date DESC, s.shift_type;

COMMENT ON VIEW manager_dashboard_summary IS 'Summary view for manager dashboard showing key metrics by date and shift';