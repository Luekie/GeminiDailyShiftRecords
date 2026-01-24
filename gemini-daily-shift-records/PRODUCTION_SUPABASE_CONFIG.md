# PRODUCTION SUPABASE CONFIGURATION

## Step 1: Find Your Production Domain
First, you need to know your exact production URL. This could be:
- Vercel: `https://your-app-name.vercel.app`
- Netlify: `https://your-app-name.netlify.app`
- Custom domain: `https://yourdomain.com`
- Other platforms: Check your deployment dashboard

## Step 2: Configure Supabase Dashboard

### Go to Supabase Dashboard
1. Visit [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project
4. Navigate to **Authentication** → **URL Configuration**

### Update Site URL
Replace the current Site URL with your production domain:
```
https://your-production-domain.com
```
**IMPORTANT**: Use the exact URL where your app is deployed (no trailing slash)

### Update Redirect URLs
Add these URLs to the Redirect URLs section (one per line):
```
https://your-production-domain.com/setup-password
https://your-production-domain.com/**
https://your-production-domain.com/
```

## Step 3: Test the Configuration

### Method 1: Use Diagnostic Page
1. Go to your production app: `https://your-production-domain.com/diagnostic`
2. Copy the "Origin" value shown
3. Verify it matches what you set in Supabase

### Method 2: Test User Creation
1. Go to your production Manager Dashboard
2. Create a test user
3. Check the invitation email
4. The link should now point to your production domain

## Step 4: Update Email Templates (Optional)

In Supabase Dashboard → Authentication → Email Templates:
1. Click on "Invite user" template
2. Verify the confirmation URL uses your production domain
3. The template should automatically use your Site URL

## Common Production Platforms

### Vercel
- Site URL: `https://your-app-name.vercel.app`
- Or custom domain: `https://yourdomain.com`

### Netlify
- Site URL: `https://your-app-name.netlify.app`
- Or custom domain: `https://yourdomain.com`

### Railway
- Site URL: `https://your-app-name.up.railway.app`

### Render
- Site URL: `https://your-app-name.onrender.com`

## Troubleshooting

### If emails still point to localhost:
1. Double-check the Site URL in Supabase matches your production domain exactly
2. Wait 5-10 minutes for changes to propagate
3. Create a new test user (don't reuse old invitation links)

### If you get "Invalid redirect URL" errors:
1. Make sure you added your production domain to Redirect URLs
2. Include both the specific `/setup-password` path and the wildcard `/**`

### If the setup page doesn't load:
1. Check that your production app includes the `/setup-password` route
2. Verify the SetupPassword component is properly deployed

## Quick Verification Checklist
- [ ] Site URL set to production domain
- [ ] Redirect URLs include production domain + `/setup-password`
- [ ] Redirect URLs include production domain + `/**`
- [ ] Test user creation sends email with production domain link
- [ ] Clicking email link opens setup password page
- [ ] User can complete profile setup successfully

## Need Help?
If you're unsure about your production domain:
1. Open your deployed app in a browser
2. Copy the URL from the address bar (without any path)
3. That's your Site URL for Supabase