import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
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
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setRestoring] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const session = await restoreAuthSession();
        if (session.access_token) setAccessToken(session.access_token);
        setUser(session.user);
      } catch (error) {
        if (isUnauthorized(error)) {
          setAccessToken(null);
        }
      } finally {
        setRestoring(false);
      }
    };
    void restore();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isRestoring,
      login: async (input) => {
        const data = await authApi.login(input);
        setAccessToken(data.access_token);
        setUser(data.user);
      },
      register: async (input) => {
        const data = await authApi.register(input);
        setAccessToken(data.access_token);
        setUser(data.user);
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
    }),
    [user, isRestoring],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
