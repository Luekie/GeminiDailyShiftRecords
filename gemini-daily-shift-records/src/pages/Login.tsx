import { useState, useEffect } from "react";
import { supabase } from '@/lib/supabase';
import { useLocation } from "wouter";
import { useLogin } from '../hooks/useLogin';
import { useAtomValue } from 'jotai';
import { userAtom } from '../store/auth';
import { Eye, EyeOff } from "lucide-react";
import type { AuthUser } from '../store/auth';

export default function LoginPage() {
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
    <div
      className="min-h-screen flex items-center justify-center bg-gray-200 relative"
      style={{
        backgroundImage: 'url("/puma.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        fontFamily: 'San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        color: '#111',
      }}
    >


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
        className="max-w-sm w-full p-8 bg-white/40 rounded-2xl shadow-lg border border-gray-200 relative"
        style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.08)' }}
      >
        <h2
          className="text-2xl font-bold mb-6 text-center tracking-tight"
          style={{ color: '#111' }}
        >
          Gemini
        </h2>
        <input
          type="text"
          className="w-full mb-4 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white/40 text-base"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ fontFamily: 'inherit' }}
          autoComplete="username"
          name="username"
        />
        <div className="relative w-full mb-4">
          <input
            type={showPassword ? "text" : "password"}
            className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white/50 text-base font-inherit"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800 focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        </div>
        {error && <div className="text-red-500 mb-3 text-sm text-center">{error}</div>}
        <button
          type="submit"
          className="w-full py-2 rounded-lg font-semibold text-base transition bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-black border border-gray-300 shadow focus:ring-2 focus:ring-blue-400"
          style={{ fontFamily: 'inherit', letterSpacing: 0.5 }}
        >
          Login
        </button>
        <div className="pt-4 text-lg text-black font-bold  text-center"></div>
        <div className="absolute left-4 bottom-4">
          <button
            type="button"
            className="text-black pl-5 font-semibold text-sm hover:text-gray-100"
            style={{letterSpacing: 0.5, textDecoration: 'none'}} 
            onClick={() => setShowChangePassword(true)}
          >
            Change Password
          </button>
        </div>
      </form>
    </div>
  );
}