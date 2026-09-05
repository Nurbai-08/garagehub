import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "/api/v1";
let accessToken: string | null = null;
let refreshRequest: Promise<{ access_token: string }> | null = null;

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
  accessToken = token;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config as
    | (InternalAxiosRequestConfig & { _retried?: boolean })
    | undefined;
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
    cannotRefresh
  )
    throw error;

  request._retried = true;
  refreshRequest ??= refreshApi
    .post<{ access_token: string }>("/auth/refresh")
    .then(({ data }) => {
      setAccessToken(data.access_token);
      return data;
    })
    .finally(() => {
      refreshRequest = null;
    });
  await refreshRequest;
  return api(request);
});
