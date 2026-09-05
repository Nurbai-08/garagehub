import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Calendar,
  Edit3,
  Gauge,
  Images,
  Lock,
  MessageCircle,
  Plus,
  Shield,
  Star,
  Trash2,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/features/auth";
import { uploadImage } from "@/features/upload-image";
import { apiMessage } from "@/shared/api";
import { startConversation } from "@/entities/conversation";
import {
  createCar,
  deleteCar,
  favoriteCar,
  getCar,
  getMyCars,
  rateCar,
  unfavoriteCar,
  updateCar,
  type CarInput,
} from "@/entities/car";

export function GaragePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: cars = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["my-cars"], queryFn: getMyCars });
  const [deleting, setDeleting] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: deleteCar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-cars"] });
      void queryClient.invalidateQueries({ queryKey: ["cars"] });
      void queryClient.invalidateQueries({ queryKey: ["car-brands"] });
      setDeleting(null);
    },
  });
  return (
    <main className="inner-page garage-page">
      <div className="garage-title">
        <div>
          <p className="kicker">@{user?.username}</p>
          <h1>Моя подборка</h1>
          <p>
            {cars.length} {cars.length === 1 ? "автомобиль" : "автомобиля"} · в
            добавлено
          </p>
        </div>
        <Link to="/garage/new" className="primary">
          <Plus size={18} /> Добавить автомобиль
        </Link>
      </div>
      {isLoading ? (
        <div className="catalog">
          {[1, 2, 3].map((n) => (
            <div className="skeleton" key={n} />
          ))}
        </div>
      ) : isError ? (
        <div className="error">
          Не удалось открыть подборку.{" "}
          <button onClick={() => refetch()}>Повторить</button>
        </div>
      ) : cars.length === 0 ? (
        <div className="empty garage-empty">
          <Images />
          <h2>Пока здесь пусто</h2>
          <p>
            Добавь любимую машину, до 5 фотографий и расскажи, чем она
            нравится.
          </p>
          <Link to="/garage/new" className="primary">
            Добавить автомобиль <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <div className="garage-grid">
          {cars.map((car) => (
            <article className="garage-car" key={car.id}>
              <Link to={`/cars/${car.id}`}>
                <img
                  src={car.cover_image_url}
                  alt={`${car.brand} ${car.model}`}
                />
              </Link>
              <div className="garage-car-body">
                <p>
                  {car.brand} · {car.year}
                </p>
                <h2>{car.model}</h2>
                <div>
                  <span>
                    <Images size={15} />
                    {car.image_urls.length || 1} фото
                  </span>
                  <span className={car.is_public ? "public" : ""}>
                    {car.is_public ? (
                      "В профиле"
                    ) : (
                      <>
                        <Lock size={13} /> Скрыта
                      </>
                    )}
                  </span>
                </div>
                <div className="garage-actions">
                  <Link to={`/garage/${car.id}/edit`}>
                    <Edit3 size={15} /> Изменить
                  </Link>
                  <button onClick={() => setDeleting(car.id)}>
                    <Trash2 size={15} /> Удалить
                  </button>
                </div>
              </div>
              {deleting === car.id && (
                <div className="confirm">
                  <p>
                    Удалить {car.brand} {car.model}? Это действие нельзя
                    отменить.
                  </p>
                  {remove.isError && <small>{apiMessage(remove.error)}</small>}
                  <div>
                    <button onClick={() => setDeleting(null)}>Отмена</button>
                    <button
                      className="danger"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(car.id)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

const MAX_IMAGE_SIZE_MB = 4;
const carSchema = z.object({
  brand: z.string().min(1, "Укажите марку"),
  model: z.string().min(1, "Укажите модель"),
  year: z.coerce
    .number()
    .min(1886)
    .max(new Date().getFullYear() + 1),
  power_hp: z
    .union([z.coerce.number().min(0).max(5000), z.literal("")])
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: ownCars = [], isLoading } = useQuery({
    queryKey: ["my-cars"],
    queryFn: getMyCars,
    enabled: mode === "edit",
  });
  const current = ownCars.find((car) => car.id === carId);
  const [serverError, setServerError] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CarFormInput, unknown, CarValues>({
    resolver: zodResolver(carSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      is_public: true,
    },
  });
  useEffect(() => {
    if (current)
      reset({
        brand: current.brand,
        model: current.model,
        year: current.year,
        power_hp: current.power_hp ?? "",
        drivetrain: current.drivetrain ?? "",
        generation: current.generation ?? "",
        trim: current.trim ?? "",
        description: current.description ?? "",
        is_public: current.is_public,
      });
  }, [current, reset]);
  useEffect(
    () => () =>
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview)),
    [photoPreviews],
  );
  const existingImages = current?.image_urls.length
    ? current.image_urls
    : current
      ? [current.cover_image_url]
      : [];
  const images = photoPreviews.length ? photoPreviews : existingImages;
  const choosePhotos = (files?: FileList | null) => {
    setServerError("");
    if (!files) return;
    const selected = Array.from(files);
    if (selected.length < 3 || selected.length > 5) {
      setServerError("Выберите от 3 до 5 фотографий");
      return;
    }
    if (
      selected.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setServerError("Поддерживаются только JPG, PNG и WebP");
      return;
    }
    if (selected.some((file) => file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024)) {
      setServerError(
        `Размер каждого изображения не должен превышать ${MAX_IMAGE_SIZE_MB} MB`,
      );
      return;
    }
    photoPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setPhotoFiles(selected);
    setPhotoPreviews(selected.map((file) => URL.createObjectURL(file)));
  };
  const submit = async (values: CarValues) => {
    setServerError("");
    if (mode === "create" && photoFiles.length < 3) {
      setServerError("Добавьте от 3 до 5 фотографий машины");
      return;
    }
    let imageUrls = existingImages;
    try {
      if (photoFiles.length)
        imageUrls = await Promise.all(photoFiles.map(uploadImage));
    } catch (error) {
      setServerError(apiMessage(error));
      return;
    }
    if (!imageUrls[0]) {
      setServerError("Добавьте от 3 до 5 фотографий машины");
      return;
    }
    const input: CarInput = {
      ...values,
      mileage: 0,
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
        mode === "edit" && carId
          ? await updateCar(carId, input)
          : await createCar(input);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-cars"] }),
        queryClient.invalidateQueries({ queryKey: ["cars"] }),
        queryClient.invalidateQueries({ queryKey: ["car-brands"] }),
      ]);
      navigate(`/cars/${car.id}`);
    } catch (error) {
      setServerError(apiMessage(error));
    }
  };
  if (mode === "edit" && isLoading)
    return (
      <main className="inner-page">
        <div className="page-loader">Загружаем машину…</div>
      </main>
    );
  if (mode === "edit" && !current)
    return (
      <main className="inner-page">
        <div className="empty">
          <h2>Автомобиль не найден</h2>
          <Link to="/garage">Вернуться в подборку</Link>
        </div>
      </main>
    );
  return (
    <main className="car-form-page">
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
            <Field label="От 3 до 5 фотографий *">
              <div className="file-drop photo-drop">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => choosePhotos(event.target.files)}
                />
                <span>
                  {photoFiles.length
                    ? `Выбрано ${photoFiles.length} фото`
                    : `Выбрать 3–5 фото · JPG, PNG или WebP до ${MAX_IMAGE_SIZE_MB} MB`}
                </span>
              </div>
              {images.length > 0 && (
                <div className="photo-picker-previews">
                  {images.map((src, index) => (
                    <figure key={`${src}-${index}`}>
                      <img src={src} alt={`Фото ${index + 1}`} />
                      <figcaption>
                        {index === 0 ? "Главное" : `${index + 1}`}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Почему она тебе нравится?">
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
                <small>Машина появится в общей ленте и твоём профиле</small>
              </div>
            </label>
          </div>
        </div>
        {serverError && <div className="form-error">{serverError}</div>}
        <div className="form-submit">
          <Link to="/garage">Отмена</Link>
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting
              ? "Сохраняем…"
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

export function CarDetailPage() {
  const { carId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [favorite, setFavorite] = useState(false);
  const [score, setScore] = useState(0);
  const [socialError, setSocialError] = useState("");
  const [messageStarting, setMessageStarting] = useState(false);
  const [activeImage, setActiveImage] = useState("");
  const {
    data: car,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["car", carId],
    queryFn: () => getCar(carId),
    enabled: Boolean(carId),
  });
  if (isLoading)
    return (
      <main className="inner-page">
        <div className="page-loader">Открываем машину…</div>
      </main>
    );
  if (isError || !car)
    return (
      <main className="inner-page">
        <div className="empty">
          <h2>Автомобиль не найден</h2>
          <p>Возможно, он приватный или был удалён.</p>
          <Link to="/explore">В каталог</Link>
        </div>
      </main>
    );
  const mine = user?.username === car.owner_username;
  const images = car.image_urls.length ? car.image_urls : [car.cover_image_url];
  const currentImage = activeImage || images[0];
  const toggleFavorite = async () => {
    if (!user) return;
    setFavorite(!favorite);
    setSocialError("");
    try {
      if (favorite) await unfavoriteCar(car.id);
      else await favoriteCar(car.id);
      await queryClient.invalidateQueries({ queryKey: ["car", carId] });
    } catch (error) {
      setFavorite(favorite);
      setSocialError(apiMessage(error));
    }
  };
  const submitRating = async (value: number) => {
    if (!user || mine) return;
    setScore(value);
    setSocialError("");
    try {
      await rateCar(car.id, value);
      await queryClient.invalidateQueries({ queryKey: ["car", carId] });
    } catch (error) {
      setSocialError(apiMessage(error));
    }
  };
  const openConversation = async () => {
    if (!user || mine || messageStarting) return;
    setMessageStarting(true);
    setSocialError("");
    try {
      const conversation = await startConversation(car.id);
      navigate(`/messages/${conversation.id}`);
    } catch (error) {
      setSocialError(apiMessage(error));
      setMessageStarting(false);
    }
  };
  return (
    <main className="car-detail">
      <section className="car-detail-hero">
        <img src={currentImage} alt={`${car.brand} ${car.model}`} />
        <div className="car-detail-shade" />
        <div className="car-detail-title">
          <p>
            {car.brand} · {car.year}
          </p>
          <h1>{car.model}</h1>
          <span>
            {car.trim || car.generation || "Машина из нашей компании"}
          </span>
        </div>
        {mine && (
          <Link to={`/garage/${car.id}/edit`} className="edit-float">
            <Edit3 /> Редактировать
          </Link>
        )}
      </section>
      {images.length > 1 && (
        <div className="car-gallery-thumbs" aria-label="Фотографии машины">
          {images.map((src, index) => (
            <button
              className={currentImage === src ? "active" : ""}
              onClick={() => setActiveImage(src)}
              key={`${src}-${index}`}
              aria-label={`Открыть фото ${index + 1}`}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
      <section className="car-detail-body">
        <div className="owner-line">
          <div className="avatar">{car.owner_username[0].toUpperCase()}</div>
          <div>
            <small>Добавил</small>
            <b>@{car.owner_username}</b>
          </div>
          {user && !mine && (
            <button
              className="message-owner"
              onClick={() => void openConversation()}
              disabled={messageStarting}
            >
              <MessageCircle />{" "}
              {messageStarting ? "Открываем…" : "Написать автору"}
            </button>
          )}
          {!user && (
            <Link className="message-owner" to="/login">
              <MessageCircle /> Войти, чтобы написать
            </Link>
          )}
          {user && !mine && (
            <button
              className={favorite ? "favorite-active" : ""}
              onClick={() => void toggleFavorite()}
            >
              <Bookmark fill={favorite ? "currentColor" : "none"} />{" "}
              {favorite ? "Сохранено" : "В избранное"}
            </button>
          )}
          <button
            onClick={() => void navigator.clipboard.writeText(location.href)}
          >
            Поделиться
          </button>
        </div>
        <div className="spec-board">
          <div>
            <Gauge />
            <small>Мощность</small>
            <b>
              {car.power_hp ?? "—"} <em>л.с.</em>
            </b>
          </div>
          <div>
            <Images />
            <small>Фотографии</small>
            <b>{images.length}</b>
          </div>
          <div>
            <Shield />
            <small>Привод</small>
            <b>{car.drivetrain ?? "—"}</b>
          </div>
          <div>
            <Calendar />
            <small>Год</small>
            <b>{car.year}</b>
          </div>
        </div>
        <div className="rating-panel">
          <div>
            <p className="kicker">Рейтинг сообщества</p>
            <b>{car.rating_avg.toFixed(1)}</b>
            <span>{car.rating_count} оценок</span>
          </div>
          {user && !mine ? (
            <div>
              <small>Ваша оценка</small>
              <div>
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (value) => (
                    <button
                      className={value <= score ? "selected" : ""}
                      onClick={() => void submitRating(value)}
                      key={value}
                    >
                      {value}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : (
            <p>
              {mine ? (
                "Нельзя оценить машину из своей подборки."
              ) : (
                <>
                  <Link to="/login">Войдите</Link>, чтобы поставить оценку.
                </>
              )}
            </p>
          )}
          <Star fill="currentColor" />
        </div>
        {socialError && <div className="form-error">{socialError}</div>}
        <article className="car-story">
          <p className="kicker">От автора подборки</p>
          <h2>
            Пара слов
            <br />о машине
          </h2>
          <p>
            {car.description ||
              "Автор пока не рассказал, почему ему нравится эта машина."}
          </p>
        </article>
      </section>
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
