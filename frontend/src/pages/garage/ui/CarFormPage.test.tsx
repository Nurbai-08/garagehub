import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCar, getMyCars, updateCar, type Car } from "@/entities/car";
import { uploadImage } from "@/features/upload-image";
import { CarFormPage } from "./CarFormPage";

vi.mock("@/features/upload-image", () => ({ uploadImage: vi.fn() }));
vi.mock("@/entities/car", () => ({
  createCar: vi.fn(), getMyCars: vi.fn(), updateCar: vi.fn(),
}));

const car: Car = {
  id: "car-1", brand: "BMW", model: "M3", year: 2022, mileage: 12000,
  power_hp: null, drivetrain: null, generation: null, trim: null,
  cover_image_url: "/uploads/old.jpg", image_urls: ["/uploads/old.jpg"],
  description: null, is_public: true, owner_username: "owner",
  rating_avg: 0, rating_count: 0, favorites_count: 0,
};

function openForm(mode: "create" | "edit" = "create") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[mode === "edit" ? "/garage/car-1/edit" : "/garage/new"]}>
        <Routes>
          <Route path="/garage/new" element={<CarFormPage mode="create" />} />
          <Route path="/garage/:carId/edit" element={<CarFormPage mode="edit" />} />
          <Route path="/cars/:carId" element={<p>Сохранённый автомобиль</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

function selectPhoto(name: string) {
  fireEvent.change(screen.getByLabelText(/Фотографии \*/), {
    target: { files: [new File(["photo"], name, { type: "image/jpeg" })] },
  });
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Марка *"), { target: { value: "BMW" } });
  fireEvent.change(screen.getByLabelText("Модель *"), { target: { value: "M3" } });
}

beforeEach(() => {
  vi.resetAllMocks();
  let index = 0;
  URL.createObjectURL = vi.fn(() => `blob:photo-${++index}`);
  URL.revokeObjectURL = vi.fn();
  vi.mocked(getMyCars).mockResolvedValue([car]);
  vi.mocked(uploadImage).mockResolvedValue("/uploads/new.jpg");
  vi.mocked(createCar).mockImplementation(async (input) => ({ ...car, ...input }));
  vi.mocked(updateCar).mockImplementation(async (_id, input) => ({ ...car, ...input }));
});

afterEach(cleanup);

describe("car photos", () => {
  it("creates a car with one photo and leaves empty power unknown", async () => {
    const client = openForm();
    fillRequiredFields();
    selectPhoto("first.jpg");
    expect(screen.getByAltText("Фото 1").getAttribute("src")).toBe("blob:photo-1");
    fireEvent.click(screen.getByRole("button", { name: /Добавить в подборку/ }));
    await screen.findByText("Сохранённый автомобиль");
    expect(createCar).toHaveBeenCalledWith(expect.objectContaining({
      cover_image_url: "/uploads/new.jpg", image_urls: ["/uploads/new.jpg"], power_hp: null,
    }));
    expect(client.getQueryData(["car", car.id])).toEqual(expect.objectContaining({ cover_image_url: "/uploads/new.jpg" }));
  });

  it("appends photos individually, changes the cover and removes a photo", () => {
    openForm();
    selectPhoto("first.jpg");
    selectPhoto("second.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Сделать фото 2 обложкой" }));
    expect(screen.getByAltText("Первое фото машины").getAttribute("src")).toBe("blob:photo-2");
    fireEvent.click(screen.getByRole("button", { name: "Удалить фото 2" }));
    expect(screen.queryByAltText("Фото 2")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo-1");
    selectPhoto("first.jpg");
    expect(screen.getByAltText("Фото 2")).toBeTruthy();
  });

  it("keeps existing photos and draft fields when cached car data changes", async () => {
    const client = openForm("edit");
    await screen.findByDisplayValue("BMW");
    fireEvent.change(screen.getByLabelText("Модель *"), { target: { value: "M3 Competition" } });
    selectPhoto("second.jpg");
    vi.mocked(getMyCars).mockResolvedValue([{ ...car, model: "Server update" }]);
    await client.invalidateQueries({ queryKey: ["my-cars"] });
    expect((screen.getByLabelText("Модель *") as HTMLInputElement).value).toBe("M3 Competition");
    fireEvent.click(screen.getByRole("button", { name: /Сохранить изменения/ }));
    await screen.findByText("Сохранённый автомобиль");
    expect(updateCar).toHaveBeenCalledWith(car.id, expect.objectContaining({
      model: "M3 Competition", mileage: 12000,
      image_urls: ["/uploads/old.jpg", "/uploads/new.jpg"],
    }));
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it("removes a saved cover and persists the remaining photo without reuploading", async () => {
    vi.mocked(getMyCars).mockResolvedValue([{
      ...car, image_urls: ["/uploads/old.jpg", "/uploads/side.jpg"],
    }]);
    const client = openForm("edit");
    await screen.findByDisplayValue("BMW");
    fireEvent.click(screen.getByRole("button", { name: "Удалить фото 1" }));
    expect(screen.getByAltText("Первое фото машины").getAttribute("src")).toBe("/uploads/side.jpg");
    fireEvent.click(screen.getByRole("button", { name: /Сохранить изменения/ }));
    await screen.findByText("Сохранённый автомобиль");
    expect(updateCar).toHaveBeenCalledWith(car.id, expect.objectContaining({
      cover_image_url: "/uploads/side.jpg", image_urls: ["/uploads/side.jpg"],
    }));
    expect(client.getQueryData(["car", car.id])).toEqual(expect.objectContaining({
      cover_image_url: "/uploads/side.jpg", image_urls: ["/uploads/side.jpg"],
    }));
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("retries a failed upload without resending successful photos", async () => {
    vi.mocked(uploadImage)
      .mockResolvedValueOnce("/uploads/first.jpg")
      .mockRejectedValueOnce(new AxiosError("timeout", "ECONNABORTED"))
      .mockResolvedValueOnce("/uploads/second.jpg");
    openForm();
    fillRequiredFields();
    selectPhoto("first.jpg");
    selectPhoto("second.jpg");
    fireEvent.click(screen.getByRole("button", { name: /Добавить в подборку/ }));
    await screen.findByText(/second.jpg: Сервер не ответил вовремя/);
    expect(createCar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Добавить в подборку/ }));
    await screen.findByText("Сохранённый автомобиль");
    expect(uploadImage).toHaveBeenCalledTimes(3);
    expect(createCar).toHaveBeenCalledWith(expect.objectContaining({ image_urls: ["/uploads/first.jpg", "/uploads/second.jpg"] }));
  });

  it("requires a photo and explains invalid files without dropping the gallery", async () => {
    openForm();
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: /Добавить в подборку/ }));
    await screen.findByText("Добавьте хотя бы одну фотографию машины");
    expect(createCar).not.toHaveBeenCalled();
    selectPhoto("first.jpg");
    fireEvent.change(screen.getByLabelText(/Фотографии \*/), {
      target: { files: [new File(["photo"], "phone.heic", { type: "image/heic" })] },
    });
    expect(screen.getByText(/phone.heic: поддерживаются/)).toBeTruthy();
    expect(screen.getByAltText("Фото 1")).toBeTruthy();
    await waitFor(() => expect(uploadImage).not.toHaveBeenCalled());
  });
});
