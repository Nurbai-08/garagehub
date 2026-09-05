import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="inner-page placeholder">
      <p className="kicker">Гараж</p>
      <h1>404 — сюда не заезжают</h1>
      <p>
        Такой страницы нет. Возможно, ссылка изменилась или была введена
        неверно.
      </p>
      <Link className="primary" to="/">
        На главную
      </Link>
    </main>
  );
}
