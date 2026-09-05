import type { User } from "@/entities/user";
import { api, refreshApi, setAccessToken } from "@/shared/api";

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export const authApi = {
  login: async (input: { email: string; password: string }) =>
    (await api.post<TokenResponse>("/auth/login", input)).data,
  register: async (input: {
    email: string;
    username: string;
    password: string;
  }) => (await api.post<TokenResponse>("/auth/register", input)).data,
  refresh: async () =>
    (await refreshApi.post<TokenResponse>("/auth/refresh")).data,
  me: async () => (await api.get<User>("/auth/me")).data,
  logout: async () => {
    await api.post("/auth/logout");
    setAccessToken(null);
  },
};

export async function restoreAuthSession() {
  return authApi.refresh();
}
