// src/hooks/useLogin.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSetAtom } from 'jotai';
import { userAtom } from '../store/auth';

export function useLogin() {
  const setUser = useSetAtom(userAtom);

  return useMutation({
    mutationFn: async ({ username, password, passwordField = 'password' }: { username: string; password: string; passwordField?: string }) => {
      // Use the correct password field for the query
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .eq(passwordField, password)
        .single();

      if (error || !data) throw new Error("Invalid credentials");
      return data;
    },
    onSuccess: (data) => setUser(data),
  });
}
