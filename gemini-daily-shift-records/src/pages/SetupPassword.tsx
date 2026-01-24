import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { GlobalBackground } from '../components/GlobalBackground';
import { cn } from '@/lib/utils';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertTriangle,
  User,
  Shield
} from 'lucide-react';

export default function SetupPassword() {
  const [, setLocation] = useLocation();
  const { isDarkMode } = useTheme();
  
  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  
  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  useEffect(() => {
    // Check if user is coming from invite link
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Get tokens from either query params or hash params
    const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');
    const type = urlParams.get('type') || hashParams.get('type');
    
    console.log('URL params:', { 
      search: window.location.search,
      hash: window.location.hash,
      accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : null, 
      refreshToken: refreshToken ? `${refreshToken.substring(0, 10)}...` : null, 
      type 
    });
    
    // Validate tokens before attempting to set session
    if (accessToken && refreshToken && accessToken.length > 10 && refreshToken.length > 10) {
      console.log('Setting session with valid tokens...');
      // Set the session from URL params
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ data, error }) => {
        if (error) {
          console.error('Session error:', error);
          setError('Invalid or expired invitation link. Please contact your manager for a new invitation.');
        } else if (data.user) {
          console.log('User from session:', data.user);
          setUserInfo({
            email: data.user.email,
            role: data.user.user_metadata?.role || 'attendant'
          });
        } else {
          console.error('No user in session data');
          setError('Invalid invitation link. Please contact your manager.');
        }
      }).catch((err) => {
        console.error('Session setup failed:', err);
        setError('Failed to process invitation link. Please try again or contact your manager.');
      });
    } else if (accessToken || refreshToken) {
      // Tokens present but invalid
      console.log('Invalid tokens detected');
      setError('Invalid or incomplete invitation link. Please use the complete link from your email or contact your manager for a new invitation.');
    } else {
      console.log('No tokens found, checking if user is already logged in...');
      // Check if user is already logged in (for testing)
      supabase.auth.getUser().then(({ data, error }) => {
        if (data.user && !error) {
          console.log('User already logged in:', data.user);
          setUserInfo({
            email: data.user.email,
            role: data.user.user_metadata?.role || 'attendant'
          });
        } else {
          console.log('No user found, showing error');
          setError('No invitation link found. Please use the link from your email or contact your manager.');
        }
      });
    }
  }, []);

  useEffect(() => {
    // Check password strength
    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>\/\-_+=~`\[\]\\';]/.test(password)
    });
  }, [password]);

  const isPasswordStrong = Object.values(passwordStrength).every(Boolean);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    if (!isPasswordStrong) {
      setError('Please ensure your password meets all requirements');
      return;
    }
    
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', username.trim())
        .single();
        
      if (existingUser) {
        setError('Username is already taken. Please choose another.');
        setLoading(false);
        return;
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // Get current user to update profile
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Update user profile in the users table
        const { error: profileError } = await supabase
          .from('users')
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            username: username.trim(),
            gender: gender
          })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      // Show success message
      showNotification('Profile setup completed! Redirecting to login...', 'success');
      
      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        setLocation('/');
      }, 2000);

    } catch (error: any) {
      console.error('Error setting up profile:', error);
      setError(error.message || 'Failed to set up profile');
    }
    
    setLoading(false);
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-xl shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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
        return <Shield className="w-5 h-5 text-purple-500" />;
      case 'supervisor':
        return <Eye className="w-5 h-5 text-blue-500" />;
      default:
        return <User className="w-5 h-5 text-green-500" />;
    }
  };

  const getStrengthColor = (met: boolean) => {
    return met ? 'text-green-500' : 'text-gray-400';
  };

  return (
    <>
      <GlobalBackground />
      <div className="relative min-h-screen flex items-center justify-center p-4 z-10">
        <Card className={cn(
          "w-full max-w-md rounded-3xl shadow-2xl border backdrop-blur-xl",
          isDarkMode 
            ? "bg-white/5 border-white/10" 
            : "bg-white/20 border-white/30"
        )}>
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className={cn(
                "w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center",
                isDarkMode ? "bg-blue-500/20" : "bg-blue-500/30"
              )}>
                <Lock className="w-8 h-8 text-blue-400" />
              </div>
              <h1 className={cn("text-2xl font-bold mb-2", isDarkMode ? "text-white" : "text-gray-900")}>
                Complete Your Profile
              </h1>
              <p className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                Set up your profile information and create a secure password
              </p>
            </div>

            {userInfo && (
              <div className={cn(
                "mb-6 p-4 rounded-xl border",
                isDarkMode ? "bg-white/5 border-white/10" : "bg-white/30 border-white/30"
              )}>
                <div className="flex items-center gap-3">
                  {getRoleIcon(userInfo.role)}
                  <div>
                    <div className={cn("font-semibold", isDarkMode ? "text-white" : "text-gray-900")}>
                      {userInfo.email}
                    </div>
                    <div className={cn("text-sm capitalize", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                      {userInfo.role} Account Setup
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!userInfo && !error && (
              <div className="mb-6 p-4 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                <p className="text-blue-600 text-sm">Processing invitation link...</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-600 text-sm">{error}</p>
                  <details className="mt-2">
                    <summary className="text-xs text-red-500 cursor-pointer">Debug Info</summary>
                    <div className="text-xs text-red-400 mt-1 font-mono">
                      <div>URL: {window.location.href}</div>
                      <div>Search: {window.location.search}</div>
                      <div>Hash: {window.location.hash}</div>
                    </div>
                  </details>
                </div>
              </div>
            )}

            <form onSubmit={handleSetupPassword} className="space-y-6">
              {/* Profile Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    First Name *
                  </label>
                  <Input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={cn(
                      "w-full rounded-xl border backdrop-blur-sm",
                      isDarkMode 
                        ? "bg-white/10 border-white/20 text-white" 
                        : "bg-white/30 border-white/40 text-gray-900"
                    )}
                    placeholder="Enter your first name"
                    required
                  />
                </div>
                
                <div>
                  <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Last Name *
                  </label>
                  <Input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={cn(
                      "w-full rounded-xl border backdrop-blur-sm",
                      isDarkMode 
                        ? "bg-white/10 border-white/20 text-white" 
                        : "bg-white/30 border-white/40 text-gray-900"
                    )}
                    placeholder="Enter your last name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Username *
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className={cn(
                    "w-full rounded-xl border backdrop-blur-sm",
                    isDarkMode 
                      ? "bg-white/10 border-white/20 text-white" 
                      : "bg-white/30 border-white/40 text-gray-900"
                  )}
                  placeholder="Choose a username (lowercase, numbers, underscore only)"
                  required
                />
                <p className={cn("text-xs mt-1", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                  This will be used for login. Minimum 3 characters.
                </p>
              </div>

              <div>
                <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Gender
                </label>
                <Select value={gender} onValueChange={(value: any) => setGender(value)}>
                  <SelectTrigger className={cn(
                    "w-full rounded-xl border backdrop-blur-sm",
                    isDarkMode 
                      ? "bg-white/10 border-white/20 text-white" 
                      : "bg-white/30 border-white/40 text-gray-900"
                  )}>
                    {gender === 'male' ? 'Male' : 
                     gender === 'female' ? 'Female' : 
                     gender === 'other' ? 'Other' : 
                     'Prefer not to say'}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Password Input */}
              <div>
                <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  New Password *
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(
                      "w-full pr-12 rounded-xl border backdrop-blur-sm",
                      isDarkMode 
                        ? "bg-white/10 border-white/20 text-white" 
                        : "bg-white/30 border-white/40 text-gray-900"
                    )}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicators */}
              {password && (
                <div className={cn(
                  "p-4 rounded-xl border",
                  isDarkMode ? "bg-white/5 border-white/10" : "bg-white/30 border-white/30"
                )}>
                  <h4 className={cn("font-semibold mb-3 text-sm", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                    Password Requirements:
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className={cn("flex items-center gap-2", getStrengthColor(passwordStrength.length))}>
                      <CheckCircle className="w-4 h-4" />
                      At least 8 characters
                    </div>
                    <div className={cn("flex items-center gap-2", getStrengthColor(passwordStrength.uppercase))}>
                      <CheckCircle className="w-4 h-4" />
                      One uppercase letter
                    </div>
                    <div className={cn("flex items-center gap-2", getStrengthColor(passwordStrength.lowercase))}>
                      <CheckCircle className="w-4 h-4" />
                      One lowercase letter
                    </div>
                    <div className={cn("flex items-center gap-2", getStrengthColor(passwordStrength.number))}>
                      <CheckCircle className="w-4 h-4" />
                      One number
                    </div>
                    <div className={cn("flex items-center gap-2", getStrengthColor(passwordStrength.special))}>
                      <CheckCircle className="w-4 h-4" />
                      One special character
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm Password Input */}
              <div>
                <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={cn(
                      "w-full pr-12 rounded-xl border backdrop-blur-sm",
                      isDarkMode 
                        ? "bg-white/10 border-white/20 text-white" 
                        : "bg-white/30 border-white/40 text-gray-900",
                      confirmPassword && !passwordsMatch && "border-red-500"
                    )}
                    placeholder="Confirm your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !isPasswordStrong || !passwordsMatch}
                className={cn(
                  "w-full rounded-xl py-3 font-semibold transition-all duration-200",
                  "bg-blue-500 hover:bg-blue-600 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Setting up Profile...
                  </div>
                ) : (
                  'Complete Profile Setup'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                By setting your password, you agree to keep your account secure and not share your credentials.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}