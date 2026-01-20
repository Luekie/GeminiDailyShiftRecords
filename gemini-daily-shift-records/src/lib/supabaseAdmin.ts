import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Admin client for user management operations
// Only use this for admin functions like creating users, not for regular app operations
export const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null;

// Helper function to check if current user is admin
export const isAdmin = (user: any) => {
  return user?.role === 'manager'
}

// Helper function to safely use admin functions
export const withAdminCheck = (user: any, callback: () => any) => {
  if (!isAdmin(user)) {
    throw new Error('Unauthorized: Admin access required')
  }
  if (!supabaseAdmin) {
    throw new Error('Admin client not configured. Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your environment variables.')
  }
  return callback()
}