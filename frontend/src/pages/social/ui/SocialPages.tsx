import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CarFront,
  Heart,
  MessageCircle,
  Plus,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { getFavorites, getMyCars, unfavoriteCar } from "@/entities/car";
import {
  createComment,
  createPost,
  deleteComment,
  getComments,
  getPost,
  getPosts,
  likePost,
  unlikePost,
  type Post,
} from "@/entities/post";
import { apiMessage } from "@/shared/api";

export function FeedPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["posts"],
    queryFn: getPosts,
  });
  const { data: ownCars = [] } = useQuery({
    queryKey: ["my-cars"],
    queryFn: getMyCars,
    enabled: Boolean(user),
  });
  const [composer, setComposer] = useState(false);
  const [content, setContent] = useState("");
  const [carId, setCarId] = useState("");
  const [error, setError] = useState("");
  const publish = useMutation({
    mutationFn: createPost,
    onSuccess: async () => {
      setContent("");
      setComposer(false);
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (value) => setError(apiMessage(value)),
  });
  const submit = () => {
    setError("");
    if (!carId || !content.trim()) {
      setError("Выберите машину и напишите пару слов");
      return;
    }
    publish.mutate({ car_id: carId, content: content.trim() });
  };

  return (
    <main className="feed-page">
      <section className="feed-head">
        <div>
          <p className="kicker">Лента друзей</p>
          <h1>
            Фото, новости
            <br />
            <i>и истории</i>
          </h1>
        </div>
        {user ? (
          <button className="primary" onClick={() => setComposer(!composer)}>
            <Plus size={18} /> Новая публикация
          </button>
        ) : (
          <Link to="/login" className="primary">
            Войти и написать
          </Link>
        )}
      </section>
      {composer && (
        <section className="composer">
          <div className="avatar">{user?.username[0].toUpperCase()}</div>
          <div>
            <select
              value={carId}
              onChange={(event) => setCarId(event.target.value)}
            >
              <option value="">Выберите машину</option>
              {ownCars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.brand} {car.model}
                </option>
              ))}
            </select>
            <textarea
              value={content}
              maxLength={2000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Что нового? Где были, что поменялось или просто какой кадр понравился?"
              rows={5}
            />
            <div>
              <small>{content.length} / 2000</small>
              <button
                className="primary"
                onClick={submit}
                disabled={publish.isPending}
              >
                {publish.isPending ? "Публикуем…" : "Опубликовать"}{" "}
                <Send size={16} />
              </button>
            </div>
            {error && <p className="field-error">{error}</p>}
          </div>
        </section>
      )}
      <section className="feed-list">
        {isLoading ? (
          [1, 2].map((value) => <div className="feed-skeleton" key={value} />)
        ) : isError ? (
          <div className="error">
            Не удалось загрузить истории.{" "}
            <button onClick={() => refetch()}>Повторить</button>
          </div>
        ) : data?.items.length ? (
          data.items.map((post) => <PostCard post={post} key={post.id} />)
        ) : (
          <div className="feed-empty">
            <CarFront />
            <div>
              <h2>Здесь появятся первые истории</h2>
              <p>
                Добавьте автомобиль, а затем расскажите о первой поездке или
                обновлении.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function PostCard({ post }: { post: Post }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [optimisticLikes, setOptimisticLikes] = useState(post.likes_count);
  const toggle = useMutation({
    mutationFn: () => (liked ? unlikePost(post.id) : likePost(post.id)),
    onMutate: () => {
      setLiked(!liked);
      setOptimisticLikes((value) => value + (liked ? -1 : 1));
    },
    onError: () => {
      setLiked(!liked);
      setOptimisticLikes((value) => value + (liked ? 1 : -1));
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
  return (
    <article className="feed-post">
      <div className="post-meta">
        <div className="avatar">{post.author_username[0].toUpperCase()}</div>
        <div>
          <b>@{post.author_username}</b>
          <span>
            {new Date(post.created_at).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <Link to={`/cars/${post.car_id}`}>
          {post.car_name} <ArrowRight size={14} />
        </Link>
      </div>
      <Link
        to={`/posts/${post.id}`}
        className="post-image"
        aria-label={`Открыть запись про ${post.car_name}`}
      >
        <img src={post.car_cover_url} alt={post.car_name} />
      </Link>
      <div className="post-copy">
        <p>{post.content}</p>
        <div>
          <button
            className={liked ? "liked" : ""}
            onClick={() => (user ? toggle.mutate() : undefined)}
          >
            <Heart fill={liked ? "currentColor" : "none"} /> {optimisticLikes}
          </button>
          <Link to={`/posts/${post.id}`}>
            <MessageCircle /> {post.comments_count}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function PostDetailPage() {
  const { postId = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: post, isLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => getPost(postId),
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => getComments(postId),
  });
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const add = useMutation({
    mutationFn: () => createComment(postId, content.trim()),
    onSuccess: async () => {
      setContent("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["comments", postId] }),
        queryClient.invalidateQueries({ queryKey: ["post", postId] }),
      ]);
    },
    onError: (value) => setError(apiMessage(value)),
  });
  const remove = useMutation({
    mutationFn: deleteComment,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] }),
  });
  if (isLoading)
    return (
      <main className="inner-page">
        <div className="page-loader">Загружаем историю…</div>
      </main>
    );
  if (!post)
    return (
      <main className="inner-page">
        <div className="empty">
          <h2>Публикация не найдена</h2>
        </div>
      </main>
    );
  return (
    <main className="post-detail">
      <Link to="/feed" className="back">
        <ArrowLeft /> Все истории
      </Link>
      <article>
        <div className="post-detail-head">
          <p className="kicker">{post.car_name}</p>
          <h1>{post.content}</h1>
          <div>
            <span className="avatar">
              {post.author_username[0].toUpperCase()}
            </span>
            <b>@{post.author_username}</b>
            <time>{new Date(post.created_at).toLocaleDateString("ru-RU")}</time>
          </div>
        </div>
        <img src={post.car_cover_url} alt={post.car_name} />
      </article>
      <section className="comments">
        <p className="kicker">Обсуждение</p>
        <h2>{comments.length} комментариев</h2>
        {user ? (
          <div className="comment-form">
            <div className="avatar">{user.username[0].toUpperCase()}</div>
            <textarea
              value={content}
              maxLength={1000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Напишите комментарий…"
            />
            <button
              onClick={() => content.trim() && add.mutate()}
              disabled={add.isPending}
            >
              <Send />
            </button>
          </div>
        ) : (
          <p className="login-note">
            <Link to="/login">Войдите</Link>, чтобы участвовать в обсуждении.
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="comment-list">
          {comments.map((comment) => (
            <article key={comment.id}>
              <div className="avatar">
                {comment.author_username[0].toUpperCase()}
              </div>
              <div>
                <b>@{comment.author_username}</b>
                <time>
                  {new Date(comment.created_at).toLocaleDateString("ru-RU")}
                </time>
                <p>{comment.content}</p>
              </div>
              {user?.username === comment.author_username && (
                <button
                  onClick={() => remove.mutate(comment.id)}
                  aria-label="Удалить комментарий"
                >
                  <Trash2 />
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function FavoritesPage() {
  const {
    data: cars = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["favorites"], queryFn: getFavorites });
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: unfavoriteCar,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
  return (
    <main className="inner-page favorites-page">
      <p className="kicker">Сохранил себе</p>
      <h1>Избранное</h1>
      {isLoading ? (
        <div className="catalog">
          <div className="skeleton" />
        </div>
      ) : isError ? (
        <div className="error">Не удалось загрузить избранное.</div>
      ) : cars.length ? (
        <div className="favorites-grid">
          {cars.map((car) => (
            <article key={car.id}>
              <Link to={`/cars/${car.id}`}>
                <img
                  src={car.cover_image_url}
                  alt={`${car.brand} ${car.model}`}
                />
                <span>{car.year}</span>
              </Link>
              <div>
                <p>{car.brand}</p>
                <h2>{car.model}</h2>
                <span>
                  <Star fill="currentColor" /> {car.rating_avg.toFixed(1)}
                </span>
                <button onClick={() => remove.mutate(car.id)}>
                  <Bookmark fill="currentColor" /> Убрать
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Bookmark />
          <h2>Сохранённых машин пока нет</h2>
          <p>Добавляй сюда машины друзей, к которым хочется вернуться.</p>
          <Link to="/explore">Смотреть машины</Link>
        </div>
      )}
    </main>
  );
}
