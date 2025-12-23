// src/hooks/useLogin.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSetAtom } from 'jotai';
import { userAtom } from '../store/auth';

export function useLogin() {
  const setUser = useSetAtom(userAtom);

  return useMutation({
    mutationFn: async ({ username, password, passwordField = 'password' }: { username: string; password: string; passwordField?: string }) => {
      try {
        // Use the correct password field for the query
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("username", username)
          .eq(passwordField, password)
          .single();

        // Handle different types of errors
        if (error) {
          // Network/connection errors
          if (error.message?.includes('fetch') || 
              error.message?.includes('network') || 
              error.message?.includes('Failed to fetch') ||
              error.code === 'PGRST301' || // Connection error
              error.code === 'PGRST116') { // Connection timeout
            throw new Error("Connection failed. Please check your internet connection and try again.");
          }
          
          // No rows returned (invalid credentials)
          if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
            throw new Error("Invalid username or password. Please check your credentials and try again.");
          }
          
          // Other database errors
          throw new Error(`Login failed: ${error.message || 'Unknown error occurred'}`);
        }

        if (!data) {
          throw new Error("Invalid username or password. Please check your credentials and try again.");
        }

        return data;
      } catch (err: any) {
        // Handle network errors that might not be caught above
        if (err.name === 'TypeError' && err.message?.includes('fetch')) {
          throw new Error("Connection failed. Please check your internet connection and try again.");
        }
        
        // Re-throw our custom errors
        if (err.message?.includes('Connection failed') || 
            err.message?.includes('Invalid username') ||
            err.message?.includes('Login failed:')) {
          throw err;
        }
        
        // Generic fallback for unexpected errors
        throw new Error("Login failed. Please try again or contact support if the problem persists.");
      }
    },
    onSuccess: (data) => setUser(data),
  });
}
