import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getCar, unfavoriteCar, favoriteCar, rateCar, type Car } from "@/entities/car";
import { CarDetailPage } from "./GaragePages";

vi.mock("@/features/auth", () => ({ useAuth: () => ({ user: { username: "other" } }) }));
vi.mock("@/entities/car", () => ({ getCar: vi.fn(), unfavoriteCar: vi.fn(), favoriteCar: vi.fn(), rateCar: vi.fn() }));

const car: Car = {
  id: "car", brand: "BMW", model: "M3", year: 2022, mileage: 100,
  power_hp: null, drivetrain: null, generation: null, trim: null,
  cover_image_url: "/uploads/car.jpg", image_urls: ["/uploads/car.jpg"],
  description: null, is_public: true, owner_username: "owner",
  rating_avg: 8, rating_count: 1, favorites_count: 1, is_favorite: true, my_rating: 8,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCar).mockResolvedValue(car);
});
afterEach(cleanup);

function open() {
  render(<QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={["/cars/car"]}><Routes>
      <Route path="/cars/:carId" element={<CarDetailPage />} />
    </Routes></MemoryRouter>
  </QueryClientProvider>);
}

it("restores saved state and removes the favorite", async () => {
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Сохранено" }));
  await waitFor(() => expect(unfavoriteCar).toHaveBeenCalledWith("car"));
  expect(favoriteCar).not.toHaveBeenCalled();
});

it("keeps the saved rating when a new rating fails", async () => {
  vi.mocked(rateCar).mockRejectedValue(new Error("Network failed"));
  open();
  fireEvent.click(await screen.findByRole("button", { name: "10" }));
  await screen.findByText("Произошла непредвиденная ошибка");
  expect(screen.getByRole("button", { name: "8" }).className).toBe("selected");
  expect(screen.getByRole("button", { name: "10" }).className).toBe("");
});
