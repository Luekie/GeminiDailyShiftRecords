# UPDATE USER FUNCTIONALITY EXPLAINED

## What Happens When Manager Clicks "Update User"

### Step 1: Edit Button Click
When a manager clicks the **Edit** button (pencil icon) next to a user:

1. **Opens Edit Modal**: The same modal used for creating users opens
2. **Pre-fills Form**: The form is populated with the user's current information:
   - Email (disabled/read-only)
   - Role (editable dropdown)
   - "Send invite" checkbox is hidden (not applicable for updates)

### Step 2: Manager Makes Changes
The manager can **ONLY** change:
- ✅ **User Role** (attendant → supervisor → manager)
- ❌ **Email** (disabled - cannot be changed)
- ❌ **Username** (not shown - user controls this)
- ❌ **First/Last Name** (not shown - user controls this)

### Step 3: Update Process
When manager clicks "Update User":

#### Database Updates:
1. **Users Table Update**:
   ```sql
   UPDATE users 
   SET role = 'new_role' 
   WHERE id = 'user_id'
   ```

2. **Auth Metadata Update**:
   ```sql
   -- Updates Supabase Auth user metadata
   UPDATE auth.users 
   SET user_metadata = jsonb_set(user_metadata, '{role}', '"new_role"')
   WHERE id = 'user_id'
   ```

#### What Happens to the User:
- ✅ **Role changes immediately** in the system
- ✅ **User can still login** with same credentials
- ✅ **User sees new dashboard** based on new role
- ✅ **No email sent** to user about the change
- ✅ **User's profile data unchanged** (name, username, etc.)

### Step 4: Results
- **Success Message**: "User updated successfully"
- **Modal Closes**: Edit form disappears
- **Table Refreshes**: User list updates to show new role
- **User Experience**: Next time user logs in, they see their new role dashboard

## Current Limitations

### What Managers CANNOT Update:
- ❌ **Email Address** (would require new invitation)
- ❌ **Username** (user-controlled)
- ❌ **First/Last Name** (user-controlled)
- ❌ **Password** (user-controlled)
- ❌ **Gender** (user-controlled)

### What Managers CAN Do Instead:
- ✅ **Change Role** (attendant ↔ supervisor ↔ manager)
- ✅ **Suspend User** (prevents login)
- ✅ **Reactivate User** (allows login again)
- ✅ **Delete User** (removes completely)
- ✅ **Resend Invite** (for pending users)

## Role Change Examples

### Promote Attendant to Supervisor:
```
Before: John Doe - Attendant
After:  John Doe - Supervisor
Result: John can now access Supervisor Dashboard
```

### Demote Manager to Attendant:
```
Before: Jane Smith - Manager  
After:  Jane Smith - Attendant
Result: Jane loses manager privileges, sees Attendant Dashboard
```

## User Experience After Role Change

When the updated user logs in next time:
1. **Same login credentials** work
2. **Automatic redirect** to appropriate dashboard:
   - Attendant → `/attendant`
   - Supervisor → `/supervisor` 
   - Manager → `/manager`
3. **Dashboard greeting** shows correct role
4. **Permissions** match new role immediately

## Security Notes

- ✅ **Only managers** can update user roles
- ✅ **Managers cannot edit themselves** (prevents accidental lockout)
- ✅ **Changes are logged** in browser console
- ✅ **Database constraints** prevent invalid roles
- ✅ **Auth metadata synced** with profile data

## Error Handling

If update fails:
- **Database Error**: Shows specific error message
- **Auth Update Fails**: Warns but continues (profile still updated)
- **Permission Denied**: Shows "Unauthorized" message
- **Network Error**: Shows connection error message

The update functionality is focused on **role management only** - all personal information remains under user control through the setup password flow.