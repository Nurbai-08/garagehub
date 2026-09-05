import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { apiMessage } from "@/shared/api";
import { startConversation } from "@/entities/conversation";
import {
  deleteCar,
  favoriteCar,
  getCar,
  getMyCars,
  rateCar,
  unfavoriteCar,
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
      void queryClient.invalidateQueries({ queryKey: ["car"] });
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["user-cars"] });
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      setDeleting(null);
    },
  });
  return (
    <main id="main-content" className="inner-page garage-page">
      <div className="garage-title">
        <div>
          <p className="kicker">@{user?.username}</p>
          <h1>Моя подборка</h1>
          <p>
            Всего автомобилей: {cars.length}
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
                  <Link to={`/garage/${car.id}/service`}>Обслуживание</Link>
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

export function CarDetailPage() {
  const { carId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [favoritePending, setFavoritePending] = useState(false);
  const [ratingPending, setRatingPending] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
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
      <main id="main-content" className="inner-page">
        <div className="page-loader">Открываем машину…</div>
      </main>
    );
  if (isError || !car)
    return (
      <main id="main-content" className="inner-page">
        <div className="empty">
          <h2>Автомобиль не найден</h2>
          <p>Возможно, он приватный или был удалён.</p>
          <Link to="/explore">В каталог</Link>
        </div>
      </main>
    );
  const mine = user?.username === car.owner_username;
  const images = car.image_urls.length ? car.image_urls : [car.cover_image_url];
  const currentImage = images.includes(activeImage) ? activeImage : images[0];
  const favorite = car.is_favorite ?? false;
  const score = car.my_rating ?? 0;
  const toggleFavorite = async () => {
    if (!user || favoritePending) return;
    setFavoritePending(true);
    setSocialError("");
    try {
      if (favorite) await unfavoriteCar(car.id);
      else await favoriteCar(car.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["car", carId] }),
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
        queryClient.invalidateQueries({ queryKey: ["cars"] }),
      ]);
    } catch (error) {
      setSocialError(apiMessage(error));
    } finally {
      setFavoritePending(false);
    }
  };
  const submitRating = async (value: number) => {
    if (!user || mine || ratingPending) return;
    setRatingPending(true);
    setSocialError("");
    try {
      await rateCar(car.id, value);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["car", carId] }),
        queryClient.invalidateQueries({ queryKey: ["cars"] }),
        queryClient.invalidateQueries({ queryKey: ["favorites"] }),
      ]);
    } catch (error) {
      setSocialError(apiMessage(error));
    } finally {
      setRatingPending(false);
    }
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setShareMessage("Ссылка скопирована");
    } catch {
      setShareMessage("Не удалось скопировать ссылку. Скопируйте адрес из браузера.");
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
    <main id="main-content" className="car-detail">
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
              disabled={favoritePending}
            >
              <Bookmark fill={favorite ? "currentColor" : "none"} />{" "}
              {favorite ? "Сохранено" : "В избранное"}
            </button>
          )}
          <button
            onClick={() => void share()}
          >
            Поделиться
          </button>
        </div>
        {shareMessage && <p role="status">{shareMessage}</p>}
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
                      disabled={ratingPending}
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
