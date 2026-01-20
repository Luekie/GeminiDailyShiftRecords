# Production User Management Setup Guide

## 🚨 CRITICAL: Before Going Live

**STOP using manual password creation immediately!** This guide will help you transition to a secure, production-ready user management system.

## Current vs Production Setup

### ❌ Current (Demo) Setup
- You manually create users in Supabase dashboard
- Passwords stored in your database tables
- You know everyone's passwords
- **SECURITY RISK** - Must change before hosting

### ✅ Production Setup
- System creates users through Supabase Auth
- Passwords are hashed and managed by Supabase
- Users set their own passwords via secure email links
- You never see or store passwords

## Step-by-Step Migration

### 1. Enable Supabase Auth Admin Functions

In your Supabase project, you need to enable admin functions. Go to:
- **Settings** → **API** → **Service Role Key**
- Copy your service role key (keep it secret!)

### 2. Update Environment Variables

Add to your `.env.local`:
```env
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. Update Supabase Client for Admin Functions

Create `src/lib/supabaseAdmin.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
```

### 4. Run Database Migrations

Execute the SQL in `database-migrations.sql` in your Supabase SQL Editor. This will:
- Add proper approval workflow columns
- Create performance tracking tables
- Set up alert system
- Add audit logging
- Create security policies

### 5. Migrate Existing Users

**IMPORTANT**: You'll need to migrate existing users from your current system to Supabase Auth.

For each existing user:
1. Use the User Management tab in Enhanced Manager Dashboard
2. Create new users with their email addresses
3. System will send password setup emails
4. Users will set their own passwords
5. Delete old password records from your database

### 6. Configure Email Templates (Optional)

In Supabase Dashboard:
- Go to **Authentication** → **Email Templates**
- Customize the "Invite user" template
- Set your company branding

### 7. Set Up Email Provider (Recommended)

For production, configure a proper email provider:
- Go to **Settings** → **Auth** → **SMTP Settings**
- Configure with your email service (SendGrid, Mailgun, etc.)
- This ensures reliable email delivery

## Security Best Practices

### Row Level Security (RLS)
The migration includes RLS policies that ensure:
- Users can only see their own data
- Managers can see all data
- Supervisors have limited access

### Password Requirements
The system enforces:
- Minimum 8 characters
- Uppercase and lowercase letters
- Numbers and special characters
- No common passwords

### Session Management
- Automatic session expiry
- Secure token refresh
- Logout on suspicious activity

## Using the New System

### Creating Users (Manager Only)
1. Go to Enhanced Manager Dashboard
2. Click "User Management" tab
3. Click "Add User"
4. Enter email, username, and role
5. System sends secure setup email
6. User clicks link and sets password

### User First Login
1. User receives email invitation
2. Clicks secure link
3. Sets strong password
4. System redirects to login
5. User logs in with email/password

### Managing Users
- **Suspend**: Temporarily disable access
- **Reactivate**: Restore access
- **Delete**: Permanently remove (careful!)
- **Resend Invite**: Send new setup email

## Testing the System

### Test User Creation
1. Create a test user with your personal email
2. Check you receive the setup email
3. Complete password setup process
4. Verify login works
5. Test role-based access

### Test Security
- Try accessing other users' data (should fail)
- Test password requirements
- Verify session timeout
- Test logout functionality

## Deployment Checklist

- [ ] Database migrations executed
- [ ] Environment variables set
- [ ] Email provider configured
- [ ] Test user creation works
- [ ] Test password setup works
- [ ] Test role-based access
- [ ] Remove old password fields from database
- [ ] Update any hardcoded user references
- [ ] Test on staging environment
- [ ] Train staff on new user creation process

## Emergency Procedures

### If Email Fails
- Check SMTP settings in Supabase
- Verify email provider status
- Use Supabase dashboard to manually confirm users

### If User Locked Out
- Use Supabase dashboard to reset password
- Or delete and recreate user account

### If System Compromised
- Immediately revoke service role key
- Force logout all users
- Review audit logs
- Reset all passwords

## Support & Troubleshooting

### Common Issues
1. **Email not received**: Check spam folder, verify SMTP settings
2. **Password setup fails**: Check link expiry, resend invite
3. **Access denied**: Verify user role and RLS policies
4. **Login fails**: Check email/password, verify account status

### Getting Help
- Check Supabase documentation
- Review browser console for errors
- Check Supabase logs in dashboard
- Test with different browsers/devices

## Next Steps

Once this system is working:
1. Consider adding 2FA for managers
2. Set up automated backups
3. Monitor user activity logs
4. Regular security audits
5. Staff training on security practices

---

**Remember**: Security is not a one-time setup. Regularly review access, update passwords, and monitor for suspicious activity.