# QUICK FIX FOR LOCALHOST CONNECTION ERROR

## Problem
Invitation emails are pointing to `localhost` which causes "localhost refused to connect" errors.

## Root Cause
Your Supabase Site URL is still set to `http://localhost:5173` instead of your production domain.

## IMMEDIATE SOLUTION

### Step 1: Find Your Production Domain
Go to your deployed app and copy the URL. Examples:
- Vercel: `https://your-app-name.vercel.app`
- Netlify: `https://your-app-name.netlify.app`
- Custom domain: `https://yourdomain.com`

### Step 2: Update Supabase (CRITICAL)
1. Go to [supabase.com](https://supabase.com) → Your Project
2. Navigate to **Authentication** → **URL Configuration**
3. Change **Site URL** to: `https://your-production-domain.com`
4. Add these **Redirect URLs**:
   ```
   https://your-production-domain.com/setup-password
   https://your-production-domain.com/**
   https://your-production-domain.com/
   http://localhost:5173/setup-password
   http://localhost:5173/**
   http://localhost:5173/
   ```

### Step 3: Test Again
1. Wait 2-3 minutes for changes to take effect
2. Create a NEW test user (don't reuse old emails)
3. Check the invitation email - should now point to production domain
4. Click the link - should work!

## Manual Workaround (Temporary)
If you need to test immediately:
1. Copy the invitation email link
2. Replace `localhost:5173` with your production domain
3. Paste the modified URL in browser

Example:
- Original: `http://localhost:5173/setup-password?access_token=...`
- Fixed: `https://your-domain.com/setup-password?access_token=...`

## Why This Happens
- Supabase uses the **Site URL** setting for all invitation emails
- If Site URL = localhost, emails point to localhost
- If Site URL = production domain, emails point to production

## After Fix
- New invitation emails will point to production domain
- Users can complete profile setup successfully
- Both localhost development and production will work