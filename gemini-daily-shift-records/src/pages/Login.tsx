// src/pages/Login.tsx

import { useState } from "react";
import { useLocation } from "wouter";
import Layout from "../components/Layout";
import { useLogin } from '../hooks/useLogin';
import { useAtomValue } from 'jotai';
import { userAtom } from '../store/auth';
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
  if (user) {
    if (user.role === 'attendant') setLocation('/attendant');
    else if (user.role === 'supervisor') setLocation('/supervisor');
    else if (user.role === 'manager') setLocation('/manager');
  }

  const handleLogin = async () => {
    setError("");
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    console.log('Attempting login:', { username: trimmedUsername, password: trimmedPassword });
    try {
      // Use password_hash for Supabase query
      await login.mutateAsync({ username: trimmedUsername, password: trimmedPassword, passwordField: 'password_hash' });
      // userAtom will be set by useLogin on success, triggering redirect above
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <Layout>
      <div className="max-w-sm mx-auto mt-20 p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">Login</h2>
        <input
          type="text"
          className="input w-full mb-3"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type={showPassword ? "text" : "password"}
          className="input w-full mb-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="flex items-center mb-3 text-sm">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword((v) => !v)}
            className="mr-2"
          />
          Show password
        </label>
        {error && <div className="text-red-500 mb-2 text-sm">{error}</div>}
        <button
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
        >
          Login
        </button>
      </div>
    </Layout>
  );
}
