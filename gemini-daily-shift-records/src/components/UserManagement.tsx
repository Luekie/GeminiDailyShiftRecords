import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin, isAdmin } from '@/lib/supabaseAdmin';
import { useAtomValue } from 'jotai';
import { userAtom } from '../store/auth';
import { cn } from '@/lib/utils';
import {
  Plus,
  Edit,
  Trash2,
  Mail,
  Shield,
  User,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  username: string;
  role: 'attendant' | 'supervisor' | 'manager';
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
}

interface UserManagementProps {
  isDarkMode: boolean;
}

export default function UserManagement({ isDarkMode }: UserManagementProps) {
  const currentUser = useAtomValue(userAtom);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    role: 'attendant' as 'attendant' | 'supervisor' | 'manager',
    sendInvite: true,
    password: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get users from your users table (profile data)
      // Get users from your users table (profile data)
      // Use standard client (RLS should allow managers to view users)
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .order('username', { ascending: true });

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw new Error(`Failed to fetch users: ${profileError.message}`);
      }

      // Get auth users to check email confirmation status
      if (supabaseAdmin) {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();

        if (authError) {
          console.warn('Could not fetch auth data:', authError);
          // Continue with just profile data
          setUsers(profileData || []);
        } else {
          // Merge profile data with auth data
          const mergedUsers = (profileData || []).map(profile => {
            const authUser = authData.users.find(auth => auth.id === profile.id);
            return {
              ...profile,
              email: authUser?.email || profile.email || '',
              email_confirmed_at: authUser?.email_confirmed_at,
              last_sign_in_at: authUser?.last_sign_in_at,
              status: authUser?.email_confirmed_at ? 'active' : 'pending'
            };
          });
          setUsers(mergedUsers);
        }
      } else {
        // No admin client available, just use profile data
        setUsers(profileData || []);
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      showNotification(error.message || 'Failed to fetch users', 'error');
    }
    setLoading(false);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Email is optional - will auto-generate if missing
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }

    // Check if email or username already exists
    const emailExists = users.some(user =>
      formData.email.trim() &&
      user.email?.toLowerCase() === formData.email.toLowerCase() &&
      (!editingUser || user.id !== editingUser.id)
    );
    const usernameExists = users.some(user =>
      user.username.toLowerCase() === formData.username.toLowerCase() &&
      (!editingUser || user.id !== editingUser.id)
    );

    if (emailExists) {
      errors.email = 'Email already exists';
    }
    if (usernameExists) {
      errors.username = 'Username already exists';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createUser = async () => {
    if (!validateForm()) return;

    // Check admin permissions
    if (!isAdmin(currentUser)) {
      showNotification('Unauthorized: Admin access required', 'error');
      return;
    }

    // Check if admin client is available
    if (!supabaseAdmin) {
      showNotification('Admin functions not available. Please configure VITE_SUPABASE_SERVICE_ROLE_KEY environment variable.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Auto-generate email if missing
      const emailToUse = formData.email?.trim() || `${formData.username.replace(/\s+/g, '').toLowerCase()}@gemini.local`;

      let authUser;

      if (formData.sendInvite) {
        // Create user and send invite in one step
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          emailToUse,
          {
            redirectTo: `${window.location.origin}/`,
            data: {
              username: formData.username,
              role: formData.role
            }
          }
        );

        if (inviteError) throw inviteError;
        authUser = inviteData.user;
        showNotification('User created and invite email sent', 'success');
      } else {
        // Create user without invite (auto-confirm)
        if (!formData.password && !formData.sendInvite) {
          showNotification('Password is required for manual setup', 'error');
          setSubmitting(false);
          return;
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: emailToUse,
          password: formData.password,
          email_confirm: true,
          user_metadata: {
            username: formData.username,
            role: formData.role
          }
        });

        if (authError) throw authError;
        authUser = authData.user;
        showNotification('User created successfully with manual password', 'success');
      }

      if (!authUser) throw new Error('Failed to create auth user');

      // Create profile record in your users table
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: emailToUse,
          username: formData.username,
          role: formData.role,
          status: formData.sendInvite ? 'pending' : 'active',
          created_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // Reset form and close modal
      setFormData({ email: '', username: '', role: 'attendant', sendInvite: true, password: '' });
      setShowCreateModal(false);
      fetchUsers(); // Refresh list

    } catch (error: any) {
      console.error('Error creating user:', error);
      showNotification(error.message || 'Failed to create user', 'error');
    }
    setSubmitting(false);
  };

  const updateUser = async () => {
    if (!editingUser || !validateForm()) return;

    setSubmitting(true);
    try {
      // Update profile in your users table
      const { error: profileError } = await supabase
        .from('users')
        .update({
          username: formData.username,
          role: formData.role
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update auth user metadata
      let authError;
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          editingUser.id,
          {
            user_metadata: {
              username: formData.username,
              role: formData.role
            }
          }
        );
        authError = error;
      }

      if (authError) {
        console.warn('Failed to update auth metadata:', authError);
      }

      showNotification('User updated successfully', 'success');
      setEditingUser(null);
      setFormData({ email: '', username: '', role: 'attendant', sendInvite: true });
      fetchUsers(); // Refresh list

    } catch (error: any) {
      console.error('Error updating user:', error);
      showNotification(error.message || 'Failed to update user', 'error');
    }
    setSubmitting(false);
  };

  const suspendUser = async (userId: string) => {
    try {
      // Update user status in your table
      const { error: profileError } = await supabase
        .from('users')
        .update({ status: 'suspended' })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Optionally disable auth user (this will prevent login)
      // Note: This requires service role key, might not work with RLS
      try {
        if (supabaseAdmin) await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'indefinite' });
      } catch (authError) {
        console.warn('Could not suspend auth user:', authError);
      }

      showNotification('User suspended successfully', 'success');
      fetchUsers();
    } catch (error: any) {
      console.error('Error suspending user:', error);
      showNotification(error.message || 'Failed to suspend user', 'error');
    }
  };

  const reactivateUser = async (userId: string) => {
    try {
      // Update user status in your table
      const { error: profileError } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Remove ban from auth user
      try {
        if (supabaseAdmin) await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      } catch (authError) {
        console.warn('Could not reactivate auth user:', authError);
      }

      showNotification('User reactivated successfully', 'success');
      fetchUsers();
    } catch (error: any) {
      console.error('Error reactivating user:', error);
      showNotification(error.message || 'Failed to reactivate user', 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete from your users table first
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Delete auth user
      let authError;
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        authError = error;
      }

      if (authError) {
        console.warn('Failed to delete auth user:', authError);
        showNotification('User profile deleted but auth user remains', 'warning');
      } else {
        showNotification('User deleted successfully', 'success');
      }

      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showNotification(error.message || 'Failed to delete user', 'error');
    }
  };

  const resendInvite = async (email: string) => {
    try {
      if (!supabaseAdmin) throw new Error('Admin functions not available');

      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${window.location.origin}/`
      });

      if (error) throw error;
      showNotification('Invite email sent successfully', 'success');
    } catch (error: any) {
      console.error('Error sending invite:', error);
      showNotification(error.message || 'Failed to send invite', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'warning') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-xl shadow-lg z-50 ${type === 'success' ? 'bg-green-500 text-white' :
      type === 'warning' ? 'bg-yellow-500 text-white' :
        'bg-red-500 text-white'
      }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 4000);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'manager':
        return <Shield className="w-4 h-4 text-purple-500" />;
      case 'supervisor':
        return <Eye className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-green-500" />;
    }
  };

  const getStatusBadge = (user: User) => {
    if (user.status === 'suspended') {
      return <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30">Suspended</span>;
    }
    if (!user.email_confirmed_at) {
      return <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-yellow-500/20 text-yellow-600 border border-yellow-500/30">Pending</span>;
    }
    return <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-green-500/20 text-green-600 border border-green-500/30">Active</span>;
  };

  return (
    <Card className={cn(
      "rounded-2xl shadow-lg border backdrop-blur-xl",
      isDarkMode ? "bg-white/5 border-white/10" : "bg-white/20 border-white/30"
    )}>
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className={cn("text-lg font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
            User Management
          </h3>
          <Button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              "rounded-xl px-6 py-3 font-bold text-white shadow-lg transition-all duration-200 hover:shadow-xl transform hover:scale-105",
              isDarkMode
                ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            )}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add User
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn(
                  "border-b",
                  isDarkMode ? "border-white/20" : "border-gray-300"
                )}>
                  <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    User
                  </th>
                  <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Role
                  </th>
                  <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Status
                  </th>
                  <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Last Login
                  </th>
                  <th className={cn("text-left p-3 font-semibold", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={cn(
                    "border-b hover:bg-white/5 transition-colors",
                    isDarkMode ? "border-white/10" : "border-gray-200"
                  )}>
                    <td className="p-3">
                      <div>
                        <div className={cn("font-semibold", isDarkMode ? "text-white" : "text-gray-900")}>
                          {user.username}
                        </div>
                        <div className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        <span className={cn("capitalize", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      {getStatusBadge(user)}
                    </td>
                    <td className={cn("p-3 text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingUser(user);
                            setFormData({
                              email: user.email,
                              username: user.username,
                              role: user.role,
                              sendInvite: false
                            });
                          }}
                          title="Edit user details"
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 border border-blue-500/30 rounded-lg p-1"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>

                        {!user.email_confirmed_at && (
                          <Button
                            size="sm"
                            onClick={() => resendInvite(user.email)}
                            title="Resend invitation email"
                            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 border border-yellow-500/30 rounded-lg p-1"
                          >
                            <Mail className="w-3 h-3" />
                          </Button>
                        )}

                        {user.status === 'active' ? (
                          <Button
                            size="sm"
                            onClick={() => suspendUser(user.id)}
                            title="Suspend user account"
                            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-600 border border-orange-500/30 rounded-lg p-1"
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => reactivateUser(user.id)}
                            title="Reactivate suspended user account"
                            className="bg-green-500/20 hover:bg-green-500/30 text-green-600 border border-green-500/30 rounded-lg p-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                        )}

                        {user.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            onClick={() => deleteUser(user.id)}
                            title="Delete user from the system"
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-600 border border-red-500/30 rounded-lg p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit User Modal */}
        {(showCreateModal || editingUser) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className={cn(
              "rounded-2xl shadow-2xl w-full max-w-md p-6 relative border",
              isDarkMode
                ? "bg-gray-900/95 border-white/20 text-white"
                : "bg-white/95 border-white/30 text-gray-900"
            )}>
              <h3 className="font-bold text-2xl mb-4">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!!editingUser}
                    className={cn(
                      "w-full rounded-xl",
                      formErrors.email && "border-red-500",
                      isDarkMode
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-white/50 border-gray-300 text-gray-900"
                    )}
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Username
                  </label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className={cn(
                      "w-full rounded-xl",
                      formErrors.username && "border-red-500",
                      isDarkMode
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-white/50 border-gray-300 text-gray-900"
                    )}
                  />
                  {formErrors.username && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>
                  )}
                </div>

                <div>
                  <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Role
                  </label>
                  <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger className={cn(
                      "w-full rounded-xl",
                      isDarkMode
                        ? "bg-white/10 border-white/20 text-white"
                        : "bg-white/50 border-gray-300 text-gray-900"
                    )}>
                      {formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attendant">Attendant</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!editingUser && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="sendInvite"
                        checked={formData.sendInvite}
                        onChange={(e) => setFormData({ ...formData, sendInvite: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="sendInvite" className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Send password setup email
                      </label>
                    </div>

                    {!formData.sendInvite && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                          Manual Password
                        </label>
                        <Input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Set password for this user"
                          className={cn(
                            "w-full rounded-xl",
                            isDarkMode
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-white/50 border-gray-300 text-gray-900"
                          )}
                        />
                        <p className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                          Since no email will be sent, you must provide this password to the user manually.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingUser(null);
                      setFormData({ email: '', username: '', role: 'attendant', sendInvite: true });
                      setFormErrors({});
                    }}
                    title="Close this window without saving"
                    className={cn(
                      "flex-1 rounded-xl py-2 font-semibold",
                      isDarkMode
                        ? "bg-gray-700 hover:bg-gray-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                    )}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingUser ? updateUser : createUser}
                    disabled={submitting}
                    title={editingUser ? "Save changes to this user" : "Create new user account"}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-2 font-semibold disabled:opacity-50"
                  >
                    {submitting ? 'Processing...' : (editingUser ? 'Update User' : 'Create User')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}