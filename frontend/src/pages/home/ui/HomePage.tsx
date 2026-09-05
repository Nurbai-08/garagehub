import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Heart,
  Images,
  MessageCircle,
  NotebookPen,
} from "lucide-react";
import { Link } from "react-router-dom";
import { CarCard, getCars } from "@/entities/car";
import { getPosts } from "@/entities/post";

function Hero() {
  return (
    <section className="home-social-hero">
      <motion.div
        className="home-social-copy"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="kicker">любимые машины в одном месте</p>
        <h1>Собери машины, которые любишь.</h1>
        <p className="hero-lead">
          Неважно, есть у тебя эта машина или пока только мечтаешь о ней.
          Собирай любимые модели, добавляй красивые кадры и делись находками с
          друзьями.
        </p>
        <div className="hero-buttons">
          <Link to="/garage/new" className="primary">
            Добавить машину <ArrowRight size={18} />
          </Link>
          <Link to="/feed" className="text-link">
            Посмотреть ленту
          </Link>
        </div>
        <span className="hero-hand-note">до 5 фото на каждую машину</span>
      </motion.div>
      <motion.div
        className="home-social-board"
        initial={{ opacity: 0, rotate: 1.5, x: 20 }}
        animate={{ opacity: 1, rotate: -1, x: 0 }}
        transition={{ delay: 0.14, duration: 0.55 }}
        aria-label="Что можно делать в Гараже"
      >
        <div className="board-title">
          <span>для нашей компании</span>
          <b>Нашёл. Добавил. Поделился.</b>
        </div>
        <div className="board-items">
          <span>
            <Camera /> любимые фотографии
          </span>
          <span>
            <MessageCircle /> живые обсуждения
          </span>
          <span>
            <Heart /> машины, о которых мечтаем
          </span>
        </div>
      </motion.div>
    </section>
  );
}

function FeaturedCars() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["cars"],
    queryFn: () => getCars(),
  });
  const cars = data?.items ?? [];

  return (
    <section className="section social-cars" id="featured">
      <div className="social-section-head">
        <div>
          <p className="kicker">выбор нашей компании</p>
          <h2>Что нравится друзьям</h2>
        </div>
        <Link to="/explore" className="view-all">
          Смотреть все <ArrowRight size={17} />
        </Link>
      </div>
      {isLoading ? (
        <div
          className="card-grid home-car-skeletons"
          role="status"
          aria-label="Загружаем подборку машин"
        >
          <div className="home-cars-loading-note">
            <span aria-hidden="true">
              <Images />
            </span>
            <div>
              <b>Смотрим, что добавили друзья</b>
              <small>Обычно это занимает пару секунд.</small>
            </div>
          </div>
          {[1, 2, 3].map((n) => (
            <div
              className="skeleton home-car-skeleton"
              aria-hidden="true"
              key={n}
            />
          ))}
        </div>
      ) : isError ? (
        <div className="error home-error" role="alert">
          <div>
            <b>Машины пока не загрузились</b>
            <span>Можно попробовать ещё раз через пару секунд.</span>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Проверяем…" : "Попробовать снова"}
          </button>
        </div>
      ) : cars.length ? (
        <div className="card-grid">
          {cars.slice(0, 6).map((car) => (
            <CarCard car={car} key={car.id} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Images />
          <h3>Тут ждут первую машину</h3>
          <p>Добавь любимую модель и до 5 фотографий, которые тебе нравятся.</p>
          <Link to="/garage/new">Добавить машину</Link>
        </div>
      )}
    </section>
  );
}

function Stories() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["posts", "home"],
    queryFn: () => getPosts(),
  });
  const stories = data?.items.slice(0, 3) ?? [];
  const showsPlaceholder = !isLoading && (isError || stories.length === 0);

  return (
    <section className="section social-stories">
      <div className="social-section-head">
        <div>
          <p className="kicker">от ребят</p>
          <h2>Что нового</h2>
        </div>
        <Link to="/feed" className="view-all">
          Вся лента <ArrowRight size={17} />
        </Link>
      </div>
      <div className={`stories${showsPlaceholder ? " stories-empty" : ""}`}>
        {isLoading ? (
          [1, 2, 3].map((item) => (
            <div className="story story-loading" key={item} />
          ))
        ) : isError || stories.length === 0 ? (
          <div className="story-placeholder">
            <NotebookPen />
            <p className="kicker">общая лента</p>
            <h3>
              {isError
                ? "Лента скоро вернётся"
                : "Кто-то должен написать первым"}
            </h3>
            <p>
              {isError
                ? "Записи сейчас не загрузились. Попробуй открыть ленту чуть позже."
                : "Выбери машину из своей подборки и расскажи, почему она тебе нравится."}
            </p>
            <Link to={isError ? "/feed" : "/garage/new"}>
              {isError ? "Открыть ленту" : "Добавить машину"}{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          stories.map((story) => (
            <Link
              to={`/posts/${story.id}`}
              className="story"
              key={story.id}
              aria-label={`Открыть запись про ${story.car_name}`}
            >
              <img
                src={story.car_cover_url}
                alt={story.car_name}
                loading="lazy"
              />
              <div className="story-overlay">
                <span>{story.car_name}</span>
                <h3>
                  {story.content.length > 85
                    ? `${story.content.slice(0, 85)}…`
                    : story.content}
                </h3>
                <p>
                  @{story.author_username} ·{" "}
                  {new Date(story.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function FriendlyHowTo() {
  return (
    <section className="friendly-howto section">
      <div>
        <p className="kicker">без сложностей</p>
        <h2>Это наша общая подборка любимых машин.</h2>
      </div>
      <ol>
        <li>
          <b>01</b>
          <span>Найди от трёх до пяти хороших фотографий машины.</span>
        </li>
        <li>
          <b>02</b>
          <span>Укажи марку, модель и расскажи, чем она зацепила.</span>
        </li>
        <li>
          <b>03</b>
          <span>Отправь ссылку друзьям и обсуждайте машины вместе.</span>
        </li>
      </ol>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="social-cta">
      <div>
        <p className="kicker">твоя очередь</p>
        <h2>Какая машина в твоём топе?</h2>
        <p>Добавь её в свою подборку и покажи ребятам, чем она тебе нравится.</p>
        <Link to="/garage/new" className="primary">
          Добавить машину <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <main id="main-content">
      <Hero />
      <FeaturedCars />
      <Stories />
      <FriendlyHowTo />
      <CallToAction />
    </main>
  );
}
