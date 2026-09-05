import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, refreshApi, refreshSession, setAccessToken } from "./http";

const adapter = api.defaults.adapter;

beforeEach(() => setAccessToken(null));
afterEach(() => {
  vi.restoreAllMocks();
  api.defaults.adapter = adapter;
});

describe("session refresh", () => {
  it("shares one refresh request between concurrent consumers", async () => {
    const post = vi.spyOn(refreshApi, "post").mockResolvedValue({ data: { access_token: "fresh" } });
    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("does not restore a token after logout while refresh is pending", async () => {
    let resolve!: (value: Partial<AxiosResponse>) => void;
    vi.spyOn(refreshApi, "post").mockImplementation(() => new Promise((done) => { resolve = done; }));
    const pending = refreshSession();
    setAccessToken(null);
    resolve({ data: { access_token: "old-session" } });
    await expect(pending).rejects.toThrow("Session changed");
    api.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBeUndefined();
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };
    await api.get("/cars");
  });

  it("retries simultaneous expired requests with one fresh token", async () => {
    setAccessToken("expired");
    const refresh = vi.spyOn(refreshApi, "post").mockResolvedValue({ data: { access_token: "fresh" } });
    api.defaults.adapter = async (config) => {
      if (config.headers.Authorization === "Bearer expired") {
        throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, undefined, {
          data: {}, status: 401, statusText: "Unauthorized", headers: {}, config,
        });
      }
      expect(config.headers.Authorization).toBe("Bearer fresh");
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };
    await Promise.all([api.get("/me/cars"), api.get("/me/favorites")]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
