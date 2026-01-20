// src/hooks/useLogin.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSetAtom } from 'jotai';
import { userAtom } from '../store/auth';

export function useLogin() {
  const setUser = useSetAtom(userAtom);

  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      try {
        // First, try to find the user by username to get their email
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, username, email, role")
          .eq("username", username)
          .single();

        let email = username;
        
        // If we found a user by username, use their email for auth
        if (userData && !userError) {
          email = userData.email || username;
        }
        
        // If username lookup failed and username doesn't look like email, 
        // it might be an invalid username
        if (userError && !username.includes('@')) {
          throw new Error("Invalid username or password. Please check your credentials and try again.");
        }

        console.log(`Attempting Supabase Auth login for: ${email}`);

        // Try to sign in with Supabase Auth using email/password
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (authError) {
          console.error("Supabase Auth failed:", authError.message);
          // Handle different auth error types
          if (authError.message?.includes('Invalid login credentials')) {
            throw new Error("Invalid username or password. Please check your credentials and try again.");
          }
          if (authError.message?.includes('Email not confirmed')) {
            throw new Error("Please check your email and confirm your account before logging in.");
          }
          if (authError.message?.includes('network') || authError.message?.includes('fetch')) {
            throw new Error("Connection failed. Please check your internet connection and try again.");
          }
          throw new Error(`Login failed: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error("Invalid username or password. Please check your credentials and try again.");
        }

        // Get the user profile data from your users table
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        if (profileError || !profileData) {
          // Fallback: Try by username for legacy users
          const { data: profileByUsername, error: errorByUsername } = await supabase
            .from("users")
            .select("*")
            .eq("username", username)
            .single();
          
          if (profileByUsername) {
            return profileByUsername;
          }
          
          throw new Error("User profile not found. Please contact your administrator.");
        }

        return profileData;
      } catch (err: any) {
        // Handle network errors that might not be caught above
        if (err.name === 'TypeError' && err.message?.includes('fetch')) {
          throw new Error("Connection failed. Please check your internet connection and try again.");
        }
        
        // Re-throw our custom errors (don't modify them)
        throw err;
      }
    },
    onSuccess: (data) => setUser(data),
  });
}
