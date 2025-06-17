import { useState, useEffect } from "react";
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
  const [, setLocation] = useLocation();
  const login = useLogin();
  const user = useAtomValue(userAtom) as AuthUser | null;

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === 'attendant') setLocation('/attendant');
      else if (user.role === 'supervisor') setLocation('/supervisor');
      else if (user.role === 'manager') setLocation('/manager');
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
      className="min-h-screen flex items-center justify-center bg-gray-200"
      style={{
          backgroundImage: 'url("/puma.jpg")', // Replace with your image path
    backgroundSize: 'cover', // Ensures the image covers the entire screen
    backgroundPosition: 'center', // Centers the image
    backgroundRepeat: 'no-repeat',
        fontFamily: 'San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        color: '#111',
      }}
    >
      <form
        onSubmit={handleLogin} // Handle Enter key and button click
        className="max-w-sm w-full p-8 bg-white/40 rounded-2xl shadow-lg border border-gray-200"
        style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.08)' }}
      >
        <h2
          className="text-2xl font-bold mb-6 text-center tracking-tight"
          style={{ color: '#111' }}
        >
          Login
        </h2>
        <input
          type="text"
          className="w-full mb-4 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white/40 text-base"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ fontFamily: 'inherit' }}
        />
        <div className="relative w-full mb-4">
          <input
            type={showPassword ? "text" : "password"}
            className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white/50 text-base font-inherit"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
        {/* <label className="flex items-center mb-4 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword((v) => !v)}
            className="mr-2 accent-blue-500"
          />
          Show password
        </label> */}
        {error && <div className="text-red-500 mb-3 text-sm text-center">{error}</div>}
        <button
          type="submit" // Ensure the button submits the form
          className="w-full py-2 rounded-lg font-semibold text-base transition bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-black border border-gray-300 shadow focus:ring-2 focus:ring-blue-400"
          style={{ fontFamily: 'inherit', letterSpacing: 0.5 }}
        >
          Login
        </button>
        <div className="pt-4 text-lg text-black font-bold  text-center">
          attendant name: lusekero password: pass124<br />
          supervisor name: denis password: pass125<br />
          manager: name: arnold password: pass123
        </div>
      </form>
    </div>
  );
}