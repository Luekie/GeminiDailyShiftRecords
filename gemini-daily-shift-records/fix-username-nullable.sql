-- Fix username column to be nullable
-- This allows user creation without username (user will set it during setup)

ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

-- Verify the change
\d users;