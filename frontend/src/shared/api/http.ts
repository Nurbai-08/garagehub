import axios, { AxiosError, CanceledError, type InternalAxiosRequestConfig } from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "/api/v1";
let accessToken: string | null = null;
let refreshRequest: Promise<{ access_token: string }> | null = null;
let sessionVersion = 0;

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 8000,
});
export const refreshApi = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 8000,
});

export function setAccessToken(token: string | null) {
  sessionVersion += 1;
  accessToken = token;
  refreshRequest = null;
}

export function refreshSession<T extends { access_token: string }>() {
  if (!refreshRequest) {
    const version = sessionVersion;
    const pending = refreshApi.post<T>("/auth/refresh").then(({ data }) => {
      if (version !== sessionVersion) throw new CanceledError("Session changed");
      accessToken = data.access_token;
      return data;
    }).catch((error) => {
      if (version === sessionVersion && axios.isAxiosError(error) && error.response?.status === 401) {
        setAccessToken(null);
        window.dispatchEvent(new Event("auth:expired"));
      }
      throw error;
    }).finally(() => {
      if (refreshRequest === pending) refreshRequest = null;
    });
    refreshRequest = pending;
  }
  return refreshRequest as Promise<T>;
}

type SessionRequest = InternalAxiosRequestConfig & { _retried?: boolean; _sessionVersion?: number };

api.interceptors.request.use((config: SessionRequest) => {
  config._sessionVersion = sessionVersion;
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  else config.headers.delete("Authorization");
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config as SessionRequest | undefined;
  const url = request?.url ?? "";
  const cannotRefresh = [
    "/auth/login",
    "/auth/register",
    "/auth/refresh",
    "/auth/logout",
  ].some((path) => url.includes(path));
  if (
    error.response?.status !== 401 ||
    !request ||
    request._retried ||
    request._sessionVersion !== sessionVersion ||
    cannotRefresh
  )
    throw error;

  request._retried = true;
  await refreshSession();
  return api(request);
});
