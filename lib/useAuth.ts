"use client";
import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "PLAYER" | "STAFF" | "OWNER" | "ADMIN";
  balance: number;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role?: "PLAYER" | "OWNER";
  }) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);
