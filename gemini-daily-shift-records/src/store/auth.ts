// src/store/auth.ts
import { atom } from "jotai";

export interface AuthUser {
  must_change_password: any;
  id: string;
  username: string;
  role: string;
}

export const userAtom = atom<AuthUser | null>(null); // Store logged-in user info
