import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CarFront,
  MapPin,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getUserCars } from "@/entities/car";
import { getProfile, updateProfile } from "@/entities/user";
import { useAuth } from "@/features/auth";
import { apiMessage } from "@/shared/api";

export function PublicProfilePage() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => getProfile(username),
  });
  const { data: cars = [] } = useQuery({
    queryKey: ["user-cars", username],
    queryFn: () => getUserCars(username),
  });
  if (isLoading)
    return (
      <main className="inner-page">
        <div className="page-loader">Открываем профиль…</div>
      </main>
    );
  if (isError || !profile)
    return (
      <main className="inner-page">
        <div className="empty">
          <h2>Пользователь не найден</h2>
        </div>
      </main>
    );
  return (
    <main className="profile-page">
      <section className="profile-head">
        <div className="profile-avatar">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            profile.username[0].toUpperCase()
          )}
        </div>
        <div>
          <p className="kicker">Профиль участника</p>
          <h1>{profile.display_name || `@${profile.username}`}</h1>
          <span>@{profile.username}</span>
          {profile.bio && <p>{profile.bio}</p>}
          <div className="profile-meta">
            {profile.city && (
              <span>
                <MapPin /> {profile.city}
              </span>
            )}
            <span>
              <Calendar /> В Гараже с{" "}
              {new Date(profile.created_at).getFullYear()}
            </span>
          </div>
        </div>
        {user?.username === profile.username && (
          <Link to="/settings/profile" className="profile-settings">
            <Settings /> Настройки
          </Link>
        )}
      </section>
      <section className="profile-stats">
        <div>
          <b>{profile.cars_count}</b>
          <span>Машин</span>
        </div>
        <div>
          <b>{profile.posts_count}</b>
          <span>Записей</span>
        </div>
      </section>
      <section className="profile-cars">
        <div>
          <p className="kicker">Машины пользователя</p>
          <h2>В гараже</h2>
        </div>
        {cars.length ? (
          <div className="profile-car-grid">
            {cars.map((car) => (
              <Link to={`/cars/${car.id}`} key={car.id}>
                <img
                  src={car.cover_image_url}
                  alt={`${car.brand} ${car.model}`}
                />
                <div>
                  <p>
                    {car.brand} · {car.year}
                  </p>
                  <h3>{car.model}</h3>
                  <span>
                    {car.power_hp ? `${car.power_hp} л.с.` : "Смотреть фото"}{" "}
                    <ArrowRight />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <CarFront />
            <h2>Машин пока нет</h2>
          </div>
        )}
      </section>
    </main>
  );
}

export function ProfileSettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.username],
    queryFn: () => getProfile(user!.username),
    enabled: Boolean(user),
  });
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setCity(profile.city ?? "");
      setBio(profile.bio ?? "");
    }
  }, [profile]);
  const save = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      setMessage("Профиль сохранён");
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.username],
      });
      window.setTimeout(() => navigate(`/users/${user?.username}`), 600);
    },
    onError: (error) => setMessage(apiMessage(error)),
  });
  return (
    <main className="settings-page">
      <Link to={`/users/${user?.username}`} className="back">
        <ArrowLeft /> Профиль
      </Link>
      <div className="settings-layout">
        <div>
          <p className="kicker">Личные настройки</p>
          <h1>Ваш профиль</h1>
          <p>
            Расскажите немного о себе — это увидят другие участники сообщества.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({
              display_name: displayName || null,
              city: city || null,
              bio: bio || null,
            });
          }}
        >
          <label className="field">
            <span>Отображаемое имя</span>
            <input
              value={displayName}
              maxLength={100}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Город</span>
            <input
              value={city}
              maxLength={100}
              onChange={(event) => setCity(event.target.value)}
            />
          </label>
          <label className="field">
            <span>О себе</span>
            <textarea
              rows={7}
              value={bio}
              maxLength={1000}
              onChange={(event) => setBio(event.target.value)}
            />
            <small>{bio.length} / 1000</small>
          </label>
          {message && (
            <div
              className={
                message === "Профиль сохранён"
                  ? "success-message"
                  : "form-error"
              }
            >
              {message}
            </div>
          )}
          <button className="primary" disabled={save.isPending}>
            {save.isPending ? "Сохраняем…" : "Сохранить профиль"}
          </button>
        </form>
      </div>
    </main>
  );
}
