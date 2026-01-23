-- USER PROFILE ENHANCEMENT MIGRATION
-- Add first name, last name, and gender columns to users table

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT,
ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- Update existing users to have default values (optional)
-- You can run this if you want to set default values for existing users
-- UPDATE users SET first_name = 'First', last_name = 'Name', gender = 'prefer_not_to_say' WHERE first_name IS NULL;

-- Add indexes for better performance
CREATE INDEX idx_users_first_name ON users(first_name);
CREATE INDEX idx_users_last_name ON users(last_name);

-- Verification query
SELECT 
  id, 
  username, 
  email, 
  first_name, 
  last_name, 
  gender, 
  role, 
  created_at 
FROM users 
LIMIT 5;