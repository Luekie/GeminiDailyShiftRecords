// src/store/auth.ts
import { atom } from "jotai";

export interface AuthUser {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  email?: string;
  role: string;
  must_change_password?: any;
}

export const userAtom = atom<AuthUser | null>(null); // Store logged-in user info
