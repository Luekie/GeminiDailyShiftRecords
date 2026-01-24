# SUPABASE URL CONFIGURATION GUIDE

## Problem
The invitation email is redirecting to localhost instead of your actual domain, causing "localhost can't connect" errors.

## CRITICAL SOLUTION STEPS

### 1. Find Your Current Domain
First, check what URL you're currently using to access your app:
- If local development: `http://localhost:5173` or `http://localhost:3000`
- If deployed: `https://yourdomain.com` or your actual deployment URL

### 2. Update Supabase Dashboard Settings
Go to your Supabase dashboard:
1. Navigate to **Authentication > URL Configuration**
2. Update the following settings:

**Site URL:**
```
https://yourdomain.com
```
(Replace with your ACTUAL domain - this is the most important setting)

**Redirect URLs:**
Add these URLs (one per line):
```
https://yourdomain.com/setup-password
https://yourdomain.com/**
http://localhost:5173/setup-password
http://localhost:5173/**
```

### 3. IMMEDIATE FIX - Manual URL Replacement
If you need to test right now:
1. Copy the invitation email link
2. Replace `localhost:5173` with your actual domain
3. Paste the modified URL in your browser

Example:
- Original: `http://localhost:5173/setup-password?access_token=...`
- Fixed: `https://yourdomain.com/setup-password?access_token=...`

### 4. For Production Deployment
If you've deployed your app:
1. **CRITICAL**: Update Site URL in Supabase to your production domain
2. Add your production domain to Redirect URLs
3. Test user creation again

### 5. For Local Development
If you're still developing locally:
1. Make sure Site URL is `http://localhost:5173`
2. Make sure you're accessing your app at `http://localhost:5173`
3. If using a different port, update accordingly

## Debugging Steps
1. Check what URL you're currently using to access your manager dashboard
2. Copy that exact URL (without the path) and use it as your Site URL in Supabase
3. Add `/setup-password` to that URL and add it to Redirect URLs

## Common Issues
- **Site URL mismatch**: The Site URL in Supabase must match exactly how you access your app
- **Missing redirect URLs**: Each possible redirect path must be explicitly added
- **Protocol mismatch**: Make sure http/https matches between your app and Supabase config

## Test the Fix
1. Update Supabase settings
2. Create a new test user
3. Check the invitation email - the link should now point to your correct domain
4. Click the link - should take you to the password setup page