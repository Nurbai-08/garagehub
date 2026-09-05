import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/features/auth";
import { AuthPage } from "./AuthPage";

vi.mock("@/features/auth/api/authApi", () => ({
  restoreAuthSession: vi.fn().mockRejectedValue(new Error("No session")),
  authApi: {},
}));

describe("AuthPage", () => {
  it("shows client validation before sending an empty login form", async () => {
    localStorage.clear();
    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AuthProvider>
          <AuthPage mode="login" />
        </AuthProvider>
      </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Войти" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Войти в Гараж" }));
    await waitFor(() =>
      expect(screen.getByText("Введите корректный email")).toBeTruthy(),
    );
    expect(screen.getByText("Минимум 8 символов")).toBeTruthy();
  });
});
