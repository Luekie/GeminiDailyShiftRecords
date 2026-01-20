import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');
    
    if (accessToken && refreshToken) {
      // Set the session from URL params
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ data, error }) => {
        if (error) {
          setError('Invalid or expired invitation link');
        } else if (data.user) {
          setUserInfo({
            email: data.user.email,
            username: data.user.user_metadata?.username,
            role: data.user.user_metadata?.role
          });
        }
      });
    } else {
      setError('No invitation link found. Please use the link from your email.');
    }
  }, []);

  useEffect(() => {
    // Check password strength
    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    });
  }, [password]);

  const isPasswordStrong = Object.values(passwordStrength).every(Boolean);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // Show success message
      showNotification('Password set successfully! Redirecting to login...', 'success');
      
      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        setLocation('/');
      }, 2000);

    } catch (error: any) {
      console.error('Error setting password:', error);
      setError(error.message || 'Failed to set password');
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
                Set Up Your Password
              </h1>
              <p className={cn("text-sm", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                Complete your account setup by creating a secure password
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
                      {userInfo.username}
                    </div>
                    <div className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                      {userInfo.email} • {userInfo.role}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSetupPassword} className="space-y-6">
              {/* Password Input */}
              <div>
                <label className={cn("block font-semibold mb-2", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  New Password
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
                    Setting Password...
                  </div>
                ) : (
                  'Set Password & Continue'
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