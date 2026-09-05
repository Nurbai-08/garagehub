import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { User } from "@/entities/user";
import { isUnauthorized, setAccessToken } from "@/shared/api";
import { authApi, restoreAuthSession } from "../api/authApi";

type AuthContextValue = {
  user: User | null;
  isRestoring: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const version = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    const startedAt = version.current;
    const restore = async () => {
      try {
        const session = await restoreAuthSession();
        if (active && startedAt === version.current) {
          setUser(session.user);
          await queryClient.invalidateQueries();
        }
      } catch (error) {
        if (active && startedAt === version.current && isUnauthorized(error)) setAccessToken(null);
      } finally {
        if (active) setRestoring(false);
      }
    };
    void restore();
    const expired = () => {
      version.current += 1;
      queryClient.clear();
      setUser(null);
    };
    window.addEventListener("auth:expired", expired);
    return () => {
      active = false;
      window.removeEventListener("auth:expired", expired);
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isRestoring,
      login: async (input) => {
        const data = await authApi.login(input);
        version.current += 1;
        await queryClient.cancelQueries();
        queryClient.clear();
        setAccessToken(data.access_token);
        setUser(data.user);
      },
      register: async (input) => {
        const data = await authApi.register(input);
        version.current += 1;
        await queryClient.cancelQueries();
        queryClient.clear();
        setAccessToken(data.access_token);
        setUser(data.user);
      },
      logout: async () => {
        version.current += 1;
        setAccessToken(null);
        await queryClient.cancelQueries();
        queryClient.clear();
        setUser(null);
        try {
          await authApi.logout();
        } catch {
          // Keep the local logout even if the server is unreachable.
        }
      },
    }),
    [user, isRestoring, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
