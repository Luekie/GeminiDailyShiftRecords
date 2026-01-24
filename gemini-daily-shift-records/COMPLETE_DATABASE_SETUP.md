# COMPLETE DATABASE SETUP GUIDE

## Step 1: Fix Username Column (CRITICAL)
Run this first in Supabase SQL Editor:
```sql
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
```

## Step 2: Add Profile Enhancement Columns
Run the user profile enhancement migration:
```sql
-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
```

## Step 3: Update Site URL for Production
In your Supabase dashboard:
1. Go to Authentication > URL Configuration
2. Set Site URL to your production domain (e.g., `https://yourdomain.com`)
3. Add your domain to Redirect URLs

## Step 4: Test User Creation
1. Try creating a new user from Manager Dashboard
2. Check that the invitation email is sent
3. User should be able to complete setup with username, names, and gender

## Current User Creation Flow
1. **Manager**: Creates user with email + role only
2. **System**: Sends invitation email to user
3. **User**: Clicks link, sets up username, first name, last name, gender, and password
4. **System**: User can now login and appears in dashboard with full name

## Troubleshooting
- If emails go to spam, consider setting up custom SMTP
- If user creation fails, check the browser console for specific errors
- Ensure VITE_SUPABASE_SERVICE_ROLE_KEY is properly configured