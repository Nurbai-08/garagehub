import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/features/auth";
import { AuthPage } from "./AuthPage";

describe("AuthPage", () => {
  it("shows client validation before sending an empty login form", async () => {
    localStorage.clear();
    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthPage mode="login" />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Войти" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Войти в Гараж" }));
    await waitFor(() =>
      expect(screen.getByText("Введите корректный email")).toBeTruthy(),
    );
    expect(screen.getByText("Минимум 8 символов")).toBeTruthy();
  });
});
