import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authApi, restoreAuthSession } from "../api/authApi";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../api/authApi", () => ({
  restoreAuthSession: vi.fn(),
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn() },
}));

const user = { id: "owner", username: "owner", email: "owner@example.com", display_name: null, avatar_url: null };
const session = { access_token: "token", token_type: "bearer", user };

function Probe() {
  const auth = useAuth();
  return <>
    <p>{auth.user?.username ?? "guest"}</p>
    <button onClick={() => void auth.logout()}>Logout</button>
    <button onClick={() => void auth.login({ email: "other@example.com", password: "password" })}>Login</button>
  </>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(restoreAuthSession).mockResolvedValue(session);
  vi.mocked(authApi.login).mockResolvedValue({ ...session, user: { ...user, id: "other", username: "other" } });
  vi.mocked(authApi.logout).mockResolvedValue(undefined);
});
afterEach(cleanup);

it("clears private cached data when logging out and switching accounts", async () => {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);
  await screen.findByText("owner");
  client.setQueryData(["my-cars"], ["private car"]);
  client.setQueryData(["messages", "private"], ["private message"]);
  fireEvent.click(screen.getByText("Logout"));
  await screen.findByText("guest");
  expect(client.getQueryData(["my-cars"])).toBeUndefined();
  expect(client.getQueryData(["messages", "private"])).toBeUndefined();
  fireEvent.click(screen.getByText("Login"));
  await screen.findByText("other");
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});

it("does not restore an old user after a login completes", async () => {
  let resolve!: (value: typeof session) => void;
  vi.mocked(restoreAuthSession).mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);
  fireEvent.click(screen.getByText("Login"));
  await screen.findByText("other");
  resolve(session);
  await waitFor(() => expect(screen.queryByText("owner")).toBeNull());
  expect(screen.getByText("other")).toBeTruthy();
});
