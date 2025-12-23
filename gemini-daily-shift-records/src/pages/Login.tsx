import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase';
import { useLocation } from "wouter";
import { useLogin } from '../hooks/useLogin';
import { useAtomValue } from 'jotai';
import { userAtom } from '../store/auth';
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import type { AuthUser } from '../store/auth';
import { useTheme } from '../contexts/ThemeContext';
import { GlobalBackground } from '../components/GlobalBackground';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpUsername, setCpUsername] = useState("");
  const [cpOldPassword, setCpOldPassword] = useState("");
  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirmPassword, setCpConfirmPassword] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState("");
  const [, setLocation] = useLocation();
  // Track if user must change password after login
  const [forceChangePassword, setForceChangePassword] = useState(false);
  const [forceUser, setForceUser] = useState<any>(null);
  const login = useLogin();
  const user = useAtomValue(userAtom) as AuthUser | null;

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      // If must_change_password is true, force modal and block navigation
      if (user.must_change_password) {
        setForceChangePassword(true);
        setForceUser(user);
        setShowChangePassword(true);
      } else {
        if (user.role === 'attendant') setLocation('/attendant');
        else if (user.role === 'supervisor') setLocation('/supervisor');
        else if (user.role === 'manager') setLocation('/manager');
      }
    }
  }, [user, setLocation]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault(); // Prevent default form submission behavior
    setError("");
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    console.log('Attempting login:', { username: trimmedUsername });
    try {
      // Use password_hash for Supabase query
      await login.mutateAsync({ username: trimmedUsername, password: trimmedPassword, passwordField: 'password_hash' });
      // userAtom will be set by useLogin on success, triggering redirect above
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <>
      <GlobalBackground />
      <div className="relative min-h-screen flex items-center justify-center px-4 z-10">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDarkMode}
          className={cn(
            "absolute top-4 right-4 rounded-xl p-2 transition-all duration-200",
            isDarkMode 
              ? "hover:bg-white/10 text-white" 
              : "hover:bg-white/20 text-gray-700"
          )}
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>


      {/* Change Password Modal with modern styling */}
      {(showChangePassword || forceChangePassword) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md p-6 relative border border-white/30" onClick={e => e.stopPropagation()}>
            {!forceChangePassword && (
              <button className="absolute top-3 right-3 text-gray-400 hover:text-red-600 text-3xl font-bold transition-colors" onClick={() => setShowChangePassword(false)} aria-label="Close">×</button>
            )}
            <h3 className="font-bold text-2xl mb-6 text-center text-gray-900 flex items-center justify-center gap-2">
              <span className="text-3xl">🔐</span>
              Change Password
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCpError("");
                setCpSuccess("");
                // If forced, use forceUser for username and old password
                const usernameToCheck = forceChangePassword && forceUser ? forceUser.username : cpUsername;
                const oldPasswordToCheck = forceChangePassword && forceUser ? password : cpOldPassword;
                const newPasswordToSet = cpNewPassword;
                const confirmPasswordToSet = cpConfirmPassword;
                if (!usernameToCheck || !oldPasswordToCheck || !newPasswordToSet || !confirmPasswordToSet) {
                  setCpError("All fields are required.");
                  return;
                }
                if (newPasswordToSet.length < 8) {
                  setCpError("Password must be at least 8 characters long.");
                  return;
                }
                if (!/^[A-Z]/.test(newPasswordToSet)) {
                  setCpError("Password must start with a capital letter.");
                  return;
                }
                if (!/[0-9]/.test(newPasswordToSet)) {
                  setCpError("Password must contain at least one number.");
                  return;
                }
                if (newPasswordToSet !== confirmPasswordToSet) {
                  setCpError("Passwords do not match.");
                  return;
                }
                // 1. Check user exists and old password is correct
                const { data: userRows, error: userErr } = await supabase
                  .from('users')
                  .select('*')
                  .eq('username', usernameToCheck)
                  .in('role', ['attendant', 'supervisor' , 'manager'])
                  .single();
                if (userErr || !userRows) {
                  setCpError("User not found .");
                  return;
                }
                // 2. Check old password
                if (userRows.password_hash !== oldPasswordToCheck) {
                  setCpError("Old password is incorrect.");
                  return;
                }
                // 3. Update password and clear must_change_password
                const { error: updateErr } = await supabase
                  .from('users')
                  .update({ password_hash: newPasswordToSet, must_change_password: false })
                  .eq('id', userRows.id);
                if (updateErr) {
                  setCpError("Failed to update password.");
                  return;
                }
                setCpSuccess("Password changed successfully!");
                setTimeout(() => {
                  setShowChangePassword(false);
                  setForceChangePassword(false);
                  setForceUser(null);
                  setCpUsername("");
                  setCpOldPassword("");
                  setCpNewPassword("");
                  setCpConfirmPassword("");
                  setCpError("");
                  setCpSuccess("");
                  // Optionally reload page or redirect
                  window.location.reload();
                }, 1500);
              }}
              className="space-y-3"
            >
              {/* If forced, show only new password fields, else show all fields */}
              {!forceChangePassword && (
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded border border-gray-300 bg-white/50"
                  placeholder="Username"
                  value={cpUsername}
                  onChange={e => setCpUsername(e.target.value)}
                />
              )}
              {!forceChangePassword && (
                <input
                  type="password"
                  className="w-full px-3 py-2 rounded border border-gray-300 bg-white/50"
                  placeholder="Old Password"
                  value={cpOldPassword}
                  onChange={e => setCpOldPassword(e.target.value)}
                  autoComplete="current-password"
                />
              )}
              {forceChangePassword && (
                <input
                  type="password"
                  className="w-full px-3 py-2 rounded border border-gray-300 bg-white/50"
                  placeholder="Old Password"
                  value={password}
                  onChange={_e => {}}
                  autoComplete="current-password"
                  disabled
                />
              )}
              <input
                type="password"
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white/50"
                placeholder="New Password"
                value={cpNewPassword}
                onChange={e => setCpNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <input
                type="password"
                className="w-full px-3 py-2 rounded border border-gray-300 bg-white/50"
                placeholder="Confirm New Password"
                value={cpConfirmPassword}
                onChange={e => setCpConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {cpError && <div className="text-red-600 text-sm text-center">{cpError}</div>}
              {cpSuccess && <div className="text-green-600 text-sm text-center">{cpSuccess}</div>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg font-semibold text-base transition bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-black border border-gray-300 shadow focus:ring-2 focus:ring-blue-400"
                >
                  Change Password
                </button>
                {forceChangePassword && (
                  <button
                    type="button"
                    className="flex-1 py-2 rounded-lg font-semibold text-base transition bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 border border-gray-300 shadow focus:ring-2 focus:ring-gray-400"
                    onClick={() => {
                      // Log out and close modal
                      setForceChangePassword(false);
                      setForceUser(null);
                      setShowChangePassword(false);
                      setCpUsername("");
                      setCpOldPassword("");
                      setCpNewPassword("");
                      setCpConfirmPassword("");
                      setCpError("");
                      setCpSuccess("");
                      localStorage.removeItem('user');
                      localStorage.removeItem('sessionExpiry');
                      window.location.reload();
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

        {/* Login Form */}
        <form
          onSubmit={handleLogin}
          className={cn(
            "max-w-sm w-full p-8 rounded-3xl shadow-2xl border backdrop-blur-xl relative",
            isDarkMode 
              ? "bg-white/5 border-white/10 text-white" 
              : "bg-white/20 border-white/30 text-gray-900"
          )}
          style={{ 
            fontFamily: 'San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
          }}
        >
          <h2 className={cn(
            "text-3xl font-bold mb-8 text-center tracking-tight",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            ⛽ Gemini
          </h2>
          
          <input
            type="text"
            className={cn(
              "w-full mb-4 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-400 focus:outline-none text-base backdrop-blur-sm transition-all",
              isDarkMode 
                ? "bg-white/10 border-white/20 text-white placeholder-gray-300" 
                : "bg-white/30 border-white/40 text-gray-900 placeholder-gray-600"
            )}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            name="username"
          />
          
          <div className="relative w-full mb-4">
            <input
              type={showPassword ? "text" : "password"}
              className={cn(
                "w-full px-4 py-3 pr-12 rounded-xl border focus:ring-2 focus:ring-blue-400 focus:outline-none text-base backdrop-blur-sm transition-all",
                isDarkMode 
                  ? "bg-white/10 border-white/20 text-white placeholder-gray-300" 
                  : "bg-white/30 border-white/40 text-gray-900 placeholder-gray-600"
              )}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              name="password"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none transition-colors duration-200 ease-in-out",
                isDarkMode ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-800"
              )}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>
          
          {error && (
            <div className={cn(
              "mb-4 text-sm text-center p-3 rounded-lg border",
              error.includes('Connection failed') || error.includes('internet connection')
                ? "text-orange-400 bg-orange-500/10 border-orange-500/20" // Network errors in orange
                : error.includes('Invalid username') || error.includes('Invalid credentials')
                ? "text-red-400 bg-red-500/10 border-red-500/20" // Credential errors in red
                : "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" // Other errors in yellow
            )}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {error.includes('Connection failed') ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                ) : error.includes('Invalid username') ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span>{error}</span>
              </div>
              {error.includes('Connection failed') && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    handleLogin();
                  }}
                  className="text-xs px-3 py-1 rounded-md bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
          
          <button
            type="submit"
            disabled={login.isPending}
            className={cn(
              "w-full py-3 rounded-xl font-semibold text-base shadow-lg transition-all duration-200 ease-in-out transform hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
              isDarkMode
                ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
                : "bg-blue-500/80 hover:bg-blue-600/90 text-white border border-blue-400"
            )}
          >
            {login.isPending ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Logging in...
              </div>
            ) : (
              'Login'
            )}
          </button>
          
          <div className="mt-4">
            <button
              type="button"
              className={cn(
                "font-semibold text-sm transition-colors duration-200 ease-in-out",
                isDarkMode ? "text-gray-300 hover:text-white" : "text-gray-700 hover:text-gray-900"
              )}
              onClick={() => setShowChangePassword(true)}
            >
              Change Password
            </button>
          </div>
        </form>
      </div>
    </>
  );
}