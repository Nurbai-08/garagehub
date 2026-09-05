import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Images, Shield } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { createCar, getMyCars, updateCar, type Car, type CarInput } from "@/entities/car";
import { apiMessage } from "@/shared/api";
import { useCarPhotos } from "../model/useCarPhotos";
import { CarPhotoPicker } from "./CarPhotoPicker";

const carSchema = z.object({
  brand: z.string().trim().min(1, "Укажите марку").max(80),
  model: z.string().trim().min(1, "Укажите модель").max(80),
  year: z.coerce
    .number()
    .int("Укажите целый год")
    .min(1886)
    .max(new Date().getFullYear() + 1),
  power_hp: z
    .union([z.literal(""), z.coerce.number().int("Укажите целое число").min(0).max(5000)])
    .optional(),
  drivetrain: z.string().optional(),
  generation: z.string().optional(),
  trim: z.string().optional(),
  description: z.string().max(5000).optional(),
  is_public: z.boolean(),
});
type CarFormInput = z.input<typeof carSchema>;
type CarValues = z.output<typeof carSchema>;

export function CarFormPage({ mode }: { mode: "create" | "edit" }) {
  const { carId } = useParams();
  const { data: ownCars = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["my-cars"],
    queryFn: getMyCars,
    enabled: mode === "edit",
  });
  const current = ownCars.find((car) => car.id === carId);
  if (mode === "edit" && isLoading)
    return <main id="main-content" className="inner-page"><div className="page-loader">Загружаем машину…</div></main>;
  if (mode === "edit" && isError && !current)
    return <main id="main-content" className="inner-page"><div className="error">Не удалось загрузить машину. <button onClick={() => void refetch()}>Повторить</button></div></main>;
  if (mode === "edit" && !current)
    return <main id="main-content" className="inner-page"><div className="empty"><h2>Автомобиль не найден</h2><Link to="/garage">Вернуться в подборку</Link></div></main>;
  return <CarEditor key={current?.id ?? "new"} current={current} />;
}

function CarEditor({ current }: { current?: Car }) {
  const mode = current ? "edit" : "create";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState("");
  const [progress, setProgress] = useState("");
  const gallery = useCarPhotos(
    current ? (current.image_urls.length ? current.image_urls : [current.cover_image_url]) : [],
  );
  const images = gallery.photos.map((photo) => photo.preview);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CarFormInput, unknown, CarValues>({
    resolver: zodResolver(carSchema),
    defaultValues: {
      brand: current?.brand ?? "",
      model: current?.model ?? "",
      year: current?.year ?? new Date().getFullYear(),
      power_hp: current?.power_hp ?? "",
      drivetrain: current?.drivetrain ?? "",
      generation: current?.generation ?? "",
      trim: current?.trim ?? "",
      description: current?.description ?? "",
      is_public: current?.is_public ?? true,
    },
  });
  const submit = async (values: CarValues) => {
    setServerError("");
    const imageUrls = await gallery.upload(setProgress);
    if (!imageUrls) return;
    setProgress("Сохраняем автомобиль…");
    const input: CarInput = {
      ...values,
      mileage: current?.mileage ?? 0,
      cover_image_url: imageUrls[0],
      image_urls: imageUrls,
      power_hp: values.power_hp === "" ? null : values.power_hp,
      generation: values.generation || null,
      trim: values.trim || null,
      drivetrain: values.drivetrain || null,
      description: values.description || null,
    };
    try {
      const car =
        current
          ? await updateCar(current.id, input)
          : await createCar(input);
      queryClient.setQueryData(["car", car.id], car);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-cars"] }),
        queryClient.invalidateQueries({ queryKey: ["cars"] }),
        queryClient.invalidateQueries({ queryKey: ["car-brands"] }),
        queryClient.invalidateQueries({ queryKey: ["user-cars"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
        queryClient.invalidateQueries({ queryKey: ["posts"] }),
      ]);
      navigate(`/cars/${car.id}`);
    } catch (error) {
      setServerError(apiMessage(error));
    }
  };
  return (
    <main id="main-content" className="car-form-page">
      <div className="form-aside">
        <Link to="/garage" className="back">
          <ArrowLeft /> Моя подборка
        </Link>
        <div>
          <p className="kicker">
            {mode === "create" ? "Новая машина" : "Редактирование"}
          </p>
          <h1>
            {mode === "create"
              ? "Добавить автомобиль"
              : "Редактировать автомобиль"}
          </h1>
          <p>
            Необязательно владеть этой машиной. Добавь модель, которая нравится,
            несколько красивых кадров и пару слов для друзей.
          </p>
        </div>
        {images[0] ? (
          <img src={images[0]} alt="Первое фото машины" />
        ) : (
          <div className="image-placeholder">
            <Images />
            <span>Здесь появится первое фото</span>
          </div>
        )}
      </div>
      <form className="car-form" onSubmit={handleSubmit(submit)} noValidate>
        <fieldset className="car-form-fields" disabled={isSubmitting}>
          <div className="form-section">
            <span>01</span>
            <div>
              <p className="kicker">Основные данные</p>
              <h2>Что за автомобиль?</h2>
              <div className="form-grid">
                <Field label="Марка *" error={errors.brand?.message}>
                  <input placeholder="Porsche" {...register("brand")} />
                </Field>
                <Field label="Модель *" error={errors.model?.message}>
                  <input placeholder="911 Carrera" {...register("model")} />
                </Field>
                <Field label="Год *" error={errors.year?.message}>
                  <input type="number" {...register("year")} />
                </Field>
                <Field label="Поколение">
                  <input placeholder="992" {...register("generation")} />
                </Field>
                <Field label="Комплектация">
                  <input placeholder="4S" {...register("trim")} />
                </Field>
              </div>
            </div>
          </div>
          <div className="form-section">
            <span>02</span>
            <div>
              <p className="kicker">Если хочется</p>
              <h2>Пара деталей</h2>
              <div className="form-grid">
                <Field label="Мощность, л.с." error={errors.power_hp?.message}>
                  <input
                    type="number"
                    placeholder="450"
                    {...register("power_hp")}
                  />
                </Field>
                <Field label="Привод">
                  <select {...register("drivetrain")}>
                    <option value="">Не выбран</option>
                    <option value="FWD">Передний</option>
                    <option value="RWD">Задний</option>
                    <option value="AWD">Полный</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
          <div className="form-section">
            <span>03</span>
            <div>
              <p className="kicker">Фотографии и подпись</p>
              <h2>Покажи машину с разных сторон</h2>
              <CarPhotoPicker gallery={gallery} disabled={isSubmitting} />
              <Field label="Почему она тебе нравится?" error={errors.description?.message}>
                <textarea
                  rows={6}
                  placeholder="Дизайн, звук, история модели или просто давняя мечта…"
                  {...register("description")}
                />
              </Field>
              <label className="visibility">
                <input type="checkbox" {...register("is_public")} />
                <span>
                  <Shield />
                </span>
                <div>
                  <b>Показывать друзьям</b>
                  <small>Машина появится в каталоге и твоём профиле</small>
                </div>
              </label>
            </div>
          </div>
          {serverError && <div className="form-error" role="alert">{serverError}</div>}
        </fieldset>
        <div className="form-submit">
          <Link to="/garage">Отмена</Link>
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting
              ? progress || "Сохраняем…"
              : mode === "create"
                ? "Добавить в подборку"
                : "Сохранить изменения"}{" "}
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
