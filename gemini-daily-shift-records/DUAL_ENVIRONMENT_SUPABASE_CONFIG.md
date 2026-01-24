# DUAL ENVIRONMENT SUPABASE CONFIGURATION
## (Production + Local Development)

## The Challenge
You have:
- **Production**: `https://your-production-domain.com`
- **Local Development**: `http://localhost:5173`

You need both to work with the same Supabase project.

## Solution: Configure Both URLs

### Step 1: Supabase Dashboard Configuration
Go to **Supabase Dashboard → Authentication → URL Configuration**

**Site URL (Primary):**
```
https://your-production-domain.com
```
(Use your production domain as the primary)

**Redirect URLs (Add ALL of these):**
```
https://your-production-domain.com/setup-password
https://your-production-domain.com/**
https://your-production-domain.com/
http://localhost:5173/setup-password
http://localhost:5173/**
http://localhost:5173/
http://localhost:3000/setup-password
http://localhost:3000/**
http://localhost:3000/
```

### Step 2: How It Works

**When developing locally:**
- Access your app at `http://localhost:5173`
- Create users → emails will point to production domain
- BUT you can manually change the URL to localhost for testing

**When in production:**
- Access your app at `https://your-production-domain.com`
- Create users → emails will point to production domain
- Everything works normally

## Testing Strategy

### Option 1: Test Locally with Manual URL Change
1. Create user from localhost manager dashboard
2. Check invitation email (will have production URL)
3. Copy the URL and replace production domain with `localhost:5173`
4. Test the setup flow locally

### Option 2: Test Everything in Production
1. Use your production app for all user management testing
2. Keep localhost for development of other features

### Option 3: Environment-Specific Configuration (Advanced)
Create different redirect URLs based on environment:

```typescript
// In UserManagement.tsx
const getRedirectUrl = () => {
  if (import.meta.env.DEV) {
    // Development environment
    return `${window.location.origin}/setup-password`;
  } else {
    // Production environment
    return `${window.location.origin}/setup-password`;
  }
};

// Use in inviteUserByEmail
redirectTo: getRedirectUrl()
```

## Recommended Approach

**For your situation, I recommend:**

1. **Set production as primary** in Supabase (Site URL)
2. **Add both localhost and production** to Redirect URLs
3. **Test user creation in production** (easier and more realistic)
4. **Use localhost for other development** (UI changes, bug fixes, etc.)

## Quick Setup Checklist

- [ ] Site URL: `https://your-production-domain.com`
- [ ] Redirect URLs include production domain + paths
- [ ] Redirect URLs include `http://localhost:5173` + paths
- [ ] Test user creation in production
- [ ] Verify invitation emails work
- [ ] Continue other development on localhost

## Pro Tip

Since invitation emails will always point to your Site URL (production), it's actually better to:
1. **Do user management testing in production**
2. **Do UI/feature development on localhost**
3. **Deploy changes and test user flows in production**

This way you get the most realistic testing experience and avoid URL confusion.

## Environment Variables

Make sure your `.env.local` has the same Supabase keys as production:
```
VITE_SUPABASE_URL=https://jjiouzopjlnfhscuzuxa.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

This allows both environments to connect to the same Supabase project.