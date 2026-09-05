import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getCars } from "@/entities/car";
import { ExplorePage } from "./ExplorePage";

vi.mock("@/entities/car", () => ({
  getCars: vi.fn(), getCarBrands: vi.fn().mockResolvedValue(["BMW", "Audi"]),
  CarCard: () => <article>Car</article>,
}));

function HistoryButtons() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Browser back</button>;
}

function open() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/explore?search=BMW", "/explore?search=Audi&page=2"]}>
      <ExplorePage /><HistoryButtons />
    </MemoryRouter>
  </QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(getCars).mockReset().mockResolvedValue({ items: [], page: 2, page_size: 12, total: 30, total_pages: 3 });
});
afterEach(cleanup);

it("requests other pages and resets pagination when the search changes", async () => {
  open();
  fireEvent.click(await screen.findByText("Далее"));
  await waitFor(() => expect(getCars).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, search: "Audi" })));
  fireEvent.change(screen.getByLabelText("Поиск автомобилей"), { target: { value: "BMW" } });
  await waitFor(() => expect(getCars).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: "BMW" })));
});

it("keeps search aligned with browser history without overwriting the URL", async () => {
  open();
  fireEvent.click(screen.getByText("Browser back"));
  await waitFor(() => expect((screen.getByLabelText("Поиск автомобилей") as HTMLInputElement).value).toBe("BMW"));
  await waitFor(() => expect(getCars).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: "BMW" })));
});
